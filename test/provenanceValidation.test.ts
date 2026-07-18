import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { provenanceValidationService } from '../server/research/provenanceValidationService';
import { researchSessionService } from '../server/research/researchSessionService';
import { researchSessionStore, resetResearchSessionStoreForTest } from '../server/research/researchSessionStore';
import { setBrowserEvidenceStoreForTest, BrowserEvidenceStore } from '../server/browserEvidenceStore';
import { ObservationItem, ExtractionResult, EvidenceItem } from '../server/evidence/evidenceTypes';
import { setEvidenceRetentionServiceForTest } from '../server/evidence/evidenceRetentionService';

async function runTests() {
  console.log('Running ProvenanceValidationService tests...');
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

  async function setup() {
    tempDir = fs.mkdtempSync(path.join(process.cwd(), 'tessera-test-'));
    process.env.TESSERA_APP_DATA = tempDir;
    resetResearchSessionStoreForTest();
    setEvidenceRetentionServiceForTest(undefined);

    const store = new BrowserEvidenceStore();
    store.storeObservation(baseObs);
    store.storeExtraction(baseExt);
    setBrowserEvidenceStoreForTest(store);

    const session = await researchSessionService.createSession('user-1', 'Validation Test');
    const snap = await researchSessionService.createSnapshot('user-1', session.sessionId, [
      { captureId: 'cap-1', extractionId: 'ext-1', evidenceId: 'ev-1' }
    ]);
    return { sessionId: session.sessionId, snapshotId: snap.snapshotId, snapshotEntryId: snap.entries[0].snapshotEntryId, version: snap.version };
  }

  function cleanup() {
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.TESSERA_APP_DATA;
  }

  try {
    // Test: validates a correct snapshot reference
    console.log(' - validates a correct snapshot reference');
    let ctx = await setup();
    let result = await provenanceValidationService.validateSnapshotReference(
      'user-1', ctx.sessionId, ctx.snapshotId, ctx.snapshotEntryId, ctx.version
    );
    assert.ok(result.valid);
    assert.strictEqual(result.status, 'resolved');
    assert.strictEqual(result.snapshotEntry?.excerpt, 'Hello World');
    cleanup();

    // Test: rejects unauthorised access
    console.log(' - rejects unauthorised access');
    ctx = await setup();
    result = await provenanceValidationService.validateSnapshotReference(
      'user-2', ctx.sessionId, ctx.snapshotId, ctx.snapshotEntryId, ctx.version
    );
    assert.ok(!result.valid);
    assert.strictEqual(result.status, 'unauthorised');
    cleanup();

    // Test: rejects missing snapshot
    console.log(' - rejects missing snapshot');
    ctx = await setup();
    result = await provenanceValidationService.validateSnapshotReference(
      'user-1', ctx.sessionId, 'missing-snap', ctx.snapshotEntryId, ctx.version
    );
    assert.ok(!result.valid);
    assert.strictEqual(result.status, 'missing');
    cleanup();

    // Test: rejects tampered hash (integrity-failure)
    console.log(' - rejects tampered hash (integrity-failure)');
    ctx = await setup();
    const snapPath = path.join(tempDir, 'research', 'sessions', ctx.sessionId, 'snapshots', `${ctx.version.toString().padStart(4, '0')}-${ctx.snapshotId}.json`);
    const data = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
    data.entries[0].excerpt = 'Tampered text';
    fs.writeFileSync(snapPath, JSON.stringify(data));
    result = await provenanceValidationService.validateSnapshotReference(
      'user-1', ctx.sessionId, ctx.snapshotId, ctx.snapshotEntryId, ctx.version
    );
    assert.ok(!result.valid);
    assert.strictEqual(result.status, 'integrity-failure');
    cleanup();

    console.log('ProvenanceValidationService tests passed.');
  } catch(e) {
    cleanup();
    throw e;
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
