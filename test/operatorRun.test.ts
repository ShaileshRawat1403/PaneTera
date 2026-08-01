import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AgentRunStore } from '../server/agent/runStore';
import { runOperatorAsRun } from '../server/operatorRun';
import type { ModelTurn, AgentToolCall, ToolExecution } from '../server/agentLoop';
import type { OperatorToolOutcome } from '../server/operatorRun';

async function plainAnswerReachesCompleted(root: string) {
  const store = new AgentRunStore(root);
  let calls = 0;
  const result = await runOperatorAsRun({
    store,
    provider: 'openai',
    model: 'test-model',
    objective: 'What does readFileSafe do?\n<attached>secret material</attached>',
    recordedObjective: 'What does readFileSafe do?',
    handlers: {
      callModel: async (): Promise<ModelTurn> => {
        calls += 1;
        return { text: 'It reads an allowlisted file.', toolCalls: [] };
      },
      executeTool: async (): Promise<OperatorToolOutcome> => ({ output: {} }),
      recordToolResult: () => undefined,
    },
  });

  assert.strictEqual(calls, 1, 'a plain answer needs exactly one model turn');
  assert.strictEqual(result.status, 'completed');
  assert.strictEqual(result.reply, 'It reads an allowlisted file.');

  const events = store.listEvents(result.runId).map((e) => e.type);
  for (const expected of ['run.started', 'model.started', 'model.completed', 'response.completed', 'run.completed']) {
    assert.ok(events.includes(expected as never), `missing ${expected}`);
  }
  assert.ok(!events.includes('tool.started' as never), 'a plain answer runs no tools');
  assert.strictEqual(store.get(result.runId)?.status, 'completed');

  // The ephemeral attached material must never be persisted in the durable record.
  assert.strictEqual(store.get(result.runId)?.objective, 'What does readFileSafe do?');
  assert.strictEqual(JSON.stringify(store.listEvents(result.runId)).includes('secret material'), false);
}

async function toolProposalReachesWaitingApproval(root: string) {
  const store = new AgentRunStore(root);
  const turns: ModelTurn[] = [
    { text: '', toolCalls: [{ name: 'proposeExecution', args: { command: 'npm run build' } }] },
    { text: 'I prepared the exact command for your approval.', toolCalls: [] },
  ];
  let index = 0;
  const recorded: AgentToolCall[] = [];

  const result = await runOperatorAsRun({
    store,
    provider: 'openai',
    model: 'test-model',
    objective: 'Build the project.',
    handlers: {
      callModel: async (): Promise<ModelTurn> => turns[index++],
      executeTool: async (call: AgentToolCall): Promise<OperatorToolOutcome> => ({
        output: { proposed: true, command: call.args.command },
        uiComponent: { type: 'ProposedAction', data: { command: call.args.command } },
        requiresApproval: true,
        approval: { kind: 'execution', approvalId: 'prop-1', capability: 'proposeExecution', summary: 'Run npm run build' },
      }),
      recordToolResult: (call: AgentToolCall, _execution: ToolExecution) => { recorded.push(call); },
    },
  });

  assert.strictEqual(result.status, 'waiting-approval');
  assert.strictEqual(result.reply, 'I prepared the exact command for your approval.');
  assert.strictEqual(recorded.length, 1, 'the tool result was recorded for the next turn');

  // The approval component carries this exact run so its controls act on it.
  assert.deepStrictEqual(result.uiComponent, {
    type: 'ProposedAction',
    data: { command: 'npm run build', runId: result.runId },
  });
  assert.strictEqual(store.get(result.runId)?.pendingApproval?.approvalId, 'prop-1');

  const events = store.listEvents(result.runId).map((e) => e.type);
  assert.ok(events.includes('approval.required' as never), 'a proposal emits approval.required');
  assert.ok(!events.includes('run.completed' as never), 'a waiting run is not completed');
  assert.strictEqual(store.get(result.runId)?.status, 'waiting-approval');
}

async function main() {
  console.log('Running operator-run (H3b chat-as-a-run) tests...');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-operator-run-'));
  try {
    await plainAnswerReachesCompleted(root);
    await toolProposalReachesWaitingApproval(root);
    console.log('Operator-run tests passed.');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
