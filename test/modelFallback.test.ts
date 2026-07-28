// test/modelFallback.test.ts
//
// Tests for the model fallback chain.

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ModelFallbackChain } from '../server/agent/modelFallback.js';

describe('ModelFallbackChain', () => {
  let chain: ModelFallbackChain;

  beforeEach(() => {
    chain = new ModelFallbackChain();
    chain.clearHistory();
    chain.registerChain(
      {
        id: 'primary',
        provider: 'openai',
        model: 'gpt-4o',
        priority: 10,
        maxRetries: 3,
        timeoutMs: 5000,
        enabled: true,
      },
      [
        {
          id: 'fallback-1',
          provider: 'anthropic',
          model: 'claude-3',
          priority: 5,
          maxRetries: 3,
          timeoutMs: 5000,
          enabled: true,
        },
        {
          id: 'fallback-2',
          provider: 'google',
          model: 'gemini-pro',
          priority: 1,
          maxRetries: 3,
          timeoutMs: 5000,
          enabled: true,
        },
      ]
    );
  });

  it('executes primary model on success', async () => {
    const result = await chain.execute('primary', async () => 'success');
    assert.ok(result.success);
    assert.equal(result.finalModel, 'primary');
    assert.equal(result.response, 'success');
    assert.equal(result.attempts.length, 1);
  });

  it('falls back to secondary on primary failure', async () => {
    let callCount = 0;
    const result = await chain.execute('primary', async (config) => {
      callCount++;
      if (config.id === 'primary') {
        throw new Error('Primary failed');
      }
      return `success from ${config.id}`;
    });

    assert.ok(result.success);
    assert.equal(result.finalModel, 'fallback-1');
    assert.equal(result.response, 'success from fallback-1');
    assert.equal(result.attempts.length, 2);
    assert.equal(result.attempts[0].success, false);
    assert.equal(result.attempts[1].success, true);
  });

  it('falls back through all models', async () => {
    const result = await chain.execute('primary', async () => {
      throw new Error('All fail');
    });

    assert.equal(result.success, false);
    assert.equal(result.attempts.length, 3);
    assert.ok(result.error?.includes('All models failed'));
  });

  it('returns error for unknown primary model', async () => {
    const result = await chain.execute('unknown', async () => 'test');
    assert.equal(result.success, false);
    assert.ok(result.error?.includes('No fallback chain'));
  });

  it('respects max attempts', async () => {
    const result = await chain.execute(
      'primary',
      async () => {
        throw new Error('Fail');
      },
      { maxAttempts: 1 }
    );

    assert.equal(result.success, false);
    assert.equal(result.attempts.length, 1);
  });

  it('tracks history', async () => {
    await chain.execute('primary', async () => 'ok');
    await chain.execute('primary', async () => {
      throw new Error('fail');
    });

    const history = chain.getHistory();
    assert.equal(history.length, 4); // 1 success + 3 failures (primary + 2 fallbacks)
  });

  it('returns stats', async () => {
    await chain.execute('primary', async () => 'ok');
    await chain.execute('primary', async () => {
      throw new Error('fail');
    });

    const stats = chain.getStats();
    assert.equal(stats.totalAttempts, 4);
    assert.ok(stats.successRate > 0);
    assert.ok(stats.byModel['gpt-4o']);
  });

  it('clears history', async () => {
    await chain.execute('primary', async () => 'ok');
    chain.clearHistory();
    const history = chain.getHistory();
    assert.equal(history.length, 0);
  });
});
