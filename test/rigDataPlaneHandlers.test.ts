// test/rigDataPlaneHandlers.test.ts
//
// Handler-level tests for the Rig data plane: invocation, resource read, and
// prompt get. The prior slice tested only the classification table in isolation,
// so a route that failed to emit on a real rejection or failure path would have
// gone unnoticed. These drive every terminal outcome through the actual exported
// handlers, with injected stub dependencies, and read the record back from the
// audit log by its correlation connectionId.
//
// The four review findings each have a test that fails if the fix regresses:
//   #1 audit is emitted before best-effort health, and survives a registry
//      failure during degradation.
//   #3 a consumption failure after a successful call is finalization, not the
//      connector call.
//   #4 an invalid target, a denied resource, and denied/invalid prompt args each
//      produce exactly one terminal record instead of none.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  handleInvocation,
  handleResourceRead,
  handlePromptGet,
  handleTransportFailure,
  emitConnectFailure,
  type RigDataDeps,
  type RigLifecycleDeps,
} from '../server/rig/routes';
import type { CapabilityCard, McpConnection } from '../server/rig/types';
import type { Request } from 'express';
import { authenticatePortalRequest, operatorPrincipalForRequest } from '../server/operatorPrincipal';

const AUDIT_LOG = fileURLToPath(new URL('../server/audit.log', import.meta.url));

/** Every typed record whose correlation connectionId matches, read back from the log. */
function recordsForConnection(connectionId: string): Record<string, unknown>[] {
  if (!existsSync(AUDIT_LOG)) return [];
  const lines = readFileSync(AUDIT_LOG, 'utf8').trim().split('\n');
  const found: Record<string, unknown>[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if ((parsed?.correlation as { connectionId?: string })?.connectionId === connectionId) found.push(parsed);
    } catch {
      // ignore an unparsable line
    }
  }
  return found;
}

let counter = 0;
/** A connectionId unique to one test, so its records are isolated in the shared log. */
function freshId(tag: string): string {
  counter += 1;
  return `conn-${tag}-${counter}-${Math.random().toString(36).slice(2)}`;
}

function makeCapability(kind: CapabilityCard['kind'], overrides: Partial<CapabilityCard> = {}): CapabilityCard {
  return {
    capabilityId: 'cap-1',
    kind,
    name: `${kind}-name`,
    label: kind,
    description: { source: 'schema-derived', text: '' },
    inputSchema: null,
    rawDeclaration: kind === 'resource' ? { uri: 'file:///x' } : {},
    permission: 'auto-invocable',
    enabled: true,
    structuralDigest: 'digest-1',
    presentationDigest: 'digest-1',
    ...overrides,
  };
}

function makeConnection(connectionId: string, capability: CapabilityCard): McpConnection {
  return {
    connectionId,
    displayName: 'Test Connection',
    sourceClass: 'local-user-installed',
    transport: { kind: 'stdio', command: 'x', args: [], env: {} },
    endpointRef: 'ref',
    executableDigest: null,
    entryPointDigest: null,
    launchSpecDigest: null,
    state: 'connected',
    health: { state: 'current', lastSuccessfulContact: null },
    capabilities: {
      tools: capability.kind === 'tool' ? [capability] : [],
      resources: capability.kind === 'resource' ? [capability] : [],
      prompts: capability.kind === 'prompt' ? [capability] : [],
      structuralDigest: 'snap',
      presentationDigest: 'snap',
      discoveredAt: null,
      truncated: false,
    },
    createdAt: 'now',
    updatedAt: 'now',
    connectionApprovalId: null,
  } as unknown as McpConnection;
}

interface DepsOptions {
  connection?: McpConnection | null;
  callTool?: RigDataDeps['runtime']['callTool'];
  readResource?: RigDataDeps['runtime']['readResource'];
  getPrompt?: RigDataDeps['runtime']['getPrompt'];
  claim?: RigDataDeps['approvals']['claim'];
  consume?: RigDataDeps['approvals']['consume'];
  updateThrows?: boolean;
  getThrows?: boolean;
}

