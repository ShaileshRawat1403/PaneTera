import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { BrowserActionStore } from '../server/browserActionStore';

function proposal(store: BrowserActionStore, name: string) {
  return store.propose({
    installationId: 'installation-1',
    capability: 'browser.click.execute',
    target: {
      tabId: 7,
      frameId: 0,
      expectedOrigin: 'https://example.com',
      role: 'button',
      accessibleName: name,
      elementFingerprint: `button:${name.toLowerCase()}`,
    },
    expectedOutcome: `${name} receives one click`,
  });
}

function preview(store: BrowserActionStore, actionId: string) {
  const claimed = store.claimNextPreview('installation-1');
  assert.strictEqual(claimed?.action.actionId, actionId);
  store.completePreview(actionId, 'installation-1', claimed!.previewToken, {
    status: 'previewed',
    actualOrigin: 'https://example.com',
    elementFingerprint: claimed!.action.target.elementFingerprint,
    url: 'https://example.com/details?token=preview-secret#private',
  });
  return claimed!.previewToken;
}

function main() {
  console.log('Running browser action persistence tests...');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-browser-actions-'));
  try {
    const first = new BrowserActionStore(root);
    const proposed = proposal(first, 'Continue');
    const proposedPreviewToken = preview(first, proposed.actionId);
    const approved = proposal(first, 'Open');
    preview(first, approved.actionId);
    first.approve(approved.actionId);
    const dispatched = proposal(first, 'Inspect');
    preview(first, dispatched.actionId);
    first.approve(dispatched.actionId);
    const waitingApproval = proposal(first, 'Details');
    preview(first, waitingApproval.actionId);
    first.approve(waitingApproval.actionId);
    const claimedPreview = proposal(first, 'Expand');
    const claimedPreviewToken = first.claimNextPreview('installation-1');
    assert.strictEqual(claimedPreviewToken?.action.actionId, claimedPreview.actionId);

    const claim = first.claimNext('installation-1');
    assert.strictEqual(claim?.action.actionId, approved.actionId);
    const secondClaim = first.claimNext('installation-1');
    assert.strictEqual(secondClaim?.action.actionId, dispatched.actionId);

    const persisted = fs.readFileSync(path.join(root, 'browser', 'actions.json'), 'utf8');
    assert.strictEqual(persisted.includes(claim!.dispatchToken), false);
    assert.strictEqual(persisted.includes(secondClaim!.dispatchToken), false);
    assert.strictEqual(persisted.includes(proposedPreviewToken), false);
    assert.strictEqual(persisted.includes(claimedPreviewToken!.previewToken), false);
    assert.strictEqual(persisted.includes('dispatchToken'), false);
    assert.strictEqual(persisted.includes('previewToken'), false);
    assert.strictEqual(persisted.includes('preview-secret'), false);
    assert.strictEqual(persisted.includes('#private'), false);

    const recovered = new BrowserActionStore(root);
    assert.strictEqual(recovered.get(proposed.actionId)?.status, 'proposed');
    assert.strictEqual(recovered.get(proposed.actionId)?.previewStatus, 'queued');
    assert.strictEqual(recovered.get(approved.actionId)?.status, 'interrupted');
    assert.strictEqual(recovered.get(dispatched.actionId)?.status, 'interrupted');
    assert.strictEqual(recovered.get(waitingApproval.actionId)?.status, 'interrupted');
    assert.strictEqual(recovered.claimNext('installation-1'), undefined);
    assert.strictEqual(recovered.get(claimedPreview.actionId)?.previewStatus, 'queued');
    const refreshedProposal = recovered.claimNextPreview('installation-1');
    assert.strictEqual(refreshedProposal?.action.actionId, proposed.actionId);
    recovered.completePreview(
      proposed.actionId,
      'installation-1',
      refreshedProposal!.previewToken,
      {
        status: 'previewed',
        actualOrigin: 'https://example.com',
        elementFingerprint: proposed.target.elementFingerprint,
      },
    );
    const reclaimedPreview = recovered.claimNextPreview('installation-1');
    assert.strictEqual(reclaimedPreview?.action.actionId, claimedPreview.actionId);
    assert.notStrictEqual(reclaimedPreview?.previewToken, claimedPreviewToken?.previewToken);
    recovered.completePreview(
      claimedPreview.actionId,
      'installation-1',
      reclaimedPreview!.previewToken,
      {
        status: 'stale-target',
        actualOrigin: 'https://example.com',
        elementFingerprint: claimedPreview.target.elementFingerprint,
        message: 'Expected one matching target but found two.',
      },
    );
    assert.strictEqual(recovered.get(claimedPreview.actionId)?.previewStatus, 'stale-target');
    assert.throws(
      () => recovered.approve(claimedPreview.actionId),
      /before target preview succeeds/,
    );
    assert.match(
      recovered.get(dispatched.actionId)?.interruptionReason || '',
      /will not be dispatched or repeated/,
    );
    console.log('Browser action persistence tests passed.');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main();
