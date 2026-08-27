// server/agent/rigRunCoordinator.ts
//
// Generic run coordinator for governed Rig capability approvals.
// Provides authoritative Rig approval resolution, single-use invocation,
// cryptographic provenance recording, and model continuation resumption.

import type { AgentRun } from './types';
import type { AgentRunStore } from './runStore';
import { logTypedAudit } from '../auditRecord';
import { rigAuditFields } from '../rig/auditClassification';
import { rigApprovals, rigDataDeps, rigHandleInvocation } from '../rig/routes';
import type { OperatorPrincipal } from '../operatorPrincipal';

export type RigContinuationSynthesizer = (
  run: AgentRun,
  capabilityId: string,
  args: Record<string, unknown>,
  result: unknown,
) => Promise<string>;

let activeSynthesizer: RigContinuationSynthesizer | null = null;

export function setRigContinuationSynthesizer(synthesizer: RigContinuationSynthesizer | null): void {
  activeSynthesizer = synthesizer;
}

/**
 * Approve a pending Rig capability proposal on an agent run.
 * Performs authoritative single-use Rig execution, records provenance,
 * and resumes model reasoning from the tool execution output.
 */
export async function approvePendingRigCapability(
  store: AgentRunStore,
  runId: string,
  principal?: OperatorPrincipal,
  deps: ReturnType<typeof rigDataDeps> = rigDataDeps(),
  options?: { synthesizer?: RigContinuationSynthesizer },
): Promise<AgentRun> {
  const run = requireRigApproval(store, runId);
  const pending = run.pendingApproval!;
  const proposalId = pending.proposalId || pending.approvalId;
  if (!proposalId) {
    throw new Error('Pending Rig approval is missing proposalId.');
  }

  // 1. Authoritative Rig approval in rigApprovals
  const approval = deps.approvals.approve(proposalId);
  logTypedAudit({
    event: 'rig.invocation.approved',
    ...rigAuditFields('rig.invocation.approved', undefined, principal),
    correlation: { connectionId: approval.connectionId, proposalId: approval.proposalId, approvalId: approval.approvalId },
    details: { capabilityId: approval.capabilityId },
  });

  await store.append(runId, 'approval.resolved', 'User approved the governed MCP capability execution.', {
    decision: 'approved',
    approvalId: approval.approvalId,
    proposalId: approval.proposalId,
    capability: approval.capabilityId,
  });

  await store.transition(runId, 'running', {
    currentStep: `Invoking governed capability ${approval.capabilityId}`,
    pendingApproval: undefined,
  });

  // 2. Authoritative Rig single-use invocation
  const invocationResult = await rigHandleInvocation(
    deps,
    {
      connectionId: approval.connectionId,
      capabilityId: approval.capabilityId,
      approvalId: approval.approvalId,
      arguments: pending.arguments || {},
    },
    principal,
  );

  if (invocationResult.status !== 200) {
    const errorPayload = typeof invocationResult.payload === 'string'
      ? JSON.parse(invocationResult.payload)
      : invocationResult.payload;
    const errorMsg = errorPayload?.error || 'Rig invocation failed.';
    await store.append(runId, 'tool.failed', `Rig tool execution failed: ${errorMsg}`, {
      capability: approval.capabilityId,
      error: errorMsg,
    });
    return store.transition(runId, 'failed', {
      currentStep: null,
      error: errorMsg,
    });
  }

  const parsedPayload = typeof invocationResult.payload === 'string'
    ? JSON.parse(invocationResult.payload)
    : invocationResult.payload;

  await store.append(runId, 'tool.completed', `Executed ${approval.capabilityId}.`, {
    capability: approval.capabilityId,
    output: parsedPayload.result,
    provenance: parsedPayload.provenance,
  });

  // 3. Resume model reasoning: synthesize tool result into conversational response
  await store.transition(runId, 'running', {
    currentStep: 'Synthesizing response from tool execution output',
  });

  const synthesizer = options?.synthesizer || activeSynthesizer;
  let replyText: string;

  if (synthesizer) {
    try {
      replyText = await synthesizer(run, approval.capabilityId, pending.arguments || {}, parsedPayload.result);
    } catch {
      replyText = genericDeterministicFallback(approval.capabilityId);
    }
  } else {
    replyText = genericDeterministicFallback(approval.capabilityId);
  }

  await store.append(runId, 'response.completed', 'Response prepared.', { awaitingApproval: false });

  // 4. Complete run with model reply and provenance
  const completed = await store.transition(runId, 'completed', {
    currentStep: null,
    reply: replyText,
    provenance: parsedPayload.provenance,
    uiComponent: {
      type: 'McpToolExecutionResult',
      data: {
        capabilityId: approval.capabilityId,
        result: parsedPayload.result,
        provenance: parsedPayload.provenance,
      },
    },
    pendingApproval: undefined,
  });

  await store.append(runId, 'run.completed', 'Task completed.');
  return completed;
}

/**
 * Reject a pending Rig capability proposal on an agent run.
 */
export async function rejectPendingRigCapability(
  store: AgentRunStore,
  runId: string,
): Promise<AgentRun> {
  const run = requireRigApproval(store, runId);
  const pending = run.pendingApproval!;

  await store.append(runId, 'approval.resolved', 'User rejected the governed capability execution.', {
    decision: 'rejected',
    capability: pending.capability || pending.capabilityId,
    proposalId: pending.proposalId,
  });

  return store.cancel(runId);
}

function requireRigApproval(store: AgentRunStore, runId: string): AgentRun {
  const run = store.get(runId);
  if (!run) throw new Error('Agent run not found.');
  if (run.status !== 'waiting-approval' || run.pendingApproval?.kind !== 'rig-capability') {
    throw new Error(`Run cannot resolve a Rig approval from status ${run.status}.`);
  }
  return run;
}

function genericDeterministicFallback(capabilityId: string): string {
  const shortName = capabilityId.split('.').pop() || capabilityId;
  return `Capability "${shortName}" completed successfully.`;
}