function makeDeps(options: DepsOptions): { deps: RigDataDeps; consumed: string[]; appended: unknown[] } {
  const consumed: string[] = [];
  const appended: unknown[] = [];
  const deps: RigDataDeps = {
    registry: {
      get: () => {
        if (options.getThrows) throw new Error('registry read failed');
        return options.connection ?? null;
      },
      update: (async (_id: string, updater: (value: McpConnection) => McpConnection) => {
        if (options.updateThrows) throw new Error('registry update failed');
        if (options.connection) updater(options.connection);
        return options.connection;
      }) as never,
    } as never,
    runtime: {
      callTool: options.callTool ?? (async () => ({ ok: true })),
      readResource: options.readResource ?? (async () => ({ ok: true })),
      getPrompt: options.getPrompt ?? (async () => ({ ok: true })),
    } as never,
    approvals: {
      claim:
        options.claim ??
        ((() => ({ approval: { proposalId: 'prop-1', approvalId: 'appr-1' }, claimId: 'claim-1' })) as never),
      consume: (options.consume ?? ((approvalId: string) => { consumed.push(approvalId); })) as never,
    } as never,
    provenance: { append: (record: unknown) => { appended.push(record); } } as never,
  };
  return { deps, consumed, appended };
}

const actorKind = (record: Record<string, unknown>) => (record.actor as { kind: string }).kind;

