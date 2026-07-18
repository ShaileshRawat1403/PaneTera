import assert from 'assert';
import { evidenceGraphResolver } from '../server/evidence/evidenceGraphResolver';
import { setBrowserEvidenceStoreForTest, BrowserEvidenceStore } from '../server/browserEvidenceStore';
import { ObservationItem, ExtractionResult, EvidenceItem } from '../server/evidence/evidenceTypes';

async function runTests() {
  console.log('Running EvidenceGraphResolver tests...');
  
  const baseObs: ObservationItem = {
    captureId: 'cap-1',
    captureType: 'page-selection',
    ownership: { ownerId: 'user-1', createdBy: { type: 'workbench', actorId: 'x' } },
    trust: { sourceType: 'browser-dom', trustLevel: 'untrusted', instructionAuthority: 'none' },
    title: 'T', url: 'U', origin: 'O', selectedText: '', capturedAt: new Date().toISOString()
  };

  const baseEv: EvidenceItem = {
    evidenceId: 'ev-1',
    extractionId: 'ext-1',
    ownership: baseObs.ownership,
    trust: baseObs.trust,
    kind: 'text',
    content: 'Hello World',
    contentBytes: 11
  };

  const baseExt: ExtractionResult = {
    extractionId: 'ext-1',
    parentCaptureId: 'cap-1',
    capability: 'cap',
    ownership: baseObs.ownership,
    trust: baseObs.trust,
    source: { title: 'T', url: 'U', origin: 'O', capturedAt: baseObs.capturedAt },
    data: {},
    evidence: { items: [baseEv], elementsMatched: 1, contentBytes: 11 },
    warnings: [],
    truncated: false
  };

  function setupStore(store: BrowserEvidenceStore = new BrowserEvidenceStore()) {
    setBrowserEvidenceStoreForTest(store);
    return store;
  }

  try {
    // Test: resolves valid lineage
    console.log(' - resolves valid lineage');
    let store = setupStore();
    store.storeObservation(baseObs);
    store.storeExtraction(baseExt);
    let result = evidenceGraphResolver.resolve('user-1', 'cap-1', 'ext-1', 'ev-1');
    assert.strictEqual(result.status, 'resolved');
    assert.strictEqual(result.evidence?.content, 'Hello World');

    // Test: rejects missing capture
    console.log(' - rejects missing capture');
    store = setupStore();
    store.storeExtraction(baseExt);
    result = evidenceGraphResolver.resolve('user-1', 'cap-1', 'ext-1', 'ev-1');
    assert.strictEqual(result.status, 'missing');

    // Test: rejects missing extraction
    console.log(' - rejects missing extraction');
    store = setupStore();
    store.storeObservation(baseObs);
    result = evidenceGraphResolver.resolve('user-1', 'cap-1', 'ext-1', 'ev-1');
    assert.strictEqual(result.status, 'missing');

    // Test: rejects broken parent capture link
    console.log(' - rejects broken parent capture link');
    store = setupStore();
    store.storeObservation(baseObs);
    store.storeExtraction({ ...baseExt, parentCaptureId: 'cap-2' });
    result = evidenceGraphResolver.resolve('user-1', 'cap-1', 'ext-1', 'ev-1');
    assert.strictEqual(result.status, 'broken-parent');

    // Test: rejects cross-owner denial
    console.log(' - rejects cross-owner denial');
    store = setupStore();
    store.storeObservation(baseObs);
    store.storeExtraction(baseExt);
    result = evidenceGraphResolver.resolve('user-2', 'cap-1', 'ext-1', 'ev-1');
    assert.strictEqual(result.status, 'unauthorised');

    // Test: rejects trust mismatch
    console.log(' - rejects trust mismatch');
    store = setupStore();
    store.storeObservation({
      ...baseObs, 
      trust: { ...baseObs.trust, trustLevel: 'trusted' as any }
    });
    store.storeExtraction(baseExt);
    result = evidenceGraphResolver.resolve('user-1', 'cap-1', 'ext-1', 'ev-1');
    assert.strictEqual(result.status, 'trust-mismatch');

    // Test: rejects unsupported source
    console.log(' - rejects unsupported source');
    store = setupStore();
    store.storeObservation(baseObs);
    store.storeExtraction({
      ...baseExt,
      evidence: { ...baseExt.evidence, items: [{ ...baseEv, kind: 'audio' }] }
    });
    result = evidenceGraphResolver.resolve('user-1', 'cap-1', 'ext-1', 'ev-1');
    assert.strictEqual(result.status, 'unsupported-source');

    console.log('EvidenceGraphResolver tests passed.');
  } finally {
    setBrowserEvidenceStoreForTest(undefined);
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
