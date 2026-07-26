import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AgentRunStore } from '../server/agent/runStore';

async function main() {
  console.log('Running accountable agent run-store tests...');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-agent-store-'));
  try {
    const store = new AgentRunStore(root);
    const observedEvents: string[] = [];
    const unsubscribe = store.subscribe((event) => observedEvents.push(event.type));
    const created = await store.create({
      objective: 'Inspect the selected project',
      provider: 'test',
      model: 'test-model',
      context: [{
        id: 'context-1',
        kind: 'file',
        label: 'Configuration',
        locator: '/Users/alice/private/project/config.ts?token=top-secret',
        access: 'read',
        materialization: 'inline',
      }],
    });
    assert.strictEqual(created.status, 'queued');
    assert.deepStrictEqual(observedEvents, ['run.created']);
    assert.strictEqual(created.context[0].locator.includes('alice'), false);
    assert.strictEqual(created.context[0].locator.includes('top-secret'), false);

    await store.transition(created.runId, 'running', { currentStep: 'Inspect project' });
    await store.append(created.runId, 'tool.started', 'Using safe inspection.', {
      capability: 'inspect',
      authorization: 'must-not-persist',
    });
    assert.ok(observedEvents.includes('tool.started'));
    unsubscribe();

    const recovered = new AgentRunStore(root);
    const interrupted = recovered.get(created.runId);
    assert.strictEqual(interrupted?.status, 'interrupted');
    assert.ok(recovered.listEvents(created.runId).some((event) => event.type === 'run.interrupted'));
    const firstEvent = recovered.listEvents(created.runId)[0];
    const replay = recovered.listEventsAfter(firstEvent.eventId);
    assert.strictEqual(replay.cursorFound, true);
    assert.deepStrictEqual(
      replay.events.map((event) => event.eventId),
      recovered.listEvents(created.runId).slice(1).map((event) => event.eventId),
    );
    assert.deepStrictEqual(recovered.listEventsAfter('unknown-event'), {
      cursorFound: false,
      events: [],
    });
    const persisted = fs.readFileSync(path.join(root, 'agent', 'runs.json'), 'utf8');
    assert.strictEqual(persisted.includes('must-not-persist'), false);
    assert.strictEqual(persisted.includes('top-secret'), false);

    const approval = await recovered.create({ objective: 'Review proposal', provider: 'test', model: 'test-model' });
    await recovered.transition(approval.runId, 'waiting-approval', { currentStep: 'Waiting for approval' });
    const approvalRecovered = new AgentRunStore(root);
    assert.strictEqual(
      approvalRecovered.get(approval.runId)?.status,
      'waiting-approval',
      'A safe approval checkpoint must survive restart.',
    );

    const done = await approvalRecovered.create({ objective: 'Done', provider: 'test', model: 'test-model' });
    await approvalRecovered.transition(done.runId, 'completed', { reply: 'Complete' });
    await assert.rejects(() => approvalRecovered.transition(done.runId, 'running'), /already completed/);
    console.log('Accountable agent run-store tests passed.');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
