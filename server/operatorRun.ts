// server/operatorRun.ts
//
// H3b: run the chat operator as a first-class, streamable run.
//
// The chat operator already drives the shared spine (runToolLoop) with its own
// provider adapter (callModel) and executor (makeOperatorExecuteTool). This
// wraps that same loop with a run in the AgentRunStore and emits its lifecycle
// through the H3a StoreEventSink, so a chat turn gains a runId, an append-only
// event log, the existing SSE stream, cancel, approval, and history, without
// changing the operator's tools or behavior. The loop, the provider adapter,
// and the executor are supplied by the caller and are byte-for-byte the ones
// the non-streaming path uses; only the surrounding run and its events are new.
//
// It mirrors the runtime adapter from H3a (server/agent/runtime.ts): the same
// event order, the same approval capture, and the same runId injection into an
// approval component. Sharing the sink keeps the two governed paths aligned.

import { AgentRunStore } from './agent/runStore';
import { StoreEventSink } from './agent/operatorSink';
import type { AgentPendingApproval } from './agent/types';
import {
  runToolLoop,
  type ModelTurn,
  type ToolExecution,
  type AgentToolCall,
} from './agentLoop';

// The operator executor may surface a governed proposal. These optional fields
// ride the same ToolExecution the loop already passes around (dispatchCapability
// sets them for propose-risk capabilities); reading them here is what turns a
// proposal into a waiting-approval run.
export interface OperatorToolOutcome extends ToolExecution {
  requiresApproval?: boolean;
  approval?: AgentPendingApproval;
}

export interface OperatorRunHandlers {
  callModel: () => Promise<ModelTurn>;
  executeTool: (call: AgentToolCall) => Promise<OperatorToolOutcome>;
  recordToolResult: (call: AgentToolCall, execution: ToolExecution) => void;
}

export interface OperatorRunResult {
  runId: string;
  status: 'completed' | 'waiting-approval' | 'canceled';
  reply: string;
  uiComponent?: unknown;
}

const AWAITING_FALLBACK = 'I prepared a governed action proposal. Review its exact target and command before approving it.';
const COMPLETED_FALLBACK = 'I completed the request but did not produce a textual response.';

export async function runOperatorAsRun(opts: {
  store: AgentRunStore;
  provider: string;
  model: string;
  /** Ephemeral model input; may carry attached context. Not persisted verbatim. */
  objective: string;
  /** Safe, user-authored objective for the durable record. */
  recordedObjective?: string;
  handlers: OperatorRunHandlers;
  maxTurns?: number;
  /**
   * Fired once, right after the run is created, before any model work. The
   * streaming endpoint uses this to return the runId immediately and let the
   * loop continue in the background, so the client can subscribe to the run's
   * SSE and watch events arrive live rather than after completion.
   */
  onRunCreated?: (runId: string) => void;
}): Promise<OperatorRunResult> {
  const run = await opts.store.create({
    objective: (opts.recordedObjective || opts.objective).trim(),
    provider: opts.provider,
    model: opts.model,
  });
  opts.onRunCreated?.(run.runId);
  const sink = new StoreEventSink(opts.store, run.runId);

  let uiComponent: unknown;
  let awaitingApproval = false;
  let pendingApproval: AgentPendingApproval | undefined;
  let turn = 0;

  try {
  await sink.transition('planning', { currentStep: 'Compile bounded context' });
  await sink.emit('run.started', 'PaneTera started the task.');
  await sink.emit('plan.created', 'Answer with governed tools, act only through policy, then report evidence.');

  const callModel = async (): Promise<ModelTurn> => {
    turn += 1;
    await sink.transition('running', { currentStep: 'Reason and select the next governed action' });
    await sink.emit('model.started', 'Reasoning engine started.', {
      provider: opts.provider,
      model: opts.model,
      turn,
    });
    const modelTurn = await opts.handlers.callModel();
    await sink.emit('model.completed', 'Reasoning engine returned an operational decision.', {
      toolCallCount: modelTurn.toolCalls.length,
      hasResponseText: Boolean(modelTurn.text),
    });
    return modelTurn;
  };

  const executeTool = async (call: AgentToolCall): Promise<ToolExecution> => {
    await sink.emit('tool.started', `Using ${call.name}.`, { capability: call.name });
    try {
      const execution = await opts.handlers.executeTool(call);
      if (execution.uiComponent !== undefined) uiComponent = execution.uiComponent;
      await sink.emit('tool.completed', `${call.name} returned observed output.`, {
        capability: call.name,
        requiresApproval: Boolean(execution.requiresApproval),
      });
      if (execution.requiresApproval) {
        awaitingApproval = true;
        pendingApproval = execution.approval;
        await sink.emit('approval.required', 'Exact user approval is required before execution.', {
          capability: call.name,
        });
      }
      return execution;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await sink.emit('tool.failed', `${call.name} failed.`, { capability: call.name });
      return { output: { error: message } };
    }
  };

  const loopResult = await runToolLoop({
    callModel,
    executeTool,
    recordToolResult: opts.handlers.recordToolResult,
    maxTurns: opts.maxTurns,
  });

  const status: 'completed' | 'waiting-approval' = awaitingApproval ? 'waiting-approval' : 'completed';
  const reply = loopResult.reply || (awaitingApproval ? AWAITING_FALLBACK : COMPLETED_FALLBACK);

  // Bind the runId into an approval component so its Approve/Reject controls act
  // on this exact run, exactly as the agent runtime does.
  if (awaitingApproval && uiComponent && typeof uiComponent === 'object' && 'data' in uiComponent) {
    const component = uiComponent as { data: unknown };
    if (component.data && typeof component.data === 'object') {
      component.data = { ...(component.data as Record<string, unknown>), runId: run.runId };
    }
  }

  await sink.emit('response.completed', 'Response prepared.', { awaitingApproval });
  await sink.transition(status, {
    currentStep: awaitingApproval ? 'Waiting for exact user approval' : null,
    reply,
    uiComponent,
    pendingApproval,
  });
  if (!awaitingApproval) await sink.emit('run.completed', 'Task completed.');

  return { runId: run.runId, status, reply, uiComponent };
  } catch (error: unknown) {
    // Record failure onto the run so a background (already-responded) run still
    // surfaces the failure to the client over SSE, then rethrow for any awaiting
    // caller. The detailed error is not persisted verbatim.
    if (opts.store.isCanceled(run.runId)) {
      const canceled = opts.store.get(run.runId);
      return { runId: run.runId, status: 'canceled', reply: canceled?.reply || 'Task canceled.' };
    }
    const message = error instanceof Error ? error.message : String(error);
    await sink.transition('failed', { currentStep: null, error: 'The reasoning or capability loop failed.' });
    await sink.emit('run.failed', 'Task failed.', { errorType: error instanceof Error ? error.name : 'UnknownError' });
    throw Object.assign(new Error(message), { runId: run.runId });
  }
}
