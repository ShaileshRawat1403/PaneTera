// test/rigProposalBinding.test.ts
//
// ADR-005: a proposal is validated before it can be queued, an approval
// authorizes one immutable payload, and an invocation executes only the
// approved copy of the arguments.

process.env.NODE_ENV = 'test';

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveAuditLogPath } from '../server/audit';
import { CapabilityApprovalStore } from '../server/rig/approval';
import { handleInvocation, handleProposal, type RigDataDeps } from '../server/rig/routes';
import type { CapabilityCard, McpConnection } from '../server/rig/types';

const AUDIT_LOG = resolveAuditLogPath();

function auditRecordsFor(connectionId: string): Record<string, unknown>[] {
  if (!fs.existsSync(AUDIT_LOG)) return [];
  return fs.readFileSync(AUDIT_LOG, 'utf8').trim().split('\n').flatMap((line) => {
    try {
      const parsed = JSON.parse(line);
      return parsed?.correlation?.connectionId === connectionId ? [parsed] : [];
    } catch {
      return [];
    }
  });
}

let counter = 0;
const freshId = (tag: string) => `bind-${tag}-${++counter}-${Math.random().toString(36).slice(2)}`;

function changeCapability(overrides: Partial<CapabilityCard> = {}): CapabilityCard {
  return {
    capabilityId: 'cap-apply-change',
    kind: 'tool',
    name: 'sample_app.apply_change',
    label: 'Apply change',
    description: { source: 'schema-derived', text: '' },
    inputSchema: {
      type: 'object',
      required: ['itemId', 'changeKind'],
      properties: { itemId: { type: 'string' }, changeKind: { type: 'string' }, parameters: { type: 'object' } },
    },
    rawDeclaration: {},
    permission: 'proposable',
    enabled: true,
    structuralDigest: 'digest-apply-change',
    presentationDigest: 'digest-apply-change',
    ...overrides,
  } as CapabilityCard;
}

function connectionWith(connectionId: string, capability: CapabilityCard, state = 'connected'): McpConnection {
  return {
    connectionId,
    displayName: 'Sample App',
    state,
    capabilities: { tools: [capability], resources: [], prompts: [], truncated: false },
  } as unknown as McpConnection;
}