describe('invocation handler emits exactly one terminal record per attempted action', () => {
  it('records a successful tool call as the connector, allowed', async () => {
    const connectionId = freshId('inv-ok');
    const { deps, consumed } = makeDeps({ connection: makeConnection(connectionId, makeCapability('tool')) });

    const result = await handleInvocation(deps, { connectionId, capabilityId: 'cap-1', approvalId: 'appr-1', arguments: {} });
    assert.strictEqual(result.status, 200);

    const records = recordsForConnection(connectionId);
    assert.strictEqual(records.length, 1, 'exactly one terminal record');
    assert.strictEqual(records[0].event, 'rig.invocation.completed');
    assert.strictEqual(actorKind(records[0]), 'connector');
    assert.strictEqual(records[0].outcome, 'success');
    assert.strictEqual(records[0].policyDecision, 'allowed');
    assert.deepStrictEqual(consumed, ['appr-1'], 'the claim is consumed once on success');
  });

  it('records an approval-claim rejection as the operator, denied (#4 pre-call)', async () => {
    const connectionId = freshId('inv-claim');
    const { deps } = makeDeps({
      connection: makeConnection(connectionId, makeCapability('tool')),
      claim: (() => { throw new Error('approval not found'); }) as never,
    });

    const result = await handleInvocation(deps, { connectionId, capabilityId: 'cap-1', approvalId: 'nope', arguments: {} });
    assert.strictEqual(result.status, 409);

    const records = recordsForConnection(connectionId);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(actorKind(records[0]), 'unknown');
    assert.strictEqual((records[0].actor as { label: string }).label, 'operator-unattributed');
    assert.strictEqual(records[0].outcome, 'denied');
    assert.strictEqual(records[0].policyDecision, 'denied');
    assert.strictEqual((records[0].details as { phase: string }).phase, 'approval-claim');
  });

  it('records a connector-call failure as the system, error, and releases the claim', async () => {
    const connectionId = freshId('inv-call');
    const { deps, consumed } = makeDeps({
      connection: makeConnection(connectionId, makeCapability('tool')),
      callTool: (async () => { throw new Error('connector exploded'); }) as never,
    });

    const result = await handleInvocation(deps, { connectionId, capabilityId: 'cap-1', approvalId: 'appr-1', arguments: {} });
    assert.strictEqual(result.status, 409);

    const records = recordsForConnection(connectionId);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(actorKind(records[0]), 'system');
    assert.strictEqual(records[0].outcome, 'error');
    assert.strictEqual((records[0].details as { phase: string }).phase, 'connector-call');
    assert.deepStrictEqual(consumed, ['appr-1'], 'a failed call still releases the claim');
  });

  it('attributes a consumption failure after a successful call to finalization, not the call (#3)', async () => {
    const connectionId = freshId('inv-consume');
    const { deps } = makeDeps({
      connection: makeConnection(connectionId, makeCapability('tool')),
      callTool: (async () => ({ ok: true })) as never,
      consume: (() => { throw new Error('consume failed'); }) as never,
    });

    const result = await handleInvocation(deps, { connectionId, capabilityId: 'cap-1', approvalId: 'appr-1', arguments: {} });
    assert.strictEqual(result.status, 409);

    const records = recordsForConnection(connectionId);
    assert.strictEqual(records.length, 1, 'no success plus a failure, exactly one record');
    assert.strictEqual((records[0].details as { phase: string }).phase, 'local-finalization', 'a successful call is never blamed');
    assert.strictEqual(actorKind(records[0]), 'system');
    assert.strictEqual(records[0].outcome, 'error');
  });

  it('audits an invalid target as the operator, denied, instead of returning silently (#4)', async () => {
    const connectionId = freshId('inv-target');
    const { deps } = makeDeps({ connection: null });

    const result = await handleInvocation(deps, { connectionId, capabilityId: 'missing', approvalId: 'appr-1', arguments: {} });
    assert.strictEqual(result.status, 409);

    const records = recordsForConnection(connectionId);
    assert.strictEqual(records.length, 1, 'an invalid target is audited, not silent');
    assert.strictEqual(records[0].event, 'rig.invocation.failed');
    assert.strictEqual(actorKind(records[0]), 'unknown');
    assert.strictEqual(records[0].outcome, 'denied');
    assert.strictEqual((records[0].details as { phase: string }).phase, 'target-invalid');
  });

  it('emits the terminal record even when health degradation itself fails (#1)', async () => {
    const connectionId = freshId('inv-health');
    const { deps } = makeDeps({
      connection: makeConnection(connectionId, makeCapability('tool')),
      callTool: (async () => { throw new Error('connector exploded'); }) as never,
      updateThrows: true,
    });

    const result = await handleInvocation(deps, { connectionId, capabilityId: 'cap-1', approvalId: 'appr-1', arguments: {} });
    assert.strictEqual(result.status, 409);

    const records = recordsForConnection(connectionId);
    assert.strictEqual(records.length, 1, 'a failing health update does not erase the audit');
    assert.strictEqual(records[0].event, 'rig.invocation.failed');
    assert.strictEqual(actorKind(records[0]), 'system');
  });

  it('audits a registry lookup failure as the system, not silently (#1 boundary)', async () => {
    const connectionId = freshId('inv-lookup');
    const { deps } = makeDeps({ getThrows: true });

    const result = await handleInvocation(deps, { connectionId, capabilityId: 'cap-1', approvalId: 'appr-1', arguments: {} });
    assert.strictEqual(result.status, 500);

    const records = recordsForConnection(connectionId);
    assert.strictEqual(records.length, 1, 'a corrupt registry read is audited, not silent');
    assert.strictEqual(records[0].event, 'rig.invocation.failed');
    assert.strictEqual(actorKind(records[0]), 'system');
    assert.strictEqual(records[0].outcome, 'error');
    assert.strictEqual((records[0].details as { phase: string }).phase, 'registry-lookup');
  });

  it('records a response that cannot be serialized as a finalization error, never a success (#3)', async () => {
    const connectionId = freshId('inv-serialize');
    // The digest walk succeeds, but JSON.stringify invokes toJSON and throws, so
    // the failure happens precisely at response serialization. If success were
    // emitted before the payload is built, this would leave a success record
    // beside the failure. It must not.
    const unserializable = { ok: true, toJSON() { throw new Error('cannot serialize response'); } };
    const { deps, appended } = makeDeps({
      connection: makeConnection(connectionId, makeCapability('tool')),
      callTool: (async () => unserializable) as never,
    });

    const result = await handleInvocation(deps, { connectionId, capabilityId: 'cap-1', approvalId: 'appr-1', arguments: {} });
    assert.strictEqual(result.status, 409, 'a response that cannot be built is an error, not a success');

    const records = recordsForConnection(connectionId);
    assert.strictEqual(records.length, 1, 'exactly one record, not a success plus an error');
    assert.ok(!records.some((r) => r.outcome === 'success'), 'no success record for a response that never built');
    assert.strictEqual(records[0].event, 'rig.invocation.failed');
    assert.strictEqual((records[0].details as { phase: string }).phase, 'local-finalization');
    assert.strictEqual(appended.length, 0, 'an unserializable response leaves no verified provenance record');
  });
});

