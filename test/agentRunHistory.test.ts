// test/agentRunHistory.test.ts
//
// Tests for the agent run history store.

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RunHistory } from '../server/agent/runHistory.js';

describe('RunHistory', () => {
  let history: RunHistory;

  beforeEach(() => {
    history = new RunHistory();
    history.clear(); // Start fresh
  });

  it('records a completed run', () => {
    history.record({
      runId: 'run-1',
      objective: 'Test objective',
      status: 'completed',
      events: [],
      startedAt: Date.now() - 1000,
      completedAt: Date.now(),
      duration: 1000,
    });

    const run = history.get('run-1');
    assert.ok(run);
    assert.equal(run.status, 'completed');
  });

  it('queries runs by status', () => {
    history.record({
      runId: 'run-1',
      objective: 'Test 1',
      status: 'completed',
      events: [],
      startedAt: Date.now() - 2000,
      completedAt: Date.now() - 1000,
      duration: 1000,
    });

    history.record({
      runId: 'run-2',
      objective: 'Test 2',
      status: 'failed',
      events: [],
      startedAt: Date.now() - 1000,
      completedAt: Date.now(),
      duration: 1000,
    });

    const completed = history.query({ status: 'completed' });
    const failed = history.query({ status: 'failed' });

    assert.equal(completed.total, 1);
    assert.equal(failed.total, 1);
  });

  it('queries runs by model', () => {
    history.record({
      runId: 'run-1',
      objective: 'Test 1',
      status: 'completed',
      events: [],
      model: 'gpt-4o',
      startedAt: Date.now() - 1000,
      completedAt: Date.now(),
      duration: 1000,
    });

    history.record({
      runId: 'run-2',
      objective: 'Test 2',
      status: 'completed',
      events: [],
      model: 'claude-3',
      startedAt: Date.now() - 1000,
      completedAt: Date.now(),
      duration: 1000,
    });

    const gptRuns = history.query({ model: 'gpt-4o' });
    assert.equal(gptRuns.total, 1);
  });

  it('returns replay data', () => {
    history.record({
      runId: 'run-1',
      objective: 'Test objective',
      status: 'completed',
      events: [{ type: 'test' }],
      startedAt: Date.now() - 1000,
      completedAt: Date.now(),
      duration: 1000,
    });

    const replay = history.getReplayData('run-1');
    assert.ok(replay);
    assert.equal(replay.replay.objective, 'Test objective');
    assert.equal(replay.replay.events.length, 1);
  });

  it('returns stats', () => {
    history.record({
      runId: 'run-1',
      objective: 'Test 1',
      status: 'completed',
      events: [],
      model: 'gpt-4o',
      startedAt: Date.now() - 1000,
      completedAt: Date.now(),
      duration: 1000,
    });

    history.record({
      runId: 'run-2',
      objective: 'Test 2',
      status: 'failed',
      events: [],
      startedAt: Date.now() - 500,
      completedAt: Date.now(),
      duration: 500,
    });

    const stats = history.getStats();
    assert.equal(stats.total, 2);
    assert.equal(stats.byStatus['completed'], 1);
    assert.equal(stats.byStatus['failed'], 1);
    assert.equal(stats.byModel['gpt-4o'], 1);
  });

  it('paginates results', () => {
    for (let i = 0; i < 10; i++) {
      history.record({
        runId: `run-${i}`,
        objective: `Test ${i}`,
        status: 'completed',
        events: [],
        startedAt: Date.now() - 1000,
        completedAt: Date.now(),
        duration: 1000,
      });
    }

    const page1 = history.query({ limit: 3, offset: 0 });
    const page2 = history.query({ limit: 3, offset: 3 });

    assert.equal(page1.runs.length, 3);
    assert.equal(page2.runs.length, 3);
    assert.equal(page1.total, 10);
  });

  it('clears history', () => {
    history.record({
      runId: 'run-1',
      objective: 'Test',
      status: 'completed',
      events: [],
      startedAt: Date.now(),
      completedAt: Date.now(),
      duration: 0,
    });

    history.clear();
    const stats = history.getStats();
    assert.equal(stats.total, 0);
  });
});
