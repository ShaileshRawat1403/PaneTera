// test/rigGenericRegression.test.ts
//
// Generic regression smokes for proposal-time validation and immutable
// proposal binding, against a real stdio MCP server and the agent proposal
// path. Nothing here is specific to any application integration.

process.env.NODE_ENV = 'test';

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RigRuntime } from '../server/rig/runtime';
import { CapabilityApprovalStore } from '../server/rig/approval';
import { handleInvocation, handleProposal, type RigDataDeps } from '../server/rig/routes';
import { RigToolAdapter } from '../server/rig/adapter';
import { createRigCapabilities } from '../server/agent/rigCapabilities';
import { resolveAuditLogPath } from '../server/audit';
import type { CapabilityCard, McpConnection, StdioTransportSpec } from '../server/rig/types';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const FIXTURE = path.join(REPO_ROOT, 'test', 'fixtures', 'rigMcpServer.mjs');
const dirs: string[] = [];
const tempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-rig-regression-'));
  dirs.push(dir);
  return dir;
};
after(() => { for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true }); });

function auditCount(event: string, connectionId: string): number {
  const log = resolveAuditLogPath();
  if (!fs.existsSync(log)) return 0;
  return fs.readFileSync(log, 'utf8').split('\n').filter((line) => {
    try {
      const record = JSON.parse(line);
      return record.event === event && record.correlation?.connectionId === connectionId;
    } catch {
      return false;
    }
  }).length;
}

function connectionRecord(connectionId: string, transport: StdioTransportSpec): McpConnection {
  return {
    connectionId,
    displayName: 'Fixture',
    sourceClass: 'local-user-installed',
    transport,
    endpointRef: transport.executablePath,
    executableDigest: null,
    entryPointDigest: null,
    launchSpecDigest: null,
    state: 'starting',
    health: { state: 'not-measured', lastSuccessfulContact: null },
    capabilities: { tools: [], resources: [], prompts: [], structuralDigest: '', presentationDigest: '', discoveredAt: '', truncated: false },
    createdAt: 'now',
    updatedAt: 'now',
    connectionApprovalId: null,
  } as unknown as McpConnection;
}

describe('proposal binding against a real stdio MCP server', () => {
  it('rejects an invalid proposal, then runs the stored arguments of a valid one without resending them', { timeout: 60_000 }, async () => {
    const connectionId = `round-trip-${process.pid}`;
    const transport: StdioTransportSpec = { kind: 'stdio', executablePath: process.execPath, argv: [FIXTURE], cwd: REPO_ROOT, environment: [], isolationMode: 'none' };
    const runtime = new RigRuntime();
    try {
      const base = connectionRecord(connectionId, transport);
      const inventory = await runtime.connect(base);
      const echo = inventory.snapshot.tools.find((tool) => tool.name === 'echo');
      assert.ok(echo, 'the fixture advertises echo');
      const card: CapabilityCard = { ...echo, enabled: true, permission: 'proposable' };
      const connection = { ...base, state: 'connected', capabilities: { ...inventory.snapshot, tools: [card] } } as McpConnection;
      const registry = { get: (id: string) => (id === connectionId ? connection : null), update: async () => connection };
      const approvals = new CapabilityApprovalStore(tempDir());

      const invalid = handleProposal({ registry, approvals } as never, { connectionId, capabilityId: card.capabilityId, arguments: {} });
      assert.equal(invalid.status, 400);
      assert.match(invalid.payload, /Missing required field: text/);
      assert.equal(approvals.listPendingProposals().length, 0, 'an invalid proposal is not queued');

      const created = handleProposal({ registry, approvals } as never, { connectionId, capabilityId: card.capabilityId, arguments: { text: 'stored-value' } });
      assert.equal(created.status, 201);
      const { proposal } = JSON.parse(created.payload) as { proposal: { proposalId: string } };
      const approval = approvals.approve(proposal.proposalId);

      const deps: RigDataDeps = { registry: registry as never, runtime, approvals, provenance: { append: () => undefined } as never };
      const result = await handleInvocation(deps, { connectionId, capabilityId: card.capabilityId, approvalId: approval.approvalId });
      assert.equal(result.status, 200, result.payload);
      const payload = JSON.parse(result.payload) as { result: { content: Array<{ text: string }> } };
      assert.equal(payload.result.content[0].text, 'stored-value', 'the connector ran the stored argument');
    } finally {
      await runtime.disconnectAll();
    }
  });
});

describe('agent proposals', () => {
  it('rejects invalid arguments, queues nothing, and records proposal-invalid evidence', async () => {
    const connectionId = `agent-invalid-${process.pid}`;
    const tool: CapabilityCard = {
      capabilityId: `${connectionId}.create_item`,
      kind: 'tool',
      name: 'create_item',
      label: 'Create item',
      description: { source: 'schema-derived', text: 'Creates an item' },
      inputSchema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
      rawDeclaration: {},
      permission: 'proposable',
      enabled: true,
      structuralDigest: 'digest-create-item',
      presentationDigest: 'digest-create-item',
    };
    const connection = {
      ...connectionRecord(connectionId, { kind: 'stdio', executablePath: '/bin/echo', argv: [], cwd: '/tmp', environment: [], isolationMode: 'none' }),
      state: 'connected',
      capabilities: { tools: [tool], resources: [], prompts: [], structuralDigest: 's', presentationDigest: 'p', discoveredAt: 'now', truncated: false },
    } as McpConnection;
    const registry = { list: () => [connection], get: (id: string) => (id === connectionId ? connection : null), update: async () => connection };
    const runtime = { isConnected: () => true, callTool: async () => ({ ok: true }), readResource: async () => ({}), getPrompt: async () => ({}) };
    const approvals = new CapabilityApprovalStore(tempDir());
    const [capability] = createRigCapabilities(new RigToolAdapter(registry as never, runtime as never), runtime as never, undefined, registry as never, approvals);

    const before = auditCount('rig.invocation.proposal-invalid', connectionId);
    await assert.rejects(capability.execute({}), /was rejected: Missing required field: name/);
    assert.equal(approvals.listPendingProposals().length, 0, 'nothing entered the approval queue');
    assert.equal(auditCount('rig.invocation.proposal-invalid', connectionId), before + 1);
  });
});
