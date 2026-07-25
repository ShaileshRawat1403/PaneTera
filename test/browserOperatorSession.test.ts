process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { BrowserOperatorSessionStore } from '../server/mcp/browserOperatorServer';
import type { McpClientPrincipal } from '../server/mcp/browserMcpAuth';

describe('BrowserOperatorSessionStore unit tests', () => {
  it('creates and reuses active sessions within 5-minute TTL', () => {
    const store = new BrowserOperatorSessionStore(300_000);
    const principal: McpClientPrincipal = {
      clientId: 'client-1',
      subjectId: 'user-101',
      scopes: ['read', 'write'],
    };

    // First lookup creates session
    const session1 = store.getOrCreateSession(principal, 'tx-1');
    assert.ok(session1);
    assert.strictEqual(store.getSessionCount(), 1);

    // Second lookup with same principal reuses session
    const session2 = store.getOrCreateSession(principal, 'tx-2');
    assert.strictEqual(session1.sessionId, session2.sessionId);
    assert.strictEqual(store.getSessionCount(), 1);

    store.close();
  });

  it('expires sessions after TTL duration', () => {
    // 10ms short TTL for test
    const store = new BrowserOperatorSessionStore(10);
    const principal: McpClientPrincipal = {
      clientId: 'client-short-ttl',
      subjectId: 'user-short-ttl',
      scopes: ['read'],
    };

    const session1 = store.getOrCreateSession(principal, 'tx-1');
    assert.ok(session1);

    // Wait 25ms for TTL expiry
    const start = Date.now();
    while (Date.now() - start < 25) { /* spin wait */ }

    // Next lookup should create a new session
    const session2 = store.getOrCreateSession(principal, 'tx-2');
    assert.ok(session2);
    assert.strictEqual(store.getSessionCount(), 1);

    store.close();
  });
});
