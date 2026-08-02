import type { AnswerProvenance } from '../provenance';

export type AgentRunStatus =
  | 'queued'
  | 'planning'
  | 'running'
  | 'waiting-approval'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'interrupted';

export type AgentEventType =
  | 'run.created'
  | 'run.started'
  | 'context.compiled'
  | 'plan.created'
  | 'model.started'
  | 'model.delta'
  | 'model.completed'
  | 'tool.started'
  | 'tool.completed'
  | 'tool.failed'
  | 'approval.required'
  | 'approval.resolved'
  | 'action.dispatched'
  | 'verification.completed'
  | 'response.completed'
  | 'run.completed'
  | 'run.failed'
  | 'run.canceled'
  | 'run.interrupted';

export interface AgentContextDescriptor {
  id: string;
  kind: string;
  label: string;
  locator: string;
  workspaceId?: string;
  access: string;
  materialization: string;
}

export interface AgentRun {
  runId: string;
  objective: string;
  status: AgentRunStatus;
  provider: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  context: AgentContextDescriptor[];
  currentStep: string | null;
  reply: string | null;
  uiComponent?: unknown;
  pendingApproval?: AgentPendingApproval;
  error?: string;
  /** Claim-to-event attribution scaffold for the reply. Empty attributions
   * until a model-side pass emits claims; see server/provenance.ts. */
  provenance?: AnswerProvenance;
}

export interface AgentPendingApproval {
  kind: 'browser-action' | 'execution';
  approvalId: string;
  capability: string;
  summary: string;
  expiresAt?: string;
}

export interface AgentEvent {
  eventId: string;
  runId: string;
  sequence: number;
  type: AgentEventType;
  timestamp: string;
  summary: string;
  data?: Record<string, unknown>;
}

export interface AgentRequest {
  /** Complete ephemeral model input, including explicitly attached material. */
  objective: string;
  /** Safe user-authored objective for the durable run record. */
  recordedObjective?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  context?: AgentContextDescriptor[];
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  risk: 'observe' | 'propose';
}

export interface AgentToolCall {
  callId: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentModelTurn {
  text: string;
  toolCalls: AgentToolCall[];
  continuationId?: string;
  provider: string;
  model: string;
}

export interface AgentModelInput {
  instruction: string;
  objective: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools: AgentToolDefinition[];
  previousResponseId?: string;
  toolOutputs?: Array<{ callId: string; output: unknown }>;
  signal?: AbortSignal;
}

export interface AgentModelProvider {
  readonly providerId: string;
  readonly modelId: string;
  generate(input: AgentModelInput): Promise<AgentModelTurn>;
}

export interface AgentToolResult {
  output: unknown;
  uiComponent?: unknown;
  requiresApproval?: boolean;
  approval?: AgentPendingApproval;
  evidence?: Record<string, unknown>;
}

export interface AgentCapability extends AgentToolDefinition {
  execute(arguments_: Record<string, unknown>): Promise<AgentToolResult>;
}

export interface AgentRunResult {
  runId: string;
  status: AgentRunStatus;
  reply: string;
  uiComponent?: unknown;
  provider: string;
  model: string;
  events: AgentEvent[];
}
