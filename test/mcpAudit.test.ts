// test/mcpAudit.test.ts
//
// The MCP browser façade's attribution, tested by running the real attribution
// code with a real principal rather than by reading the handlers' source.
//
// The finding this slice rests on: the MCP client principal is not bound to any
// paired browser installation. It comes from the façade's own credential
// registry, and the façade's auth even rejects the browser extension's origin.
// So an MCP call must be attributed to a distinct `mcp-client` actor, never to
// `browser-extension` merely because it reads browser evidence. These tests hold
// that line across successful, denied, and failed calls.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  browserExtensionActor,
  connectorActor,
  mcpClientActor,
} from '../server/auditRecord';
import { emitMcpFacadeAudit } from '../server/mcp/mcpAudit';
import type { McpClientPrincipal } from '../server/mcp/browserMcpAuth';

const PRINCIPAL: McpClientPrincipal = {
  clientId: 'mcp-client-alpha',
  subjectId: 'subject-1',
  scopes: ['browser.read'],
};

describe('an MCP client is not a browser extension', () => {
  it('attributes an MCP principal to a distinct mcp-client actor', () => {
    const actor = mcpClientActor(PRINCIPAL);
    assert.strictEqual(actor.kind, 'mcp-client');
    assert.strictEqual(actor.id, 'mcp-client-alpha');
    assert.notStrictEqual(actor.kind, 'browser-extension');
  });

  it('stays distinct even when it reads browser evidence', () => {
    // The whole risk: a call touching browser capabilities being labelled
    // browser-extension. The principal is not the installation, so the kinds
    // and ids must differ.
    const mcp = mcpClientActor(PRINCIPAL);
    const extension = browserExtensionActor({ installationId: 'install-1' });
    const connector = connectorActor({ connectionId: 'conn-1' });

    assert.notStrictEqual(mcp.kind, extension.kind);
    assert.notStrictEqual(mcp.kind, connector.kind);
    assert.notStrictEqual(mcp.id, extension.id);
  });

  it('scrubs a credential that arrives as a client id when emitted', () => {
    // The factory carries the id; the emit path scrubs it, like every other
    // actor field. A JWT-shaped client id must not reach a record.
    const record = emitMcpFacadeAudit({
      principal: { clientId: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature123456', subjectId: 's', scopes: [] },
      event: 'mcp.tool.call',
      policyDecision: 'allowed',
      outcome: 'success',
    });
    assert.ok(!/eyJhbGci/.test(record.actor.id ?? ''), 'a JWT-shaped client id is redacted');
  });
});

describe('the façade attributes successful, denied, and failed calls', () => {
  it('records a successful call as an allowed mcp-client action', () => {
    const record = emitMcpFacadeAudit({
      principal: PRINCIPAL,
      event: 'mcp.tool.call',
      capability: 'browser_list_captures',
      transactionId: 'txn-1',
      policyDecision: 'allowed',
      outcome: 'success',
      detail: 'Listed 3 captures',
    });

    assert.strictEqual(record.actor.kind, 'mcp-client');
    assert.strictEqual(record.actor.id, 'mcp-client-alpha');
    assert.strictEqual(record.outcome, 'success');
    assert.strictEqual(record.policyDecision, 'allowed');
    assert.strictEqual(record.details.transactionId, 'txn-1');
  });

  it('records an authorization denial as a denied mcp-client action', () => {
    const record = emitMcpFacadeAudit({
      principal: PRINCIPAL,
      event: 'mcp.tool.call',
      capability: 'browser_get_capture',
      transactionId: 'txn-2',
      policyDecision: 'denied',
      outcome: 'denied',
      detail: 'not owned by principal',
    });

    assert.strictEqual(record.actor.kind, 'mcp-client', 'still a client, even when denied');
    assert.strictEqual(record.outcome, 'denied');
    assert.strictEqual(record.policyDecision, 'denied');
  });

  it('records a failed call as an error mcp-client action', () => {
    const record = emitMcpFacadeAudit({
      principal: PRINCIPAL,
      event: 'mcp.tool.call',
      capability: 'browser_get_extraction',
      policyDecision: 'not-applicable',
      outcome: 'error',
      detail: 'read service failure',
    });

    assert.strictEqual(record.actor.kind, 'mcp-client');
    assert.strictEqual(record.outcome, 'error');
  });
});

describe('an unauthenticated call is not attributed to a client', () => {
  it('records a rejected authentication as unknown, never mcp-client', () => {
    // No principal means the server could not verify a client. Attributing the
    // line to a client it never authenticated would be a fabricated identity.
    const record = emitMcpFacadeAudit({
      principal: null,
      event: 'mcp.auth.rejected',
      capability: 'mcp.connect',
      policyDecision: 'denied',
      outcome: 'denied',
      detail: 'Invalid credential',
    });

    assert.strictEqual(record.actor.kind, 'unknown');
    assert.notStrictEqual(record.actor.kind, 'mcp-client');
    assert.strictEqual(record.actor.label, 'mcp-unauthenticated');
  });
});

describe('the façade no longer emits unattributed mcp audit lines', () => {
  it('routes every mcp emission through the attribution helper', async () => {
    // A minimal regression check, secondary to the behavioural tests above: a
    // future edit must not reintroduce a raw logAudit for an mcp event, which
    // would be an unattributed line.
    const { readFileSync } = await import('node:fs');
    for (const file of ['../server/mcp/browserOperatorServer.ts', '../server/mcp/browserMcpAuth.ts']) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      assert.ok(!/logAudit\('mcp\./.test(source), `${file} must not raw-log an mcp event`);
      assert.ok(source.includes('emitMcpFacadeAudit'), `${file} uses the attribution helper`);
    }
  });
});