describe('resource read handler', () => {
  it('records a successful read as the connector, allowed', async () => {
    const connectionId = freshId('res-ok');
    const { deps } = makeDeps({ connection: makeConnection(connectionId, makeCapability('resource')) });

    const result = await handleResourceRead(deps, { connectionId, capabilityId: 'cap-1' });
    assert.strictEqual(result.status, 200);

    const records = recordsForConnection(connectionId);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].event, 'rig.resource.read');
    assert.strictEqual(actorKind(records[0]), 'connector');
    assert.strictEqual(records[0].outcome, 'success');
  });

  it('audits a denied resource as the operator, denied, instead of returning silently (#4)', async () => {
    const connectionId = freshId('res-denied');
    const { deps } = makeDeps({ connection: makeConnection(connectionId, makeCapability('resource', { permission: 'denied' })) });

    const result = await handleResourceRead(deps, { connectionId, capabilityId: 'cap-1' });
    assert.strictEqual(result.status, 403);

    const records = recordsForConnection(connectionId);
    assert.strictEqual(records.length, 1, 'a denial is audited, not silent');
    assert.strictEqual(records[0].event, 'rig.resource.denied');
    assert.strictEqual(actorKind(records[0]), 'unknown');
    assert.strictEqual(records[0].outcome, 'denied');
    assert.strictEqual(records[0].policyDecision, 'denied');
  });

  it('attributes an operator denial to the authenticated configured principal', async () => {
    const oldId = process.env.PORTAL_OPERATOR_ID;
    const oldLabel = process.env.PORTAL_OPERATOR_LABEL;
    process.env.PORTAL_OPERATOR_ID = 'rig-owner';
    process.env.PORTAL_OPERATOR_LABEL = 'Rig owner';
    try {
      const req = { headers: { authorization: 'Bearer test-token' }, query: {} } as unknown as Request;
      assert.strictEqual(authenticatePortalRequest(req, 'test-token'), true);
      const principal = operatorPrincipalForRequest(req);
      assert.ok(principal);

      const connectionId = freshId('res-human-denied');
      const { deps } = makeDeps({ connection: makeConnection(connectionId, makeCapability('resource', { permission: 'denied' })) });
      const result = await handleResourceRead(deps, { connectionId, capabilityId: 'cap-1' }, principal);
      assert.strictEqual(result.status, 403);

      const records = recordsForConnection(connectionId);
      assert.strictEqual(records.length, 1);
      assert.strictEqual(records[0].event, 'rig.resource.denied');
      assert.strictEqual(actorKind(records[0]), 'human');
      assert.strictEqual((records[0].actor as { label?: string }).label, 'Rig owner');
      assert.strictEqual(records[0].policyDecision, 'denied');
    } finally {
      if (oldId === undefined) delete process.env.PORTAL_OPERATOR_ID;
      else process.env.PORTAL_OPERATOR_ID = oldId;
      if (oldLabel === undefined) delete process.env.PORTAL_OPERATOR_LABEL;
      else process.env.PORTAL_OPERATOR_LABEL = oldLabel;
    }
  });

  it('records a runtime failure as the system, error, even when health degradation fails (#1)', async () => {
    const connectionId = freshId('res-fail');
    const { deps } = makeDeps({
      connection: makeConnection(connectionId, makeCapability('resource')),
      readResource: (async () => { throw new Error('read exploded'); }) as never,
      updateThrows: true,
    });

    const result = await handleResourceRead(deps, { connectionId, capabilityId: 'cap-1' });
    assert.strictEqual(result.status, 502);

    const records = recordsForConnection(connectionId);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].event, 'rig.resource.failed');
    assert.strictEqual(actorKind(records[0]), 'system');
    assert.strictEqual(records[0].outcome, 'error');
  });

  it('audits a resource with no fixed URI as a local failure, not a policy denial (#4)', async () => {
    const connectionId = freshId('res-nouri');
    const { deps } = makeDeps({
      connection: makeConnection(connectionId, makeCapability('resource', { rawDeclaration: {} })),
    });

    const result = await handleResourceRead(deps, { connectionId, capabilityId: 'cap-1' });
    assert.strictEqual(result.status, 422);

    const records = recordsForConnection(connectionId);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].event, 'rig.resource.failed', 'a missing declaration URI is a failure, not a denial');
    assert.strictEqual(actorKind(records[0]), 'system');
    assert.strictEqual(records[0].outcome, 'error');
    assert.strictEqual(records[0].policyDecision, 'allowed');
  });

  it('audits a registry lookup failure as the system, not silently (#1 boundary)', async () => {
    const connectionId = freshId('res-lookup');
    const { deps } = makeDeps({ getThrows: true });

    const result = await handleResourceRead(deps, { connectionId, capabilityId: 'cap-1' });
    assert.strictEqual(result.status, 500);

    const records = recordsForConnection(connectionId);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].event, 'rig.resource.failed');
    assert.strictEqual(actorKind(records[0]), 'system');
  });
});

