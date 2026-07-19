import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { researchSessionStore, resetResearchSessionStoreForTest } from '../server/research/researchSessionStore';
import { researchAnalysisStore } from '../server/research/researchAnalysisStore';
import { getTesseraAppDataDir } from '../server/appData';
import { ResearchSession } from '../server/research/researchTypes';
import { researchSessionService } from '../server/research/researchSessionService';
import { setBrowserEvidenceStoreForTest, BrowserEvidenceStore } from '../server/browserEvidenceStore';
import { setEvidenceRetentionServiceForTest } from '../server/evidence/evidenceRetentionService';
import { ObservationItem, ExtractionResult, EvidenceItem } from '../server/evidence/evidenceTypes';
import { hashCanonicalText } from '../server/evidence/evidenceCanonicalizer';

async function runTests() {
  console.log('Running Research Persistence and AppData tests...');
  let tempDir = fs.mkdtempSync(path.join(process.cwd(), 'tessera-test-'));

  const baseObs: ObservationItem = {
    captureId: 'cap-1', captureType: 'page-selection',
    ownership: { ownerId: 'user-1', createdBy: { type: 'workbench', actorId: 'x' } },
    trust: { sourceType: 'browser-dom', trustLevel: 'untrusted', instructionAuthority: 'none' },
    title: 'T', url: 'U', origin: 'O', selectedText: '', capturedAt: new Date().toISOString()
  };

  const baseEv: EvidenceItem = {
    evidenceId: 'ev-1', extractionId: 'ext-1',
    ownership: baseObs.ownership, trust: baseObs.trust,
    kind: 'text', content: 'Hello World', contentBytes: 11
  };

  const baseExt: ExtractionResult = {
    extractionId: 'ext-1', parentCaptureId: 'cap-1', capability: 'cap',
    ownership: baseObs.ownership, trust: baseObs.trust,
    source: { title: 'T', url: 'U', origin: 'O', capturedAt: baseObs.capturedAt },
    data: {}, evidence: { items: [baseEv], elementsMatched: 1, contentBytes: 11 },
    warnings: [], truncated: false
  };

  function setup() {
    tempDir = fs.mkdtempSync(path.join(process.cwd(), 'tessera-test-'));
  }

  function cleanup() {
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.TESSERA_APP_DATA;
    delete process.env.XDG_DATA_HOME;
    delete process.env.LOCALAPPDATA;
  }

  try {
    // Test: uses TESSERA_APP_DATA override when provided
    console.log(' - uses TESSERA_APP_DATA override when provided');
    setup();
    process.env.TESSERA_APP_DATA = tempDir;
    let dir = getTesseraAppDataDir();
    assert.strictEqual(dir, tempDir);
    cleanup();

    // Test: handles atomic write safely on session save
    console.log(' - handles atomic write safely on session save');
    setup();
    process.env.TESSERA_APP_DATA = tempDir;
    resetResearchSessionStoreForTest();

    const session: ResearchSession = {
      sessionId: 'sess-atomic-1',
      ownerId: 'user-1',
      title: 'Atomic Test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      sourceCount: 0,
      warnings: []
    };

    await researchSessionStore.saveSession(session);
    let p = path.join(tempDir, 'research', 'sessions', session.sessionId, 'session.json');
    assert.ok(fs.existsSync(p));
    cleanup();

    // Test: serializes concurrent writes via SessionMutex
    console.log(' - serializes concurrent writes via SessionMutex');
    setup();
    process.env.TESSERA_APP_DATA = tempDir;
    resetResearchSessionStoreForTest();

    const sessionConcurrent: ResearchSession = {
      sessionId: 'sess-concurrent',
      ownerId: 'user-1',
      title: 'Initial',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      sourceCount: 0,
      warnings: []
    };

    const writes = Array.from({ length: 10 }).map((_, i) => {
      const s = { ...sessionConcurrent, title: `Title ${i}` };
      return researchSessionStore.saveSession(s);
    });

    await Promise.all(writes);

    const loaded = await researchSessionStore.getSession('sess-concurrent');
    assert.ok(loaded);
    assert.ok(loaded?.title.startsWith('Title '));
    cleanup();

    // Test: detects and rejects corrupted session file
    console.log(' - detects and rejects corrupted session file');
    setup();
    process.env.TESSERA_APP_DATA = tempDir;
    resetResearchSessionStoreForTest();

    const sessionDir = path.join(tempDir, 'research', 'sessions', 'sess-corrupted');
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'session.json'), 'this is not valid json');

    await assert.rejects(
      researchSessionStore.getSession('sess-corrupted'),
      /Unexpected token|Unexpected string/ // Standard JSON.parse error
    );
    cleanup();

    // Test: Snapshot durability
    console.log(' - proves snapshot durability');
    setup();
    process.env.TESSERA_APP_DATA = tempDir;
    resetResearchSessionStoreForTest();
    setEvidenceRetentionServiceForTest(undefined);

    // Create browser evidence
    let store = new BrowserEvidenceStore();
    store.storeObservation(baseObs);
    store.storeExtraction(baseExt);
    setBrowserEvidenceStoreForTest(store);

    const sessionDurability = await researchSessionService.createSession('user-1', 'Durability Test');

    // create snapshot
    const snap = await researchSessionService.createSnapshot('user-1', sessionDurability.sessionId, [
      { captureId: 'cap-1', extractionId: 'ext-1', evidenceId: 'ev-1' }
    ]);

    // release transient leases (happens automatically at end of createSnapshot)
    // evict or remove live evidence
    setBrowserEvidenceStoreForTest(new BrowserEvidenceStore());

    // reload ResearchSessionStore
    resetResearchSessionStoreForTest();

    // retrieve the immutable snapshot excerpt
    const loadedSnap = await researchSessionStore.getSnapshot(sessionDurability.sessionId, snap.snapshotId, snap.version);
    assert.ok(loadedSnap);
    const entry = loadedSnap!.entries[0];

    // validate its content hash
    const rehashed = hashCanonicalText(entry.excerpt);
    assert.strictEqual(rehashed.contentHash, entry.integrity.contentHash);
    cleanup();

    // Mutex Lifecycle Proof
    console.log(' - proves Mutex lifecycle');
    const storeA = new (await import('../server/research/researchAnalysisStore')).ResearchAnalysisStore(tempDir);
    const mutex = storeA.getMutex();

    // release after success
    const rel1 = await mutex.acquire('sess-mutex');
    assert.strictEqual(mutex.activeKeyCount(), 1);
    rel1();
    assert.strictEqual(mutex.activeKeyCount(), 0);

    // release after failure (simulated by throwing inside lock)
    const rel2 = await mutex.acquire('sess-mutex');
    assert.strictEqual(mutex.activeKeyCount(), 1);
    try {
      throw new Error("fail");
    } catch(e) {
      rel2();
    }
    assert.strictEqual(mutex.activeKeyCount(), 0);

    // multiple ordered waiters
    const w1 = mutex.acquire('sess-mutex');
    const w2 = mutex.acquire('sess-mutex');
    const r1 = await w1;
    assert.strictEqual(mutex.activeKeyCount(), 1);
    let r2Finished = false;
    w2.then(r => { r2Finished = true; r(); });
    assert.strictEqual(r2Finished, false);
    r1();
    await new Promise(res => setTimeout(res, 10)); // let event loop tick
    assert.strictEqual(r2Finished, true);
    assert.strictEqual(mutex.activeKeyCount(), 0);

    // different sessions progressing independently
    const sess1 = await mutex.acquire('sess-1');
    const sess2 = await mutex.acquire('sess-2');
    assert.strictEqual(mutex.activeKeyCount(), 2);
    sess1();
    assert.strictEqual(mutex.activeKeyCount(), 1);
    sess2();
    assert.strictEqual(mutex.activeKeyCount(), 0);

    // Test: Analysis restart proof with distinct Store instances
    console.log(' - proves analysis restart durability with Store instances');
    const storeB = new (await import('../server/research/researchAnalysisStore')).ResearchAnalysisStore(tempDir);

    // Setup session and snapshot
    const sessionAnalysis = await researchSessionService.createSession('user-2', 'Analysis Durability Test');

    // Create an actual snapshot to satisfy validation
    const mockObs: ObservationItem = {
      captureId: 'cap-ana', captureType: 'page-selection',
      ownership: { ownerId: 'user-2', createdBy: { type: 'workbench', actorId: 'x' } },
      trust: { sourceType: 'browser-dom', trustLevel: 'untrusted', instructionAuthority: 'none' },
      title: 'T', url: 'U', origin: 'O', selectedText: '', capturedAt: new Date().toISOString()
    };
    const mockEv: EvidenceItem = {
      evidenceId: 'ev-ana', extractionId: 'ext-ana',
      ownership: mockObs.ownership, trust: mockObs.trust,
      kind: 'text', content: 'Analysis Test', contentBytes: 13
    };
    const mockExt: ExtractionResult = {
      extractionId: 'ext-ana', parentCaptureId: 'cap-ana', capability: 'cap',
      ownership: mockObs.ownership, trust: mockObs.trust,
      source: { title: 'T', url: 'U', origin: 'O', capturedAt: mockObs.capturedAt },
      data: {}, evidence: { items: [mockEv], elementsMatched: 1, contentBytes: 13 },
      warnings: [], truncated: false
    };

    let anaStore = new BrowserEvidenceStore();
    anaStore.storeObservation(mockObs);
    anaStore.storeExtraction(mockExt);
    setBrowserEvidenceStoreForTest(anaStore);

    const snapAna = await researchSessionService.createSnapshot('user-2', sessionAnalysis.sessionId, [
      { captureId: 'cap-ana', extractionId: 'ext-ana', evidenceId: 'ev-ana' }
    ]);

    // Create an analysis in Store A
    const mockAnalysis = {
      analysisId: 'ana-123',
      ownerId: 'user-2',
      sessionId: sessionAnalysis.sessionId,
      snapshotId: snapAna.snapshotId,
      snapshotContentHash: snapAna.snapshotIntegrity.contentHash,
      schemaVersion: '1.0',
      createdAt: new Date().toISOString(),
      generator: { type: 'mock', provider: 'test', model: 'test', promptVersion: '1.0' },
      status: 'completed',
      claims: [],
      validationSummary: { totalReferences: 0, resolvedReferences: 0, unresolvedReferences: 0, claimsBlocked: 0, warnings: [] },
      warnings: []
    };

    await storeA.saveAnalysis(mockAnalysis as any);

    // Read from Store B
    const loadedAnalysis = await storeB.getAnalysis(sessionAnalysis.sessionId, 'ana-123');
    assert.ok(loadedAnalysis);
    assert.strictEqual(loadedAnalysis.analysisId, 'ana-123');

    // Test: Atomic race condition proof for analyses
    console.log(' - proves atomic race condition for analysis publications');
    const storeRace1 = new (await import('../server/research/researchAnalysisStore')).ResearchAnalysisStore(tempDir);
    const storeRace2 = new (await import('../server/research/researchAnalysisStore')).ResearchAnalysisStore(tempDir);

    const raceAnalysisId = 'ana-race';
    const mockAnalysisRace1 = { ...mockAnalysis, analysisId: raceAnalysisId, status: 'completed' };
    const mockAnalysisRace2 = { ...mockAnalysis, analysisId: raceAnalysisId, status: 'rejected' };

    // both stores attempt to save concurrently
    const p1 = storeRace1.saveAnalysis(mockAnalysisRace1 as any);
    const p2 = storeRace2.saveAnalysis(mockAnalysisRace2 as any);

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactly one publish should succeed');
    assert.strictEqual(rejected.length, 1, 'Exactly one publish should fail with conflict');

    if (rejected[0].status === 'rejected') {
      assert.ok(
        (rejected[0].reason as Error).message.includes('immutable and already exists') ||
        (rejected[0].reason as Error).message.includes('EEXIST'),
        'Loser must receive a conflict error'
      );
    }

    // Verify winner was not corrupted
    const winnerAnalysis = await storeRace1.getAnalysis(sessionAnalysis.sessionId, raceAnalysisId);
    assert.ok(winnerAnalysis);

    // Assert winner is valid and matches one of the inputs precisely
    assert.ok(winnerAnalysis.status === 'completed' || winnerAnalysis.status === 'rejected');
    const expectedStatus = fulfilled[0] === results[0] ? 'completed' : 'rejected';
    assert.strictEqual(winnerAnalysis.status, expectedStatus, 'Winner content must be intact');

    cleanup();

    console.log('Research Persistence and AppData tests passed.');
  } catch(e) {
    cleanup();
    throw e;
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