describe('approval store binds one immutable payload', () => {
  let dir = '';
  before(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-binding-')); });
  after(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  const propose = (store: CapabilityApprovalStore, args: Record<string, unknown>) => store.propose({
    connectionId: 'sample-app',
    capabilityId: 'cap-apply-change',
    capabilityDigest: 'digest-apply-change',
    arguments: args,
    displayArguments: args,
  });
  const expected = { connectionId: 'sample-app', capabilityId: 'cap-apply-change', capabilityDigest: 'digest-apply-change' };

  it('copies the proposal arguments into the approval and approves a proposal only once', () => {
    const store = new CapabilityApprovalStore(dir);
    const proposal = propose(store, { itemId: 'item-alpha', changeKind: 'rename' });
    assert.ok(store.listPendingProposals().some((p) => p.proposalId === proposal.proposalId));

    const approval = store.approve(proposal.proposalId);
    assert.deepEqual(approval.arguments, { itemId: 'item-alpha', changeKind: 'rename' });
    assert.deepEqual(store.getApproval(approval.approvalId)?.arguments, approval.arguments);
    assert.ok(!store.listPendingProposals().some((p) => p.proposalId === proposal.proposalId), 'approved proposals leave the queue');
    assert.throws(() => store.approve(proposal.proposalId), /already been approved/);
  });

  it('claims without caller arguments, and rejects caller arguments that differ', () => {
    const store = new CapabilityApprovalStore(dir);
    const approval = store.approve(propose(store, { itemId: 'item-beta', changeKind: 'rename' }).proposalId);
    assert.throws(() => store.claim(approval.approvalId, { ...expected, arguments: { itemId: 'item-other', changeKind: 'rename' } }), /changed after approval/);
    const claim = store.claim(approval.approvalId, expected);
    assert.deepEqual(claim.approval.arguments, { itemId: 'item-beta', changeKind: 'rename' });
  });

  it('refuses to claim an approval whose stored arguments were altered', () => {
    const store = new CapabilityApprovalStore(dir);
    const approval = store.approve(propose(store, { itemId: 'item-beta', changeKind: 'rename' }).proposalId);
    const file = path.join(dir, 'rig', 'approvals.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    data.approvals.find((a: { approvalId: string }) => a.approvalId === approval.approvalId).arguments.itemId = 'Tampered';
    fs.writeFileSync(file, JSON.stringify(data));
    assert.throws(() => store.claim(approval.approvalId, expected), /no longer match the approved digest/);
  });
});

describe('handleProposal validates before queueing', () => {
  function proposalDeps(connection: McpConnection | null) {
    const proposed: unknown[] = [];
    const deps = {
      registry: { get: () => connection },
      approvals: { propose: (input: Record<string, unknown>) => { proposed.push(input); return { ...input, proposalId: 'prop-x', argumentsDigest: 'd', createdAt: 'now', expiresAt: 'later', approvalRequired: true }; } },
    };
    return { deps: deps as never, proposed };
  }

  it('rejects a missing required argument with 400, queues nothing, and audits it', () => {
    const connectionId = freshId('missing');
    const { deps, proposed } = proposalDeps(connectionWith(connectionId, changeCapability()));
    const result = handleProposal(deps, { connectionId, capabilityId: 'cap-apply-change', arguments: { changeKind: 'rename' } });
    assert.equal(result.status, 400);
    assert.match(result.payload, /Missing required field: itemId/);
    assert.equal(proposed.length, 0);
    const records = auditRecordsFor(connectionId);
    assert.equal(records.length, 1);
    assert.equal(records[0].event, 'rig.invocation.proposal-invalid');
    assert.equal(records[0].outcome, 'error');
  });

  it('rejects non-object arguments', () => {
    const connectionId = freshId('shape');
    const { deps, proposed } = proposalDeps(connectionWith(connectionId, changeCapability()));
    for (const args of ['itemId=item-beta', ['item-beta'], null]) {
      assert.equal(handleProposal(deps, { connectionId, capabilityId: 'cap-apply-change', arguments: args }).status, 400);
    }
    assert.equal(proposed.length, 0);
  });

  it('stores the validated arguments as both the executable and displayed payload', () => {
    const connectionId = freshId('valid');
    const { deps, proposed } = proposalDeps(connectionWith(connectionId, changeCapability()));
    const args = { itemId: 'item-alpha', changeKind: 'rename' };
    const result = handleProposal(deps, { connectionId, capabilityId: 'cap-apply-change', arguments: args });
    assert.equal(result.status, 201);
    assert.equal(proposed.length, 1);
    assert.deepEqual((proposed[0] as { arguments: unknown }).arguments, args);
    assert.deepEqual((proposed[0] as { displayArguments: unknown }).displayArguments, args);
    assert.equal(auditRecordsFor(connectionId)[0].event, 'rig.invocation.proposed');
  });

  it('keeps 404 for a missing target and 403 for a capability that is not proposable', () => {
    const connectionId = freshId('target');
    assert.equal(handleProposal(proposalDeps(connectionWith(connectionId, changeCapability(), 'unreachable')).deps, { connectionId, capabilityId: 'cap-apply-change', arguments: {} }).status, 404);
    assert.equal(handleProposal(proposalDeps(connectionWith(connectionId, changeCapability({ permission: 'auto-invocable' } as Partial<CapabilityCard>))).deps, { connectionId, capabilityId: 'cap-apply-change', arguments: {} }).status, 403);
  });
});

describe('handleInvocation executes only the approved arguments', () => {
  let dir = '';
  before(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-invoke-')); });
  after(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  function invocationDeps(connectionId: string, store: CapabilityApprovalStore) {
    const calls: Array<{ name: string; args: unknown }> = [];
    const connection = connectionWith(connectionId, changeCapability());
    const deps: RigDataDeps = {
      registry: { get: () => connection, update: (async () => connection) as never },
      runtime: {
        callTool: (async (_id: string, name: string, args: unknown) => { calls.push({ name, args }); return { ok: true }; }) as never,
        readResource: (async () => ({})) as never,
        getPrompt: (async () => ({})) as never,
      },
      approvals: store,
      provenance: { append: () => undefined } as never,
    };
    return { deps, calls };
  }

  it('runs the stored arguments when the caller sends none, and refuses caller arguments that differ', async () => {
    const connectionId = freshId('invoke');
    const store = new CapabilityApprovalStore(dir);
    const stored = { itemId: 'item-alpha', changeKind: 'rename' };
    const proposal = store.propose({ connectionId, capabilityId: 'cap-apply-change', capabilityDigest: 'digest-apply-change', arguments: stored, displayArguments: stored });
    const approval = store.approve(proposal.proposalId);
    const { deps, calls } = invocationDeps(connectionId, store);

    const tampered = await handleInvocation(deps, { connectionId, capabilityId: 'cap-apply-change', approvalId: approval.approvalId, arguments: { itemId: 'item-beta', changeKind: 'rename' } });
    assert.equal(tampered.status, 409);
    assert.equal(calls.length, 0, 'differing caller arguments never reach the connector');

    const result = await handleInvocation(deps, { connectionId, capabilityId: 'cap-apply-change', approvalId: approval.approvalId });
    assert.equal(result.status, 200);
    assert.deepEqual(calls, [{ name: 'sample_app.apply_change', args: stored }]);
  });

  it('refuses an unknown approval before any validation or connector work', async () => {
    const connectionId = freshId('unknown');
    const store = new CapabilityApprovalStore(dir);
    const { deps, calls } = invocationDeps(connectionId, store);
    const result = await handleInvocation(deps, { connectionId, capabilityId: 'cap-apply-change', approvalId: 'nope', arguments: { itemId: 'item-beta', changeKind: 'rename' } });
    assert.equal(result.status, 409);
    assert.equal(calls.length, 0);
    const records = auditRecordsFor(connectionId);
    assert.equal(records.at(-1)?.event, 'rig.invocation.failed');
  });
});
