// test/agentLoop.test.ts
// Proves the tool loop fixes the three bugs in the old askGemini loop:
// multi-step chaining advances, all tool calls per turn run, interim text does
// not short-circuit tool use, and the turn budget terminates gracefully.

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { runToolLoop, DEFAULT_MAX_TURNS } from '../server/agentLoop';
import type { ModelTurn, AgentToolCall, ToolExecution } from '../server/agentLoop';

/** Build a callModel that returns a scripted sequence of turns. */
function scriptModel(turns: ModelTurn[]) {
  let i = 0;
  const calls: number[] = [];
  const callModel = async (): Promise<ModelTurn> => {
    calls.push(i);
    const turn = turns[Math.min(i, turns.length - 1)];
    i += 1;
    return turn;
  };
  return { callModel, callCount: () => i, calls };
}

function recorder() {
  const executed: string[] = [];
  const recorded: string[] = [];
  const executeTool = async (call: AgentToolCall): Promise<ToolExecution> => {
    executed.push(call.name);
    return { output: { ok: true, tool: call.name }, uiComponent: { type: 'Card', data: call.name } };
  };
  const recordToolResult = (call: AgentToolCall) => { recorded.push(call.name); };
  return { executed, recorded, executeTool, recordToolResult };
}

describe('runToolLoop', () => {
  it('chains multiple sequential tool calls, advancing each turn (stale-candidate bug)', async () => {
    const model = scriptModel([
      { toolCalls: [{ name: 'A', args: {} }] },
      { toolCalls: [{ name: 'B', args: {} }] },
      { text: 'done', toolCalls: [] },
    ]);
    const r = recorder();
    const result = await runToolLoop({ ...r, callModel: model.callModel });
    assert.deepStrictEqual(r.executed, ['A', 'B'], 'both tools ran, in order, not the first twice');
    assert.strictEqual(result.reply, 'done');
    assert.strictEqual(result.turnsUsed, 3);
    assert.strictEqual(result.stopReason, 'final');
  });

  it('runs every tool call within a single turn (parts[0]-only bug)', async () => {
    const model = scriptModel([
      { toolCalls: [{ name: 'A', args: {} }, { name: 'B', args: {} }] },
      { text: 'both done', toolCalls: [] },
    ]);
    const r = recorder();
    const result = await runToolLoop({ ...r, callModel: model.callModel });
    assert.deepStrictEqual(r.executed, ['A', 'B'], 'both tool calls in the turn executed');
    assert.deepStrictEqual(r.recorded, ['A', 'B']);
    assert.strictEqual(result.reply, 'both done');
  });

  it('does not short-circuit on interim text that accompanies tool calls (early-return bug)', async () => {
    const model = scriptModel([
      { text: 'let me check that', toolCalls: [{ name: 'A', args: {} }] },
      { text: 'final answer', toolCalls: [] },
    ]);
    const r = recorder();
    const result = await runToolLoop({ ...r, callModel: model.callModel });
    assert.deepStrictEqual(r.executed, ['A'], 'tool still ran despite interim text');
    assert.strictEqual(result.reply, 'final answer');
  });

  it('returns immediately when the first turn is pure text', async () => {
    const model = scriptModel([{ text: 'hello', toolCalls: [] }]);
    const r = recorder();
    const result = await runToolLoop({ ...r, callModel: model.callModel });
    assert.deepStrictEqual(r.executed, []);
    assert.strictEqual(result.reply, 'hello');
    assert.strictEqual(result.turnsUsed, 1);
  });

  it('terminates gracefully at the turn budget instead of throwing', async () => {
    const model = scriptModel([{ text: 'still working', toolCalls: [{ name: 'A', args: {} }] }]);
    const r = recorder();
    const result = await runToolLoop({ ...r, callModel: model.callModel, maxTurns: 3 });
    assert.strictEqual(result.stopReason, 'budget');
    assert.strictEqual(result.turnsUsed, 3);
    assert.strictEqual(r.executed.length, 3, 'ran the tool once per allowed turn');
    assert.ok(result.reply.length > 0, 'budget exhaustion still returns interim text');
  });

  it('propagates the last tool UI component to the result', async () => {
    const model = scriptModel([
      { toolCalls: [{ name: 'A', args: {} }] },
      { text: 'ok', toolCalls: [] },
    ]);
    const r = recorder();
    const result = await runToolLoop({ ...r, callModel: model.callModel });
    assert.deepStrictEqual(result.uiComponent, { type: 'Card', data: 'A' });
  });

  it('defaults to a bounded turn budget', () => {
    assert.ok(DEFAULT_MAX_TURNS >= 5 && DEFAULT_MAX_TURNS <= 20);
  });
});
