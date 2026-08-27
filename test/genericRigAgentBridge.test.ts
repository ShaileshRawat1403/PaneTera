import { describe, it } from 'node:test';
import assert from 'node:assert';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { RigToolAdapter } from '../server/rig/adapter';
import { createRigCapabilities } from '../server/agent/rigCapabilities';
import { CapabilityApprovalStore } from '../server/rig/approval';
import { ProvenanceStore } from '../server/rig/provenance';
import { parseRepoSetupIntent } from '../server/repoSetup';
import type { McpConnection, CapabilityCard } from '../server/rig/types';

describe('Generic Conversation <-> Rig Governance Bridge', () => {
  const testConnId = 'test-mcp';
  const testToolCard: CapabilityCard = {
    capabilityId: `${testConnId}.create_probe`,
    kind: 'tool',
    name: 'create_probe',
    label: 'Create Probe',
    description: { source: 'schema-derived', text: 'Creates a probe item' },
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
    rawDeclaration: {},
    permission: 'proposable',
    enabled: true,
    structuralDigest: 'digest-create-probe-123',
    presentationDigest: 'pres-123',
  };

  const deniedToolCard: CapabilityCard = {
    capabilityId: `${testConnId}.elevate_profile`,
    kind: 'tool',
    name: 'elevate_profile',
    label: 'Elevate Profile',
    description: { source: 'schema-derived', text: 'Elevates profile authority' },
    inputSchema: {},
    rawDeclaration: {},
    permission: 'denied',
    enabled: false,
    structuralDigest: 'digest-elevate-456',
    presentationDigest: 'pres-456',
  };

  const mockRegistry = {
    list: (): McpConnection[] => [
      {
        connectionId: testConnId,
        displayName: 'Test MCP',
        sourceClass: 'local-user-installed',
        transport: { kind: 'stdio', executablePath: '/bin/echo', argv: [], cwd: '/tmp', environment: [], isolationMode: 'none' },
        endpointRef: '/bin/echo',
        executableDigest: 'exe-digest',
        entryPointDigest: null,
        launchSpecDigest: 'launch-digest',
        state: 'connected',
        health: { state: 'current', lastSuccessfulContact: new Date().toISOString() },
        capabilities: {
          tools: [testToolCard, deniedToolCard],
          resources: [],
          prompts: [],
          structuralDigest: 'snap-digest',
          presentationDigest: 'pres-digest',
          discoveredAt: new Date().toISOString(),
          truncated: false,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        connectionApprovalId: 'appr-1',
      },
    ],
    get: (id: string) => (id === testConnId ? mockRegistry.list()[0] : null),
    update: async () => mockRegistry.list()[0],
  };

  const mockRuntime = {
    isConnected: (id: string) => id === testConnId,
    callTool: async (connectionId: string, name: string, args: Record<string, unknown>) => {
      return { ok: true, connectionId, name, args };
    },
    readResource: async () => ({}),
    getPrompt: async () => ({}),
  };

  it('Invariant A: denied Rig capability is absent from operator tools', () => {
    const adapter = new RigToolAdapter(mockRegistry as any, mockRuntime as any);
    const tools = adapter.listEnabledTools();
    assert.strictEqual(tools.length, 1);
    assert.strictEqual(tools[0].name, `${testConnId}__create_probe`);
    const denied = tools.find((t) => t.capabilityId.includes('elevate_profile'));
    assert.strictEqual(denied, undefined, 'Denied tools must never be supplied to the operator');
  });

  it('Invariant B & C: proposable Rig capability maps to risk=propose and carries raw tool name', () => {
    const adapter = new RigToolAdapter(mockRegistry as any, mockRuntime as any);
    const caps = createRigCapabilities(adapter, mockRuntime as any);
    assert.strictEqual(caps.length, 1);
    assert.strictEqual(caps[0].name, `${testConnId}__create_probe`);
    assert.strictEqual(caps[0].risk, 'propose', 'Proposable tool must map strictly to risk: propose');
  });

  it('Invariant D: selecting a proposable tool creates a single-use Rig proposal without direct execution', async () => {
    let rawCallCount = 0;
    const trackingRuntime = {
      ...mockRuntime,
      callTool: async (...args: any[]) => {
        rawCallCount++;
        return { ok: true };
      },
    };

    const approvals = new CapabilityApprovalStore();
    const adapter = new RigToolAdapter(mockRegistry as any, trackingRuntime as any);
    const caps = createRigCapabilities(adapter, trackingRuntime as any, undefined, mockRegistry as any, approvals);
    assert.strictEqual(caps.length, 1);

    const outcome = await caps[0].execute({ name: 'Probe 1' });

    // Verify runtime.callTool was NOT called before approval
    assert.strictEqual(rawCallCount, 0, 'runtime.callTool must NOT be called before human approval');

    // Verify outcome structure
    assert.strictEqual(outcome.requiresApproval, true);
    assert.ok(outcome.approval, 'Outcome must include an approval descriptor');
    assert.strictEqual(outcome.approval.kind, 'rig-capability');
    assert.strictEqual(outcome.approval.connectionId, testConnId);
    assert.strictEqual(outcome.approval.capabilityId, testToolCard.capabilityId);
    assert.strictEqual(outcome.approval.capabilityDigest, testToolCard.structuralDigest);
    assert.deepStrictEqual(outcome.approval.arguments, { name: 'Probe 1' });
    assert.ok(outcome.approval.proposalId, 'Authoritative proposalId must be present');
  });

  it('Invariant E & F: approval invokes exactly once; reused approval fails', async () => {
    const approvals = new CapabilityApprovalStore();

    // 1. Propose
    const proposal = approvals.propose({
      connectionId: testConnId,
      capabilityId: testToolCard.capabilityId,
      capabilityDigest: testToolCard.structuralDigest,
      arguments: { name: 'Probe 1' },
      displayArguments: { name: 'Probe 1' },
    });

    // 2. Approve
    const approval = approvals.approve(proposal.proposalId);
    assert.ok(approval.approvalId);

    // 3. First claim succeeds
    const claim1 = approvals.claim(approval.approvalId, {
      connectionId: testConnId,
      capabilityId: testToolCard.capabilityId,
      capabilityDigest: testToolCard.structuralDigest,
      arguments: { name: 'Probe 1' },
    });
    assert.ok(claim1.claimId);
    approvals.consume(approval.approvalId, claim1.claimId);

    // 4. Reused claim fails
    assert.throws(() => {
      approvals.claim(approval.approvalId, {
        connectionId: testConnId,
        capabilityId: testToolCard.capabilityId,
        capabilityDigest: testToolCard.structuralDigest,
        arguments: { name: 'Probe 1' },
      });
    }, (err: any) => err.message.includes('claimed') || err.message.includes('consumed'));
  });

  it('Invariant G: changed arguments fail approval claim', async () => {
    const approvals = new CapabilityApprovalStore();

    const proposal = approvals.propose({
      connectionId: testConnId,
      capabilityId: testToolCard.capabilityId,
      capabilityDigest: testToolCard.structuralDigest,
      arguments: { name: 'Original Name' },
      displayArguments: { name: 'Original Name' },
    });

    const approval = approvals.approve(proposal.proposalId);

    // Attempting to claim with different arguments must throw
    assert.throws(() => {
      approvals.claim(approval.approvalId, {
        connectionId: testConnId,
        capabilityId: testToolCard.capabilityId,
        capabilityDigest: testToolCard.structuralDigest,
        arguments: { name: 'Tampered Name' },
      });
    }, (err: any) => err.message.includes('changed'));
  });

  it('Invariant H: Rig provenance is recorded with input and output digests', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-provenance-test-'));
    try {
      const provenance = new ProvenanceStore(tmpDir);
      const record = {
        recordId: 'rec-123',
        recordType: 'mcp-invocation',
        ownerId: 'local-operator',
        sourceIdentity: { kind: 'mcp-connection', id: testConnId },
        parentRecordIds: [],
        inputDigest: 'input-hash',
        outputDigest: 'output-hash',
        createdAt: new Date().toISOString(),
        sourceClass: 'local-user-installed' as const,
        trustLevel: 'untrusted' as const,
        correlation: { proposalId: 'prop-1', approvalId: 'appr-1', connectionId: testConnId },
        integrity: 'verified' as const,
        retentionClass: 'session',
      };

      provenance.append(record);
      const listed = provenance.list();
      assert.strictEqual(listed.length, 1);
      assert.strictEqual(listed[0].recordId, 'rec-123');
      assert.strictEqual(listed[0].inputDigest, 'input-hash');
      assert.strictEqual(listed[0].outputDigest, 'output-hash');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('Invariant I: generic gateway does not intercept unrelated "Add ..." commands', () => {
    assert.strictEqual(parseRepoSetupIntent('Add a temporary track called Conversation Probe'), null);
    assert.strictEqual(parseRepoSetupIntent('Add a layer named Background'), null);
    assert.strictEqual(parseRepoSetupIntent('Add a scene called Intro'), null);
    assert.strictEqual(parseRepoSetupIntent('Add 5 to 10'), null);
    assert.strictEqual(parseRepoSetupIntent('track 1 volume'), null);
    assert.strictEqual(parseRepoSetupIntent('connect pin 1 to pin 2'), null);

    // Explicit repo intents MUST still match
    assert.ok(parseRepoSetupIntent('Add this GitHub repository to my workspace') !== null);
    assert.ok(parseRepoSetupIntent('Set up a repo for this project') !== null);
    assert.ok(parseRepoSetupIntent('Add my frontend repo') !== null);
    assert.ok(parseRepoSetupIntent('Add the backend repo') !== null);
    assert.ok(parseRepoSetupIntent('track the analytics repo') !== null);
    assert.ok(parseRepoSetupIntent('use payment-service repo') !== null);
    assert.ok(parseRepoSetupIntent('make auth-service available as a workspace') !== null);
  });

  it('Invariant J: approvePendingRigCapability approves, invokes, attaches provenance, and completes run', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-agent-run-test-'));
    try {
      const { AgentRunStore } = await import('../server/agent/runStore');
      const { approvePendingRigCapability } = await import('../server/agent/rigRunCoordinator');
      const { rigApprovals, rigProvenance } = await import('../server/rig/routes');

      const mockConnection = {
        connectionId: testConnId,
        displayName: 'Test MCP',
        sourceClass: 'local-user-installed',
        transport: { kind: 'stdio', executablePath: '/bin/echo', argv: [], cwd: '/tmp', environment: [], isolationMode: 'none' },
        state: 'connected',
        health: { state: 'current', lastSuccessfulContact: new Date().toISOString() },
        capabilities: {
          tools: [testToolCard],
          resources: [],
          prompts: [],
          structuralDigest: 'snap-digest',
          presentationDigest: 'pres-digest',
          discoveredAt: new Date().toISOString(),
          truncated: false,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        connectionApprovalId: 'appr-1',
      };

      const mockDeps = {
        registry: {
          get: (id: string) => (id === testConnId ? mockConnection as any : null),
          update: async () => mockConnection as any,
        } as any,
        runtime: {
          isConnected: (id: string) => id === testConnId,
          callTool: async () => ({ ok: true, probe: 'created' }),
        } as any,
        approvals: rigApprovals,
        provenance: rigProvenance,
      };

      const store = new AgentRunStore(tmpDir);
      const proposal = rigApprovals.propose({
        connectionId: testConnId,
        capabilityId: testToolCard.capabilityId,
        capabilityDigest: testToolCard.structuralDigest,
        arguments: { name: 'Probe Run 1' },
        displayArguments: { name: 'Probe Run 1' },
      });

      const run = await store.create({
        objective: 'Create a probe called Probe Run 1',
        provider: 'test',
        model: 'test-model',
      });

      await store.transition(run.runId, 'waiting-approval', {
        currentStep: 'Waiting for exact user approval',
        pendingApproval: {
          kind: 'rig-capability',
          connectionId: testConnId,
          capability: testToolCard.capabilityId,
          capabilityId: testToolCard.capabilityId,
          capabilityDigest: testToolCard.structuralDigest,
          proposalId: proposal.proposalId,
          approvalId: proposal.proposalId,
          arguments: { name: 'Probe Run 1' },
          displayArguments: { name: 'Probe Run 1' },
        },
      });

      // 1. First approval resolves
      const completed = await approvePendingRigCapability(store, run.runId, undefined, mockDeps);
      assert.strictEqual(completed.status, 'completed');
      assert.strictEqual(completed.pendingApproval, undefined);
      assert.ok(completed.reply, 'Completed run must carry synthesized reply text');

      // 2. Second approval must fail safely
      await assert.rejects(async () => {
        await approvePendingRigCapability(store, run.runId, undefined, mockDeps);
      }, /status completed/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('Invariant K: continuation uses provider abstraction and generic fallback without direct network code or domain words', async () => {
    const coordinatorSource = fs.readFileSync(path.join(__dirname, '../server/agent/rigRunCoordinator.ts'), 'utf8');
    assert.strictEqual(coordinatorSource.includes('fetch('), false, 'rigRunCoordinator must not contain raw fetch');
    assert.strictEqual(coordinatorSource.includes('generativelanguage.googleapis.com'), false);
    assert.strictEqual(coordinatorSource.includes('api.openai.com'), false);
    assert.strictEqual(coordinatorSource.includes('result.track'), false, 'rigRunCoordinator must not contain REAPER/domain nouns');
    assert.strictEqual(coordinatorSource.includes('result.action'), false);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-continuation-test-'));
    try {
      const { AgentRunStore } = await import('../server/agent/runStore');
      const { approvePendingRigCapability } = await import('../server/agent/rigRunCoordinator');
      const { rigApprovals, rigProvenance } = await import('../server/rig/routes');

      const mockConnection = {
        connectionId: testConnId,
        displayName: 'Test MCP',
        sourceClass: 'local-user-installed',
        transport: { kind: 'stdio', executablePath: '/bin/echo', argv: [], cwd: '/tmp', environment: [], isolationMode: 'none' },
        state: 'connected',
        health: { state: 'current', lastSuccessfulContact: new Date().toISOString() },
        capabilities: {
          tools: [testToolCard],
          resources: [],
          prompts: [],
          structuralDigest: 'snap-digest',
          presentationDigest: 'pres-digest',
          discoveredAt: new Date().toISOString(),
          truncated: false,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        connectionApprovalId: 'appr-1',
      };

      const mockDeps = {
        registry: {
          get: (id: string) => (id === testConnId ? mockConnection as any : null),
          update: async () => mockConnection as any,
        } as any,
        runtime: {
          isConnected: (id: string) => id === testConnId,
          callTool: async () => ({ ok: true, data: 42 }),
        } as any,
        approvals: rigApprovals,
        provenance: rigProvenance,
      };

      const store = new AgentRunStore(tmpDir);
      const proposal = rigApprovals.propose({
        connectionId: testConnId,
        capabilityId: testToolCard.capabilityId,
        capabilityDigest: testToolCard.structuralDigest,
        arguments: { name: 'Continuation Probe' },
        displayArguments: { name: 'Continuation Probe' },
      });

      const run = await store.create({
        objective: 'Create a probe for continuation',
        provider: 'custom-provider',
        model: 'custom-model',
      });

      await store.transition(run.runId, 'waiting-approval', {
        currentStep: 'Waiting for exact user approval',
        pendingApproval: {
          kind: 'rig-capability',
          connectionId: testConnId,
          capability: testToolCard.capabilityId,
          capabilityId: testToolCard.capabilityId,
          capabilityDigest: testToolCard.structuralDigest,
          proposalId: proposal.proposalId,
          approvalId: proposal.proposalId,
          arguments: { name: 'Continuation Probe' },
          displayArguments: { name: 'Continuation Probe' },
        },
      });

      let synthesizerCalled = false;
      const customSynthesizer = async (targetRun: any, capId: string, _args: any, result: any) => {
        synthesizerCalled = true;
        assert.strictEqual(targetRun.provider, 'custom-provider');
        assert.strictEqual(targetRun.model, 'custom-model');
        assert.strictEqual(capId, testToolCard.capabilityId);
        assert.deepStrictEqual(result, { ok: true, data: 42 });
        return 'Custom provider continuation succeeded.';
      };

      const completed = await approvePendingRigCapability(store, run.runId, undefined, mockDeps, {
        synthesizer: customSynthesizer,
      });

      assert.strictEqual(synthesizerCalled, true);
      assert.strictEqual(completed.reply, 'Custom provider continuation succeeded.');
      assert.strictEqual(completed.status, 'completed');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
