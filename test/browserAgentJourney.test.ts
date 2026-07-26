import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AgentRunStore } from '../server/agent/runStore';
import {
  approvePendingBrowserAction,
  rejectPendingBrowserAction,
} from '../server/agent/browserRunCoordinator';
import { browserActionStore } from '../server/browserActionStore';
import { BrowserInspectionStore } from '../server/browserInspectionStore';
import { BrowserEvidenceStore, setBrowserEvidenceStoreForTest } from '../server/browserEvidenceStore';
import { resolveBrowserClickTargetFromEvidence } from '../server/browserTargetResolver';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('Running browser accountable-agent journey tests...');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-browser-agent-'));
  browserActionStore.reset();
  try {
    const evidenceStore = new BrowserEvidenceStore();
    setBrowserEvidenceStoreForTest(evidenceStore);
    const inspections = new BrowserInspectionStore();
    const queued = inspections.create('installation-1');
    assert.strictEqual(queued.status, 'queued');
    const claimed = inspections.claimNext('installation-1');
    assert.strictEqual(claimed?.requestId, queued.requestId);
    const completedInspection = inspections.complete(queued.requestId, 'installation-1', {
      status: 'completed',
      captureId: 'capture-1',
      extractionId: 'extraction-1',
    });
    assert.strictEqual(completedInspection.status, 'completed');
    const extraction = {
      extractionId: 'extraction-1',
      parentCaptureId: 'capture-1',
      capability: 'browser.elements.discover',
      ownership: {
        ownerId: 'installation-1',
        createdBy: { type: 'browser-extension' as const, actorId: 'runtime-1' },
      },
      trust: {
        sourceType: 'browser-dom' as const,
        trustLevel: 'untrusted' as const,
        instructionAuthority: 'none' as const,
      },
      source: {
        title: 'Example',
        url: 'https://example.com',
        origin: 'https://example.com',
        capturedAt: new Date().toISOString(),
      },
      data: {
        browserTarget: { tabId: 7, frameId: 0, expectedOrigin: 'https://example.com' },
        elements: [{
          evidenceId: 'evidence-1',
          role: 'button',
          accessibleName: 'Open details',
          elementFingerprint: 'fnv1a:1234abcd',
        }],
      },
      evidence: {
        items: [{
          evidenceId: 'evidence-1',
          extractionId: 'extraction-1',
          ownership: {
            ownerId: 'installation-1',
            createdBy: { type: 'browser-extension' as const, actorId: 'runtime-1' },
          },
          trust: {
            sourceType: 'browser-dom' as const,
            trustLevel: 'untrusted' as const,
            instructionAuthority: 'none' as const,
          },
          kind: 'interactive-element',
          content: '',
          contentBytes: 0,
        }],
        elementsMatched: 1,
        contentBytes: 100,
      },
      warnings: [],
      truncated: false,
    };
    assert.deepStrictEqual(resolveBrowserClickTargetFromEvidence({
      extraction,
      installationId: 'installation-1',
      extractionId: 'extraction-1',
      evidenceId: 'evidence-1',
    }), {
      tabId: 7,
      frameId: 0,
      expectedOrigin: 'https://example.com',
      role: 'button',
      accessibleName: 'Open details',
      elementFingerprint: 'fnv1a:1234abcd',
    });
    assert.throws(() => resolveBrowserClickTargetFromEvidence({
      extraction,
      installationId: 'other-installation',
      extractionId: 'extraction-1',
      evidenceId: 'evidence-1',
    }), /installation binding mismatch/);
    assert.throws(() => resolveBrowserClickTargetFromEvidence({
      extraction: {
        ...extraction,
        source: { ...extraction.source, capturedAt: new Date(Date.now() - 61_000).toISOString() },
      },
      installationId: 'installation-1',
      extractionId: 'extraction-1',
      evidenceId: 'evidence-1',
    }), /stale/);

    const store = new AgentRunStore(root);
    const run = await store.create({ objective: 'Click Open details', provider: 'test', model: 'test' });
    const action = browserActionStore.propose({
      installationId: 'installation-1',
      capability: 'browser.click.execute',
      target: {
        tabId: 7,
        frameId: 0,
        expectedOrigin: 'https://example.com',
        role: 'button',
        accessibleName: 'Open details',
        elementFingerprint: 'fnv1a:1234abcd',
      },
      expectedOutcome: 'Details become visible.',
    });
    await store.transition(run.runId, 'waiting-approval', {
      currentStep: 'Waiting for exact user approval',
      pendingApproval: {
        kind: 'browser-action',
        approvalId: action.actionId,
        capability: action.capability,
        summary: 'Click Open details',
        expiresAt: action.expiresAt,
      },
    });
    const preview = browserActionStore.claimNextPreview('installation-1');
    assert.strictEqual(preview?.action.actionId, action.actionId);
    browserActionStore.completePreview(
      action.actionId,
      'installation-1',
      preview!.previewToken,
      {
        status: 'previewed',
        actualOrigin: 'https://example.com',
        elementFingerprint: 'fnv1a:1234abcd',
      },
    );
    await approvePendingBrowserAction(store, run.runId);
    const dispatch = browserActionStore.claimNext('installation-1');
    assert.ok(dispatch);
    evidenceStore.storeObservation({
      captureId: 'capture-after-click',
      ownership: {
        ownerId: 'installation-1',
        createdBy: { type: 'browser-extension', actorId: 'runtime-1' },
      },
      trust: {
        sourceType: 'browser-dom',
        trustLevel: 'untrusted',
        instructionAuthority: 'none',
      },
      captureType: 'page-selection',
      title: 'Example',
      url: 'https://example.com/details',
      origin: 'https://example.com',
      selectedText: '',
      capturedAt: new Date().toISOString(),
    });
    browserActionStore.complete(action.actionId, 'installation-1', dispatch!.dispatchToken, {
      status: 'completed',
      actualOrigin: 'https://example.com',
      elementFingerprint: 'fnv1a:1234abcd',
      postActionCaptureId: 'capture-after-click',
    });
    await delay(600);
    assert.strictEqual(store.get(run.runId)?.status, 'completed');
    assert.ok(store.listEvents(run.runId).some((event) => (
      event.type === 'verification.completed' && event.data?.outcome === 'verified'
    )));

    const rejectedRun = await store.create({ objective: 'Reject click', provider: 'test', model: 'test' });
    const rejectedAction = browserActionStore.propose({
      installationId: 'installation-1',
      capability: 'browser.click.execute',
      target: {
        tabId: 7,
        frameId: 0,
        expectedOrigin: 'https://example.com',
        role: 'link',
        accessibleName: 'Leave page',
        elementFingerprint: 'fnv1a:87654321',
      },
      expectedOutcome: 'Navigation occurs.',
    });
    await store.transition(rejectedRun.runId, 'waiting-approval', {
      pendingApproval: {
        kind: 'browser-action',
        approvalId: rejectedAction.actionId,
        capability: rejectedAction.capability,
        summary: 'Click Leave page',
      },
    });
    await rejectPendingBrowserAction(store, rejectedRun.runId);
    assert.strictEqual(store.get(rejectedRun.runId)?.status, 'canceled');
    assert.strictEqual(browserActionStore.get(rejectedAction.actionId)?.status, 'canceled');
    console.log('Browser accountable-agent journey tests passed.');
  } finally {
    setBrowserEvidenceStoreForTest(undefined);
    browserActionStore.reset();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