describe('prompt get handler', () => {
  it('records a successful get as the connector, allowed', async () => {
    const connectionId = freshId('prompt-ok');
    const { deps } = makeDeps({ connection: makeConnection(connectionId, makeCapability('prompt')) });

    const result = await handlePromptGet(deps, { connectionId, capabilityId: 'cap-1', arguments: { topic: 'x' } });
    assert.strictEqual(result.status, 200);

    const records = recordsForConnection(connectionId);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].event, 'rig.prompt.read');
    assert.strictEqual(actorKind(records[0]), 'connector');
    assert.strictEqual(records[0].outcome, 'success');
  });

  it('audits a denied prompt as the operator, denied (#4)', async () => {
    const connectionId = freshId('prompt-denied');
    const { deps } = makeDeps({ connection: makeConnection(connectionId, makeCapability('prompt', { permission: 'denied' })) });

    const result = await handlePromptGet(deps, { connectionId, capabilityId: 'cap-1', arguments: { topic: 'x' } });
    assert.strictEqual(result.status, 403);

    const records = recordsForConnection(connectionId);
    assert.strictEqual(records.length, 1, 'a denial is audited, not silent');
    assert.strictEqual(records[0].event, 'rig.prompt.denied');
    assert.strictEqual(actorKind(records[0]), 'unknown');
    assert.strictEqual(records[0].outcome, 'denied');
  });

  it('audits invalid prompt arguments as a validation error, not a policy denial (#4)', async () => {
    const connectionId = freshId('prompt-args');
    const { deps } = makeDeps({ connection: makeConnection(connectionId, makeCapability('prompt')) });

    const result = await handlePromptGet(deps, { connectionId, capabilityId: 'cap-1', arguments: { topic: 123 } });
    assert.strictEqual(result.status, 422);

    const records = recordsForConnection(connectionId);
    assert.strictEqual(records.length, 1, 'invalid arguments are audited, not silent');
    assert.strictEqual(records[0].event, 'rig.prompt.invalid');
    assert.strictEqual(actorKind(records[0]), 'unknown', 'attributed to the unattributed operator');
    assert.strictEqual(records[0].outcome, 'error', 'a validation error, not a denial');
    assert.strictEqual(records[0].policyDecision, 'allowed', 'policy did not deny; it was never consulted');
  });

  it('audits a registry lookup failure as the system, not silently (#1 boundary)', async () => {
    const connectionId = freshId('prompt-lookup');
    const { deps } = makeDeps({ getThrows: true });

    const result = await handlePromptGet(deps, { connectionId, capabilityId: 'cap-1', arguments: { topic: 'x' } });
    assert.strictEqual(result.status, 500);

    const records = recordsForConnection(connectionId);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].event, 'rig.prompt.failed');
    assert.strictEqual(actorKind(records[0]), 'system');
  });
});

describe('connection lifecycle failure paths audit before mutating (#2)', () => {
  it('emits the transport-failure record even when the state update fails', async () => {
    const connectionId = freshId('transport');
    const connection = makeConnection(connectionId, makeCapability('tool'));
    const deps: RigLifecycleDeps = {
      registry: {
        get: () => connection,
        update: (async () => { throw new Error('registry update failed'); }) as never,
      } as never,
      runtime: { disconnect: async () => undefined } as never,
    };

    await handleTransportFailure(deps, connectionId, new Error('socket closed'));

    const records = recordsForConnection(connectionId);
    assert.strictEqual(records.length, 1, 'a failing state update does not lose the audit');
    assert.strictEqual(records[0].event, 'rig.connection.transport-failed');
    assert.strictEqual(actorKind(records[0]), 'system');
    assert.strictEqual(records[0].outcome, 'error');
  });

  it('emits the connect-failure record even when disconnect and update both fail', async () => {
    const connectionId = freshId('connect');
    const connection = makeConnection(connectionId, makeCapability('tool'));
    const deps: RigLifecycleDeps = {
      registry: {
        get: () => connection,
        update: (async () => { throw new Error('registry update failed'); }) as never,
      } as never,
      runtime: { disconnect: (async () => { throw new Error('disconnect failed'); }) as never } as never,
    };

    const record = await emitConnectFailure(deps, connectionId, 'appr-1', 'connect refused');

    const records = recordsForConnection(connectionId);
    assert.strictEqual(records.length, 1, 'a failing disconnect or update does not lose the audit');
    assert.strictEqual(records[0].event, 'rig.connection.failed');
    assert.strictEqual(actorKind(records[0]), 'system');
    assert.strictEqual(records[0].outcome, 'error');
    assert.strictEqual(record, connection, 'falls back to the last-read connection when the update fails');
  });
});
