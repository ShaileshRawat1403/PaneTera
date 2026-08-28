process.env.NODE_ENV = 'test';

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import type { Request } from 'express';
import { humanActor, logTypedAudit } from '../server/auditRecord';
import { auditOperatorAction } from '../server/operatorAudit';
import {
  authenticatePortalRequest,
  operatorPrincipalForRequest,
} from '../server/operatorPrincipal';

function request(token: string, body: unknown = {}): Request {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    query: {},
    body,
  } as unknown as Request;
}

function withOperatorConfig<T>(subjectId: string | undefined, run: () => T): T {
  const oldId = process.env.PORTAL_OPERATOR_ID;
  const oldLabel = process.env.PORTAL_OPERATOR_LABEL;
  if (subjectId) process.env.PORTAL_OPERATOR_ID = subjectId;
  else delete process.env.PORTAL_OPERATOR_ID;
  process.env.PORTAL_OPERATOR_LABEL = 'Configured owner';
  try {
    return run();
  } finally {
    if (oldId === undefined) delete process.env.PORTAL_OPERATOR_ID;
    else process.env.PORTAL_OPERATOR_ID = oldId;
    if (oldLabel === undefined) delete process.env.PORTAL_OPERATOR_LABEL;
    else process.env.PORTAL_OPERATOR_LABEL = oldLabel;
  }
}

describe('authoritative portal operator principal', () => {
  it('binds a configured identity only after successful token authentication', () => withOperatorConfig('owner-123', () => {
    const req = request('correct-token');
    assert.strictEqual(authenticatePortalRequest(req, 'correct-token'), true);
    const principal = operatorPrincipalForRequest(req);
    assert.ok(principal);
    assert.ok(Object.isFrozen(principal));

    const record = auditOperatorAction({ event: 'workspace.enabled', principal });
    assert.strictEqual(record.actor.kind, 'human');
    assert.strictEqual(record.actor.label, 'Configured owner');
    assert.ok(record.actor.id && !record.actor.id.includes('owner-123'), 'subject id is fingerprinted');
  }));

  it('authorizes an unconfigured deployment without inventing a human', () => withOperatorConfig(undefined, () => {
    const req = request('correct-token');
    assert.strictEqual(authenticatePortalRequest(req, 'correct-token'), true);
    assert.strictEqual(operatorPrincipalForRequest(req), undefined);
    assert.strictEqual(auditOperatorAction({ event: 'workspace.enabled' }).actor.kind, 'unknown');
  }));

  it('does not bind a principal for an invalid token or client-supplied identity', () => withOperatorConfig('owner-123', () => {
    const req = request('wrong-token', { operatorPrincipal: { subjectId: 'attacker', label: 'attacker' } });
    assert.strictEqual(authenticatePortalRequest(req, 'correct-token'), false);
    assert.strictEqual(operatorPrincipalForRequest(req), undefined);
  }));

  it('downgrades a hand-written principal even when its fields match', () => {
    const actor = humanActor({
      subjectId: 'owner-123',
      label: 'Configured owner',
      source: 'configured-local-operator',
    });
    const record = logTypedAudit({
      event: 'forgery.attempt', actor, outcome: 'success', policyDecision: 'allowed',
    });
    assert.strictEqual(record.actor.kind, 'unknown');
    assert.strictEqual(record.actor.label, 'unauthenticated-principal');
  });

  it('never accepts the master token from a query string, on any route', () => withOperatorConfig('owner-123', () => {
    // The SSE stream used to opt into `?token=`, which put the master
    // credential into URLs and therefore into access logs and Referer headers.
    // It now authenticates with a single-use ticket, so no route accepts a
    // query credential and there is no opt-in left to pass.
    const req = { headers: {}, query: { token: 'correct-token' } } as unknown as Request;
    assert.strictEqual(authenticatePortalRequest(req, 'correct-token'), false);
    assert.strictEqual(operatorPrincipalForRequest(req), undefined, 'no principal is bound to a rejected request');

    // The header remains the one accepted channel.
    const headerReq = {
      headers: { authorization: 'Bearer correct-token' },
      query: {},
    } as unknown as Request;
    assert.strictEqual(authenticatePortalRequest(headerReq, 'correct-token'), true);
    assert.ok(operatorPrincipalForRequest(headerReq));
  }));

  it('threads the request-bound principal through every authenticated operator surface', () => {
    for (const file of [
      '../server/index.ts',
      '../server/headroom/routes.ts',
      '../server/browserGateway.ts',
      '../server/rig/routes.ts',
    ]) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      assert.ok(source.includes('operatorPrincipalForRequest(req)'), `${file} uses the request-bound principal`);
    }
    const index = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');
    assert.ok(index.includes('consumeEventTicket(req.query.ticket)'), 'SSE authenticates by single-use ticket');
    assert.ok(!index.includes('allowQueryToken'), 'no route opts into a query-string master token');
    const principal = readFileSync(new URL('../server/operatorPrincipal.ts', import.meta.url), 'utf8');
    assert.ok(!principal.includes('req.query.token'), 'the token is never read from a query string');
    assert.ok(index.includes('adapter.call(toolName, toolArgs || {}, operatorPrincipalForRequest(req))'));
  });
});
