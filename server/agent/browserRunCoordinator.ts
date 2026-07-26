import { browserActionStore } from '../browserActionStore';
import { browserEvidenceStore } from '../browserEvidenceStore';
import { logAudit } from '../audit';
import type { AgentRun } from './types';
import { AgentRunStore } from './runStore';

const MONITOR_TIMEOUT_MS = 150_000;

export async function approvePendingBrowserAction(
  store: AgentRunStore,
  runId: string,
): Promise<AgentRun> {
  const run = requireBrowserApproval(store, runId);
  const action = browserActionStore.approve(run.pendingApproval!.approvalId);
  logAudit('browser.action.approved', {
    actor: 'operator',
    runId,
    actionId: action.actionId,
    capability: action.capability,
    installationId: action.installationId,
    target: action.target,
    policyDecision: 'allowed',
    status: action.status,
  });
  await store.append(runId, 'approval.resolved', 'Browser action approved by the user.', {
    decision: 'approved',
    approvalId: action.actionId,
    capability: action.capability,
  });
  const resumed = await store.transition(runId, 'running', {
    currentStep: 'Waiting for the paired Chrome extension to execute once',
  });
  void monitorBrowserAction(store, runId, action.actionId);
  return resumed;
}

export async function rejectPendingBrowserAction(
  store: AgentRunStore,
  runId: string,
): Promise<AgentRun> {
  const run = requireBrowserApproval(store, runId);
  const action = browserActionStore.cancel(run.pendingApproval!.approvalId);
  logAudit('browser.action.canceled', {
    actor: 'operator',
    runId,
    actionId: action.actionId,
    capability: action.capability,
    installationId: action.installationId,
    policyDecision: 'denied',
    status: action.status,
  });
  await store.append(runId, 'approval.resolved', 'Browser action rejected by the user.', {
    decision: 'rejected',
    approvalId: action.actionId,
    capability: action.capability,
  });
  return store.cancel(runId);
}

function requireBrowserApproval(store: AgentRunStore, runId: string): AgentRun {
  const run = store.get(runId);
  if (!run) throw new Error('Agent run not found.');
  if (run.status !== 'waiting-approval' || run.pendingApproval?.kind !== 'browser-action') {
    throw new Error(`Run cannot resolve a browser approval from status ${run.status}.`);
  }
  return run;
}

async function monitorBrowserAction(
  store: AgentRunStore,
  runId: string,
  actionId: string,
): Promise<void> {
  const deadline = Date.now() + MONITOR_TIMEOUT_MS;
  let dispatchRecorded = false;
  while (Date.now() < deadline) {
    const action = browserActionStore.get(actionId);
    if (!action) return fail(store, runId, 'The browser action record disappeared.');
    if (action.status === 'dispatched' && !dispatchRecorded) {
      dispatchRecorded = true;
      await store.append(runId, 'action.dispatched', 'The approved action was dispatched to Chrome.', {
        actionId,
        capability: action.capability,
      });
    }
    if (action.status === 'completed') {
      await store.transition(runId, 'verifying', {
        currentStep: 'Verify target binding and fresh post-action observation',
      });
      const postActionObservation = action.result?.postActionCaptureId
        ? browserEvidenceStore.getObservationByCaptureId(action.result.postActionCaptureId)
        : undefined;
      const verified = Boolean(
        action.result
        && action.result.actualOrigin === action.target.expectedOrigin
        && action.result.elementFingerprint === action.target.elementFingerprint
        && postActionObservation
        && postActionObservation.ownership.ownerId === action.installationId
        && (!action.approvedAt || postActionObservation.capturedAt >= action.approvedAt),
      );
      await store.append(runId, 'verification.completed', verified
        ? 'The bound target received one click and a fresh page observation was captured.'
        : 'The click completed but fresh verification evidence was incomplete.', {
        actionId,
        outcome: verified ? 'verified' : 'inconclusive',
        expectedOrigin: action.target.expectedOrigin,
        actualOrigin: action.result?.actualOrigin,
        postActionCaptureId: action.result?.postActionCaptureId,
      });
      const reply = verified
        ? `I clicked the ${action.target.role} “${action.target.accessibleName}” once and captured fresh post-action evidence.`
        : `Chrome reported that it clicked “${action.target.accessibleName}”, but PaneTera could not obtain complete fresh verification evidence.`;
      await store.transition(runId, 'completed', {
        currentStep: null,
        reply,
        pendingApproval: undefined,
      });
      await store.append(runId, 'run.completed', verified
        ? 'Browser action completed with fresh evidence.'
        : 'Browser action completed with inconclusive verification.');
      return;
    }
    if (['failed', 'stale-target', 'interrupted', 'canceled', 'expired'].includes(action.status)) {
      return fail(store, runId, `Browser action stopped as ${action.status}.`);
    }
    await delay(250);
  }
  await fail(store, runId, 'Timed out waiting for the paired Chrome extension.');
}

async function fail(store: AgentRunStore, runId: string, reason: string): Promise<void> {
  await store.transition(runId, 'failed', {
    currentStep: null,
    error: reason,
    pendingApproval: undefined,
  });
  await store.append(runId, 'run.failed', reason);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
