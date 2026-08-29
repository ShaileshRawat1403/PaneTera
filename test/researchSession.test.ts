import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { researchSessionService } from '../server/research/researchSessionService';
import { researchSessionStore, resetResearchSessionStoreForTest } from '../server/research/researchSessionStore';
import { setEvidenceRetentionServiceForTest } from '../server/evidence/evidenceRetentionService';
import { setBrowserEvidenceStoreForTest, BrowserEvidenceStore } from '../server/browserEvidenceStore';
import { ObservationItem, ExtractionResult, EvidenceItem } from '../server/evidence/evidenceTypes';

async function runTests() {
  console.log('Running ResearchSessionService tests...');
  // Created per setup(), removed by it and by cleanup(). Starts empty:
  // the previous module-scope mkdtemp was orphaned by the first setup()
  // call and never removed by anything.
  let tempDir = '';
  
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
    // Remove the previous run's directory before replacing the handle to it.
    // setup() is called once per test, so without this every call but the
    // last orphaned a directory that cleanup() could no longer see.
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-research-session-'));
    process.env.TESSERA_APP_DATA = tempDir;
    
    resetResearchSessionStoreForTest();
    setEvidenceRetentionServiceForTest(undefined);
    setBrowserEvidenceStoreForTest(new BrowserEvidenceStore());
  }

  function cleanup() {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = '';
    delete process.env.TESSERA_APP_DATA;
  }

  try {
    // Test: creates session
    console.log(' - creates session');
    setup();
    let session = await researchSessionService.createSession('user-1', 'Test Session');
    assert.strictEqual(session.title, 'Test Session');
    assert.strictEqual(session.status, 'draft');
    let loaded = await researchSessionService.getSession(session.sessionId);
    assert.strictEqual(loaded?.sessionId, session.sessionId);
    cleanup();

    // Test: adds three evidence items and detects duplicates
    console.log(' - adds three evidence items and detects duplicates');
    setup();
    session = await researchSessionService.createSession('user-1', 'Test Session');
    let store = new BrowserEvidenceStore();
    store.storeObservation(baseObs);
    const ev2 = { ...baseEv, evidenceId: 'ev-2' };
    const ev3 = { ...baseEv, evidenceId: 'ev-3', content: 'Different', contentBytes: 9 };
    store.storeExtraction({ ...baseExt, extractionId: 'ext-1', evidence: { items: [baseEv, ev2, ev3], elementsMatched: 3, contentBytes: 31 } });
    setBrowserEvidenceStoreForTest(store);

    let snapshot = await researchSessionService.createSnapshot('user-1', session.sessionId, [
      { captureId: 'cap-1', extractionId: 'ext-1', evidenceId: 'ev-1' },
      { captureId: 'cap-1', extractionId: 'ext-1', evidenceId: 'ev-2' },
      { captureId: 'cap-1', extractionId: 'ext-1', evidenceId: 'ev-3' }
    ]);
    assert.strictEqual(snapshot.entries.length, 3);
    assert.ok(snapshot.entries[0].duplicateOfSnapshotEntryId === undefined);
    assert.strictEqual(snapshot.entries[1].duplicateOfSnapshotEntryId, snapshot.entries[0].snapshotEntryId);
    assert.ok(snapshot.entries[2].duplicateOfSnapshotEntryId === undefined);
    cleanup();

    // Test: rejects oversized entries
    console.log(' - rejects oversized entries');
    setup();
    session = await researchSessionService.createSession('user-1', 'Test Session');
    store = new BrowserEvidenceStore();
    store.storeObservation(baseObs);
    const oversizedEv = { ...baseEv, content: 'a'.repeat(100 * 1024 + 1) };
    store.storeExtraction({ ...baseExt, evidence: { items: [oversizedEv], elementsMatched: 1, contentBytes: 0 } });
    setBrowserEvidenceStoreForTest(store);

    await assert.rejects(
      researchSessionService.createSnapshot('user-1', session.sessionId, [{ captureId: 'cap-1', extractionId: 'ext-1', evidenceId: 'ev-1' }]),
      /exceeds maximum excerpt size/
    );
    cleanup();

    // Test: archives and deletes session
    console.log(' - archives and deletes session');
    setup();
    session = await researchSessionService.createSession('user-1', 'Test Session');
    await researchSessionService.archiveSession('user-1', session.sessionId);
    loaded = await researchSessionService.getSession(session.sessionId);
    assert.strictEqual(loaded?.status, 'archived');
    await researchSessionService.deleteSession('user-1', session.sessionId);
    loaded = await researchSessionService.getSession(session.sessionId);
    assert.strictEqual(loaded, null);
    cleanup();

    console.log('ResearchSessionService tests passed.');
  } catch(e) {
    cleanup();
    throw e;
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
