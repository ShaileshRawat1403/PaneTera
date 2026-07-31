// server/agentLoop.ts
//
// Provider-agnostic tool-use loop for the chat operator. It replaces the
// hand-rolled loop inside askGemini, which had three correctness bugs:
//   1. it returned on the first turn's text and never called tools;
//   2. it re-read the original model response every iteration, so any chain
//      past the first tool call re-ran the first tool;
//   3. it only inspected the first response part, dropping tool calls that
//      arrived alongside text or in later parts.
//
// This loop is deliberately ignorant of any provider. The caller supplies three
// closures that own the conversation state:
//   - callModel:        send the current conversation, append the assistant
//                       turn to it, and return the parsed ModelTurn.
//   - executeTool:      run one tool call and return its output (+ optional UI).
//   - recordToolResult: append the tool result to the conversation so the next
//                       callModel sees it.
// Because callModel is re-invoked each turn against the mutated conversation,
// multi-step chaining advances correctly.

export interface AgentToolCall {
  name: string;
  args: Record<string, unknown>;
  /** Provider correlation id (e.g. OpenAI tool_call_id). Optional; Gemini has none. */
  id?: string;
}

export interface ModelTurn {
  /** Final or interim natural-language text, if the model produced any. */
  text?: string | null;
  /** Tool calls the model requested this turn. Empty means the turn is final. */
  toolCalls: AgentToolCall[];
}

export interface ToolExecution {
  output: unknown;
  uiComponent?: unknown;
}

export interface RunToolLoopOptions {
  callModel: () => Promise<ModelTurn>;
  executeTool: (call: AgentToolCall) => Promise<ToolExecution>;
  recordToolResult: (call: AgentToolCall, execution: ToolExecution) => void;
  maxTurns?: number;
}

export interface ToolLoopResult {
  reply: string;
  uiComponent?: unknown;
  turnsUsed: number;
  stopReason: 'final' | 'budget';
}

export const DEFAULT_MAX_TURNS = 8;

export async function runToolLoop(opts: RunToolLoopOptions): Promise<ToolLoopResult> {
  const maxTurns = Math.max(1, opts.maxTurns ?? DEFAULT_MAX_TURNS);
  let lastUiComponent: unknown;
  let lastText = '';

  for (let turn = 0; turn < maxTurns; turn++) {
    const modelTurn = await opts.callModel();
    if (typeof modelTurn.text === 'string' && modelTurn.text.trim()) {
      lastText = modelTurn.text;
    }

    // A turn with no tool calls is the final answer, regardless of whether it
    // also carried interim text on earlier turns.
    if (!modelTurn.toolCalls || modelTurn.toolCalls.length === 0) {
      return {
        reply: (modelTurn.text ?? '').trim(),
        uiComponent: lastUiComponent,
        turnsUsed: turn + 1,
        stopReason: 'final',
      };
    }

    // Execute every tool call the model asked for this turn, in order.
    for (const call of modelTurn.toolCalls) {
      const execution = await opts.executeTool(call);
      if (execution.uiComponent !== undefined) {
        lastUiComponent = execution.uiComponent;
      }
      opts.recordToolResult(call, execution);
    }
  }

  // Budget exhausted. Return the best interim text rather than throwing, so the
  // user gets partial progress and can ask to continue.
  return {
    reply: (lastText
      || 'I reached the tool-step limit before finishing. Here is what I have so far; ask me to continue.').trim(),
    uiComponent: lastUiComponent,
    turnsUsed: maxTurns,
    stopReason: 'budget',
  };
}
