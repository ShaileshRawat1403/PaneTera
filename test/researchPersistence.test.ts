import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { researchSessionStore, resetResearchSessionStoreForTest } from '../server/research/researchSessionStore';
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
