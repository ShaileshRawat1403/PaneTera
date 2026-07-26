import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AgentRunStore } from '../server/agent/runStore';
import { AgentRuntime } from '../server/agent/runtime';
import type { AgentCapability, AgentModelInput, AgentModelProvider } from '../server/agent/types';

class ScriptedProvider implements AgentModelProvider {
  readonly providerId = 'scripted';
  readonly modelId = 'test-model';
  calls: AgentModelInput[] = [];

  async generate(input: AgentModelInput) {
    this.calls.push(input);
    if (this.calls.length === 1) {
      return {
        text: '',
        toolCalls: [{ callId: 'call-1', name: 'proposeChange', arguments: { target: 'README.md' } }],
        continuationId: 'response-1',
        provider: this.providerId,
        model: this.modelId,
      };
    }
    return {
      text: 'I prepared the exact change for your approval.',
      toolCalls: [],
      continuationId: 'response-2',
      provider: this.providerId,
      model: this.modelId,
    };
  }
}

async function main() {
  console.log('Running accountable agent runtime tests...');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-agent-runtime-'));
  try {
    const provider = new ScriptedProvider();
    const capability: AgentCapability = {
      name: 'proposeChange',
      description: 'Prepare a change proposal.',
      inputSchema: {
        type: 'object',
        properties: { target: { type: 'string' } },
        required: ['target'],
        additionalProperties: false,
      },
      risk: 'propose',
      async execute(arguments_) {
        return {
          output: { proposed: true, target: arguments_.target },
          uiComponent: { type: 'ProposedAction', data: { target: arguments_.target } },
          requiresApproval: true,
          approval: {
            kind: 'execution',
            approvalId: 'proposal-1',
            capability: 'proposeChange',
            summary: 'Change README.md',
          },
          evidence: { policyDecision: 'approval-required' },
        };
      },
    };
    const store = new AgentRunStore(root);
    const runtime = new AgentRuntime(store, provider, [capability]);
    const result = await runtime.run({
      objective: 'Update the README.\n<attached-context>private contents</attached-context>',
      recordedObjective: 'Update the README.',
      context: [{
        id: 'ctx',
        kind: 'file',
        label: 'README',
        locator: 'README.md',
        access: 'read',
        materialization: 'reference',
      }],
    });

    assert.strictEqual(result.status, 'waiting-approval');
    assert.strictEqual(result.reply, 'I prepared the exact change for your approval.');
    assert.deepStrictEqual(result.uiComponent, {
      type: 'ProposedAction',
      data: { target: 'README.md', runId: result.runId },
    });
    assert.strictEqual(store.get(result.runId)?.pendingApproval?.approvalId, 'proposal-1');
    assert.ok(result.events.some((event) => event.type === 'approval.required'));
    assert.ok(result.events.some((event) => event.type === 'context.compiled'));
    assert.strictEqual(provider.calls[1].previousResponseId, 'response-1');
    assert.deepStrictEqual(provider.calls[1].toolOutputs, [{
      callId: 'call-1',
      output: { proposed: true, target: 'README.md' },
    }]);
    assert.strictEqual(JSON.stringify(result.events).includes('Update the README.'), false);
    assert.strictEqual(store.get(result.runId)?.objective, 'Update the README.');
    console.log('Accountable agent runtime tests passed.');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
