import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AgentRunStore } from '../server/agent/runStore';

async function transientDeltasNotifyButDoNotPersist() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-stream-transport-'));
  try {
    const store = new AgentRunStore(root);
    const run = await store.create({ objective: 'stream test', provider: 'openai', model: 'test' });

    const received: string[] = [];
    const unsubscribe = store.subscribe((event) => {
      if (event.type === 'model.delta') received.push(String((event.data as { text?: string })?.text ?? ''));
    });

    store.emitTransient(run.runId, 'model.delta', 'Token.', { text: 'Hel' });
    store.emitTransient(run.runId, 'model.delta', 'Token.', { text: 'lo' });
    unsubscribe();
    store.emitTransient(run.runId, 'model.delta', 'Token.', { text: 'X' }); // after unsubscribe: ignored

    // Subscribers see the live fragments, in order, and stop after unsubscribe.
    assert.deepStrictEqual(received, ['Hel', 'lo']);

    // Nothing was persisted: the durable event log has no model.delta entries,
    // so token streaming never rewrites runs.json or bloats the record.
    const persisted = store.listEvents(run.runId);
    assert.strictEqual(persisted.some((e) => e.type === 'model.delta'), false, 'deltas must not persist');

    console.log('Stream transport (transient delta) tests passed.');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

transientDeltasNotifyButDoNotPersist().catch((error) => {
  console.error(error);
  process.exit(1);
});
