import type { AgentRun, AgentEventType, AgentRunStatus } from './types';
import type { AgentRunStore } from './runStore';

// The event-sink seam (H3a). The operator loop is a single shared spine
// (`runToolLoop`); this interface is how a caller chooses whether that loop's
// lifecycle is recorded as a durable, streamable run or left ephemeral.
//
//   - `emit` appends one semantic event to the run's append-only log.
//   - `transition` moves the run's status and patches its record.
//
// Two implementations exist. `StoreEventSink` binds both to an `AgentRunStore`
// for a specific run, so the agent runtime (and, in H3b, chat-as-a-run) records
// every step the same way and the existing SSE stream carries it unchanged.
// `NullEventSink` no-ops both, which is the ephemeral path.
//
// Forward door for the token-stream toggle (H3d): token deltas ride this same
// `emit` as a future `model.delta` event kind, over the same sink and the same
// SSE, so the toggle is a mode flag rather than a second transport.
export interface OperatorEventSink {
  emit(type: AgentEventType, summary: string, data?: Record<string, unknown>): Promise<void>;
  transition(status: AgentRunStatus, patch?: OperatorTransitionPatch): Promise<void>;
}

export type OperatorTransitionPatch = Partial<
  Pick<AgentRun, 'currentStep' | 'reply' | 'uiComponent' | 'pendingApproval' | 'error'>
>;

// Records the loop's lifecycle against one run in the store. This is the exact
// pair of store calls the runtime made inline before H3a, now behind the seam.
export class StoreEventSink implements OperatorEventSink {
  constructor(private readonly store: AgentRunStore, private readonly runId: string) {}

  async emit(type: AgentEventType, summary: string, data?: Record<string, unknown>): Promise<void> {
    await this.store.append(this.runId, type, summary, data);
  }

  async transition(status: AgentRunStatus, patch: OperatorTransitionPatch = {}): Promise<void> {
    await this.store.transition(this.runId, status, patch);
  }
}

// The ephemeral path: the shared loop runs, nothing is recorded or streamed.
export class NullEventSink implements OperatorEventSink {
  async emit(): Promise<void> { /* intentionally empty */ }
  async transition(): Promise<void> { /* intentionally empty */ }
}
