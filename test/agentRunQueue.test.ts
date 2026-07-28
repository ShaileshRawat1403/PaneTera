// test/agentRunQueue.test.ts
//
// Tests for the agent run queue with concurrency control.

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AgentRunQueue } from '../server/agent/runQueue.js';

describe('AgentRunQueue', () => {
  let queue: AgentRunQueue;

  beforeEach(() => {
    queue = new AgentRunQueue({ maxConcurrent: 2, maxQueued: 5 });
  });

  it('enqueues a run and returns it', () => {
    const run = queue.enqueue('run-1', 'Test objective');
    assert.ok(run);
    assert.equal(run.runId, 'run-1');
    assert.equal(run.status, 'pending');
    assert.equal(run.objective, 'Test objective');
  });

  it('returns null when queue is full', () => {
    for (let i = 0; i < 5; i++) {
      queue.enqueue(`run-${i}`, `Objective ${i}`);
    }
    const result = queue.enqueue('run-overflow', 'Overflow');
    assert.equal(result, null);
  });

  it('respects priority ordering', () => {
    queue.enqueue('run-low', 'Low priority', { priority: 0 });
    queue.enqueue('run-high', 'High priority', { priority: 10 });
    queue.enqueue('run-mid', 'Mid priority', { priority: 5 });

    const status = queue.getStatus();
    assert.equal(status.nextInQueue?.runId, 'run-high');
  });

  it('starts a run and moves to running', () => {
    queue.enqueue('run-1', 'Test');
    const started = queue.start('run-1');
    assert.ok(started);

    const status = queue.getStatus();
    assert.equal(status.pending, 0);
    assert.equal(status.running, 1);
  });

  it('completes a running run', () => {
    queue.enqueue('run-1', 'Test');
    queue.start('run-1');
    queue.complete('run-1', 'completed');

    const status = queue.getStatus();
    assert.equal(status.running, 0);
    assert.equal(status.completed, 1);
  });

  it('cancels a pending run', () => {
    queue.enqueue('run-1', 'Test');
    const canceled = queue.cancel('run-1');
    assert.ok(canceled);

    const run = queue.getRun('run-1');
    assert.equal(run?.status, 'canceled');
  });

  it('cancels a running run', () => {
    queue.enqueue('run-1', 'Test');
    queue.start('run-1');
    const canceled = queue.cancel('run-1');
    assert.ok(canceled);

    const status = queue.getStatus();
    assert.equal(status.running, 0);
  });

  it('emits events on enqueue, start, complete', () => {
    const events: string[] = [];
    queue.on('enqueued', () => events.push('enqueued'));
    queue.on('started', () => events.push('started'));
    queue.on('completed', () => events.push('completed'));

    queue.enqueue('run-1', 'Test');
    queue.start('run-1');
    queue.complete('run-1', 'completed');

    assert.deepEqual(events, ['enqueued', 'started', 'completed']);
  });

  it('returns runs filtered by status', () => {
    queue.enqueue('run-1', 'Test 1');
    queue.enqueue('run-2', 'Test 2');
    queue.start('run-1');
    queue.complete('run-1', 'completed');

    const pending = queue.getRuns('pending');
    const running = queue.getRuns('running');
    const completed = queue.getRuns('completed');

    assert.equal(pending.length, 1);
    assert.equal(running.length, 0);
    assert.equal(completed.length, 1);
  });

  it('updates config at runtime', () => {
    queue.updateConfig({ maxConcurrent: 4 });
    const status = queue.getStatus();
    assert.equal(status.maxConcurrent, 4);
  });
});
