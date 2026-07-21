import express from 'express';
import { randomUUID } from 'crypto';
import { logAudit } from '../audit';
import { digest } from './canonical';
import { CapabilityApprovalStore } from './approval';
import { ProvenanceStore } from './provenance';
import { RigRegistry } from './registry';
import { RigRuntime } from './runtime';
import { verifyHttpSpec, verifyStdioSpec } from './transportSecurity';
import { deleteBearerCredential, storeBearerCredential } from './keychain';
import type { CapabilityCard, McpConnection, Permission, ProvenanceRecord } from './types';

export const rigRouter = express.Router();
const registry = new RigRegistry();
const runtime = new RigRuntime(async (connectionId, error) => {
  const connection = registry.get(connectionId);
  if (!connection) return;
  await registry.update(connectionId, (value) => ({
    ...value,
    state: 'unreachable',
    health: { ...value.health, state: 'degraded' },
  }));
  logAudit('rig.connection.transport-failed', { connectionId, error: error.message });
});
const approvals = new CapabilityApprovalStore();
const provenance = new ProvenanceStore();

function publicConnection(record: McpConnection): McpConnection {
  if (record.transport.kind !== 'stdio') return record;
  return {
    ...record,
    transport: {
      ...record.transport,
      environment: record.transport.environment.map((binding) => binding.source === 'literal'
        ? { name: binding.name, source: 'literal' as const, value: '[configured]' }
        : binding),
    },
  };
}

function findCapability(record: McpConnection, capabilityId: string): CapabilityCard | null {
  return [...record.capabilities.tools, ...record.capabilities.resources, ...record.capabilities.prompts]
    .find((card) => card.capabilityId === capabilityId) ?? null;
}

interface ConnectionReview extends Record<string, unknown> {
  reviewDigest: string;
}

async function connectionReview(record: McpConnection): Promise<ConnectionReview> {
  if (record.transport.kind === 'stdio') {
    const verified = await verifyStdioSpec(record.transport);
    return {
      kind: 'stdio',
      reviewDigest: verified.launchSpecDigest,
      executablePath: verified.executablePath,
      executableDigest: verified.executableDigest,
      entryPointDigest: verified.entryPointDigest,
      argv: verified.argv,
      cwd: verified.cwd,
      environment: record.transport.environment.map((binding) => ({
        name: binding.name,
        source: binding.source,
        value: binding.source === 'literal' ? '[configured]' : '[keychain reference]',
      })),
      isolationMode: verified.isolationMode,
      enforcedLimits: ['startup timeout', 'idle timeout', 'message bytes', 'total output bytes', 'process-tree termination'],
      unenforcedLimits: verified.isolationMode === 'none'
        ? ['memory', 'CPU', 'file descriptors', 'filesystem confinement']
        : [],
    };
  }
  const verified = await verifyHttpSpec(record.transport);
  const reviewDigest = digest({ url: verified.url.toString(), localDevelopment: record.transport.localDevelopment });
  return {
    kind: 'http',
    reviewDigest,
    url: verified.url.toString(),
    origin: verified.url.origin,
    resolvedAddresses: verified.addresses,
    localDevelopment: record.transport.localDevelopment,
    authenticated: Boolean(record.transport.authRef),
    storagePolicy: record.transport.authRef ? 'macOS Keychain reference' : 'none',
    redirectPolicy: 'revalidate every destination; strip credentials on cross-origin redirects',
    tlsPolicy: verified.url.protocol === 'https:' ? 'system trust required' : 'local development exception',
  };
}

rigRouter.get('/connections', (_req, res) => {
  res.json({ connections: registry.list().map(publicConnection) });
});

rigRouter.post('/connections', async (req, res) => {
  try {
    const displayName = String(req.body?.displayName ?? '').trim();
    const transport = req.body?.transport;
    if (!displayName || !transport || (transport.kind !== 'stdio' && transport.kind !== 'http')) {
      return res.status(400).json({ error: 'A name and stdio or HTTP transport are required.' });
    }
    if (transport.kind === 'stdio') {
      if (typeof transport.executablePath !== 'string' || typeof transport.cwd !== 'string' || !Array.isArray(transport.argv)) {
        return res.status(400).json({ error: 'Stdio requires an executable, argv array, and working directory.' });
      }
      transport.environment = Array.isArray(transport.environment) ? transport.environment : [];
      transport.isolationMode = transport.isolationMode === 'container' ? 'container' : 'none';
    } else {
      transport.localDevelopment = transport.localDevelopment === true;
      transport.authRef = null;
      if (typeof transport.url !== 'string') return res.status(400).json({ error: 'HTTP requires a URL.' });
    }

    let record = await registry.create({
      displayName,
      sourceClass: transport.kind === 'stdio' ? 'local-user-installed' : 'remote-external',
      transport,
      endpointRef: transport.kind === 'stdio' ? transport.executablePath : transport.url,
    });
    const bearerToken = transport.kind === 'http' && typeof req.body?.credential?.bearerToken === 'string'
      ? req.body.credential.bearerToken
      : '';
    if (bearerToken) {
      try {
        const authRef = await storeBearerCredential(record.connectionId, bearerToken);
        record = await registry.update(record.connectionId, (value) => ({
          ...value,
          transport: value.transport.kind === 'http' ? { ...value.transport, authRef } : value.transport,
        }));
      } catch (error) {
        await registry.remove(record.connectionId);
        throw error;
      }
    }
    logAudit('rig.connection.proposed', { connectionId: record.connectionId, transport: transport.kind });
    return res.status(201).json({ connection: publicConnection(record) });
  } catch (error: unknown) {
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

rigRouter.get('/connections/:connectionId/review', async (req, res) => {
  const connection = registry.get(req.params.connectionId);
  if (!connection) return res.status(404).json({ error: 'Rig connection not found.' });
  try {
    return res.json({ review: await connectionReview(connection) });
  } catch (error: unknown) {
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

rigRouter.post('/connections/:connectionId/approve', async (req, res) => {
  const connectionId = req.params.connectionId;
  const current = registry.get(connectionId);
  if (!current) return res.status(404).json({ error: 'Rig connection not found.' });
  if (current.state !== 'approval-required' && current.state !== 'stopped' && current.state !== 'unreachable') {
    return res.status(409).json({ error: 'Connection is not awaiting approval.' });
  }

  const approvalId = randomUUID();
  try {
    const review = await connectionReview(current);
    if (typeof req.body?.reviewDigest !== 'string' || req.body.reviewDigest !== review.reviewDigest) {
      return res.status(409).json({ error: 'Connection details changed or were not reviewed. Review the exact launch specification again.' });
    }
    let approved = current;
    if (current.transport.kind === 'stdio') {
      const verified = await verifyStdioSpec(current.transport);
      approved = await registry.update(connectionId, (record) => ({
        ...record,
        endpointRef: verified.executablePath,
        executableDigest: verified.executableDigest,
        entryPointDigest: verified.entryPointDigest,
        launchSpecDigest: verified.launchSpecDigest,
        connectionApprovalId: approvalId,
        state: 'starting',
      }));
      logAudit('rig.connection.approved', {
        connectionId,
        approvalId,
        transport: 'stdio',
        launchSpecDigest: verified.launchSpecDigest,
        executablePath: verified.executablePath,
      });
    } else {
      const verified = await verifyHttpSpec(current.transport);
      approved = await registry.update(connectionId, (record) => ({
        ...record,
        endpointRef: verified.url.toString(),
        launchSpecDigest: digest({ url: verified.url.toString(), localDevelopment: current.transport.kind === 'http' && current.transport.localDevelopment }),
        connectionApprovalId: approvalId,
        state: 'starting',
      }));
      logAudit('rig.connection.approved', {
        connectionId,
        approvalId,
        transport: 'http',
        origin: verified.url.origin,
        localDevelopment: current.transport.localDevelopment,
      });
    }

    const connected = await runtime.connect(approved);
    const structuralChanged = Boolean(
      current.capabilities.structuralDigest
      && current.capabilities.structuralDigest !== connected.snapshot.structuralDigest,
    );
    const presentationChanged = Boolean(
      current.capabilities.presentationDigest
      && current.capabilities.presentationDigest !== connected.snapshot.presentationDigest,
    );
    const record = await registry.update(connectionId, (value) => ({
      ...value,
      endpointRef: connected.endpointRef,
      executableDigest: connected.verifiedLaunch?.executableDigest ?? value.executableDigest,
      entryPointDigest: connected.verifiedLaunch?.entryPointDigest ?? value.entryPointDigest,
      launchSpecDigest: connected.verifiedLaunch?.launchSpecDigest ?? value.launchSpecDigest,
      state: 'connected',
      health: { state: 'current', lastSuccessfulContact: new Date().toISOString() },
      capabilities: connected.snapshot,
    }));
    logAudit('rig.connection.connected', {
      connectionId,
      approvalId,
      structuralChanged,
      presentationChanged,
      capabilityCounts: {
        tools: record.capabilities.tools.length,
        resources: record.capabilities.resources.length,
        prompts: record.capabilities.prompts.length,
      },
    });
    return res.json({ connection: publicConnection(record), attention: { structuralChanged, presentationChanged } });
  } catch (error: unknown) {
    await runtime.disconnect(connectionId);
    const record = await registry.update(connectionId, (value) => ({
      ...value,
      state: 'unreachable',
      health: { ...value.health, state: 'degraded' },
    }));
    const message = error instanceof Error ? error.message : String(error);
    logAudit('rig.connection.failed', { connectionId, approvalId, error: message });
    return res.status(502).json({ error: message, connection: publicConnection(record) });
  }
});

rigRouter.post('/connections/:connectionId/stop', async (req, res) => {
  try {
    const connectionId = req.params.connectionId;
    if (!registry.get(connectionId)) return res.status(404).json({ error: 'Rig connection not found.' });
    await runtime.disconnect(connectionId);
    const record = await registry.update(connectionId, (value) => ({ ...value, state: 'stopped' }));
    logAudit('rig.connection.stopped', { connectionId });
    return res.json({ connection: publicConnection(record) });
  } catch (error: unknown) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

rigRouter.delete('/connections/:connectionId', async (req, res) => {
  try {
    const connectionId = req.params.connectionId;
    const current = registry.get(connectionId);
    if (!current) return res.status(404).json({ error: 'Rig connection not found.' });
    await runtime.disconnect(connectionId);
    if (current.transport.kind === 'http' && current.transport.authRef) {
      await deleteBearerCredential(current.transport.authRef);
    }
    const removed = await registry.remove(connectionId);
    logAudit('rig.connection.removed', {
      connectionId,
      transport: removed.transport.kind,
      capabilityCounts: {
        tools: removed.capabilities.tools.length,
        resources: removed.capabilities.resources.length,
        prompts: removed.capabilities.prompts.length,
      },
    });
    return res.json({ removed: true });
  } catch (error: unknown) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

rigRouter.post('/connections/:connectionId/refresh', async (req, res) => {
  const record = registry.get(req.params.connectionId);
  if (!record || record.state !== 'connected' || !runtime.isConnected(record.connectionId)) {
    return res.status(409).json({ error: 'Connection is not active.' });
  }
  try {
    const snapshot = await runtime.discover(record.connectionId, record.capabilities);
    const structuralChanged = snapshot.structuralDigest !== record.capabilities.structuralDigest;
    const presentationChanged = snapshot.presentationDigest !== record.capabilities.presentationDigest;
    const updated = await registry.update(record.connectionId, (value) => ({
      ...value,
      capabilities: snapshot,
      health: { state: 'current', lastSuccessfulContact: new Date().toISOString() },
    }));
    if (structuralChanged || presentationChanged) {
      logAudit('rig.capabilities.changed', { connectionId: record.connectionId, structuralChanged, presentationChanged });
    }
    return res.json({ connection: publicConnection(updated), attention: { structuralChanged, presentationChanged } });
  } catch (error: unknown) {
    await registry.update(record.connectionId, (value) => ({ ...value, health: { ...value.health, state: 'degraded' } }));
    return res.status(502).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

rigRouter.put('/connections/:connectionId/capabilities/:capabilityId', async (req, res) => {
  try {
    const { connectionId, capabilityId } = req.params;
    const current = registry.get(connectionId);
    if (!current) return res.status(404).json({ error: 'Rig connection not found.' });
    const existing = findCapability(current, capabilityId);
    if (!existing) return res.status(404).json({ error: 'Capability not found.' });
    const enabled = req.body?.enabled === true;
    const requested = req.body?.permission as Permission;
    if (!['denied', 'proposable', 'auto-invocable'].includes(requested)) {
      return res.status(400).json({ error: 'Invalid capability permission.' });
    }
    if (requested === 'auto-invocable' && current.sourceClass !== 'panetera-managed') {
      return res.status(403).json({ error: 'External capabilities cannot be made automatic.' });
    }
    const updateCards = (cards: CapabilityCard[]) => cards.map((card) => card.capabilityId === capabilityId
      ? { ...card, enabled, permission: enabled ? requested : 'denied' as Permission }
      : card);
    const updated = await registry.update(connectionId, (record) => ({
      ...record,
      capabilities: {
        ...record.capabilities,
        tools: updateCards(record.capabilities.tools),
        resources: updateCards(record.capabilities.resources),
        prompts: updateCards(record.capabilities.prompts),
      },
    }));
    logAudit('rig.capability.policy', { connectionId, capabilityId, enabled, permission: enabled ? requested : 'denied' });
    return res.json({ connection: publicConnection(updated) });
  } catch (error: unknown) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

rigRouter.post('/proposals', (req, res) => {
  const { connectionId, capabilityId, arguments: args } = req.body ?? {};
  const connection = registry.get(String(connectionId));
  const capability = connection ? findCapability(connection, String(capabilityId)) : null;
  if (!connection || connection.state !== 'connected' || !capability || capability.kind !== 'tool') {
    return res.status(404).json({ error: 'Connected tool capability not found.' });
  }
  if (!capability.enabled || capability.permission !== 'proposable') {
    return res.status(403).json({ error: 'Capability is not enabled for proposals.' });
  }
  const proposal = approvals.propose({
    connectionId: connection.connectionId,
    capabilityId: capability.capabilityId,
    capabilityDigest: capability.structuralDigest,
    arguments: args && typeof args === 'object' && !Array.isArray(args) ? args : {},
    displayArguments: args ?? {},
  });
  logAudit('rig.invocation.proposed', { connectionId, capabilityId, proposalId: proposal.proposalId, argumentsDigest: proposal.argumentsDigest });
  return res.status(201).json({ proposal });
});

rigRouter.post('/proposals/:proposalId/approve', (req, res) => {
  try {
    const approval = approvals.approve(req.params.proposalId);
    logAudit('rig.invocation.approved', { connectionId: approval.connectionId, capabilityId: approval.capabilityId, proposalId: approval.proposalId, approvalId: approval.approvalId });
    return res.json({ approval });
  } catch (error: unknown) {
    return res.status(409).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

rigRouter.post('/invocations', async (req, res) => {
  const { approvalId, arguments: args } = req.body ?? {};
  const connectionId = String(req.body?.connectionId ?? '');
  try {
    const capabilityId = String(req.body?.capabilityId ?? '');
    const connection = registry.get(connectionId);
    const capability = connection ? findCapability(connection, capabilityId) : null;
    if (!connection || connection.state !== 'connected' || !capability || capability.kind !== 'tool' || !capability.enabled) {
      return res.status(409).json({ error: 'Enabled connected tool not found.' });
    }
    const argumentsValue = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
    const { approval, claimId } = approvals.claim(String(approvalId), {
      connectionId,
      capabilityId,
      capabilityDigest: capability.structuralDigest,
      arguments: argumentsValue,
    });
    let output: unknown;
    try {
      output = await runtime.callTool(connectionId, capability.name, argumentsValue);
    } finally {
      approvals.consume(approval.approvalId, claimId);
    }
    const record: ProvenanceRecord = {
      recordId: randomUUID(),
      recordType: 'mcp-invocation',
      ownerId: 'local-operator',
      sourceIdentity: { kind: 'mcp-connection', id: connectionId },
      parentRecordIds: [],
      inputDigest: digest(argumentsValue),
      outputDigest: digest(output),
      createdAt: new Date().toISOString(),
      sourceClass: connection.sourceClass,
      trustLevel: 'untrusted',
      correlation: { proposalId: approval.proposalId, approvalId: approval.approvalId, connectionId },
      integrity: 'verified',
      retentionClass: 'session',
    };
    provenance.append(record);
    await registry.update(connectionId, (value) => ({
      ...value,
      health: { state: 'current', lastSuccessfulContact: new Date().toISOString() },
    }));
    logAudit('rig.invocation.completed', { connectionId, capabilityId, approvalId, provenanceRecordId: record.recordId, outputDigest: record.outputDigest });
    return res.json({ result: output, provenance: record });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (registry.get(connectionId)) {
      await registry.update(connectionId, (value) => ({ ...value, health: { ...value.health, state: 'degraded' } }));
    }
    logAudit('rig.invocation.failed', { connectionId, approvalId, error: message });
    return res.status(409).json({ error: message });
  }
});

rigRouter.get('/resources', (_req, res) => {
  const resources = registry.list().flatMap((connection) => connection.capabilities.resources
    .filter((resource) => connection.state === 'connected' && resource.enabled)
    .map((resource) => ({ ...resource, connectionId: connection.connectionId, connectionName: connection.displayName })));
  res.json({ resources });
});

rigRouter.post('/resources/read', async (req, res) => {
  const connectionId = String(req.body?.connectionId ?? '');
  const capabilityId = String(req.body?.capabilityId ?? '');
  const connection = registry.get(connectionId);
  const capability = connection ? findCapability(connection, capabilityId) : null;
  if (!connection || connection.state !== 'connected' || !capability || capability.kind !== 'resource' || !capability.enabled || capability.permission === 'denied') {
    return res.status(403).json({ error: 'Enabled connected resource not found.' });
  }
  const declaration = capability.rawDeclaration as Record<string, unknown>;
  if (typeof declaration.uri !== 'string') return res.status(400).json({ error: 'Resource has no fixed URI.' });
  try {
    const result = await runtime.readResource(connectionId, declaration.uri);
    const record: ProvenanceRecord = {
      recordId: randomUUID(),
      recordType: 'mcp-resource-read',
      ownerId: 'local-operator',
      sourceIdentity: { kind: 'mcp-connection', id: connectionId },
      parentRecordIds: [],
      inputDigest: digest({ uri: declaration.uri }),
      outputDigest: digest(result),
      createdAt: new Date().toISOString(),
      sourceClass: connection.sourceClass,
      trustLevel: 'untrusted',
      correlation: { connectionId },
      integrity: 'verified',
      retentionClass: 'session',
    };
    provenance.append(record);
    await registry.update(connectionId, (value) => ({
      ...value,
      health: { state: 'current', lastSuccessfulContact: new Date().toISOString() },
    }));
    logAudit('rig.resource.read', { connectionId, capabilityId, provenanceRecordId: record.recordId });
    return res.json({ result, provenance: record });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await registry.update(connectionId, (value) => ({ ...value, health: { ...value.health, state: 'degraded' } }));
    logAudit('rig.resource.failed', { connectionId, capabilityId, error: message });
    return res.status(502).json({ error: message });
  }
});

rigRouter.post('/prompts/get', async (req, res) => {
  const connectionId = String(req.body?.connectionId ?? '');
  const capabilityId = String(req.body?.capabilityId ?? '');
  const connection = registry.get(connectionId);
  const capability = connection ? findCapability(connection, capabilityId) : null;
  if (!connection || connection.state !== 'connected' || !capability || capability.kind !== 'prompt' || !capability.enabled || capability.permission === 'denied') {
    return res.status(403).json({ error: 'Enabled connected prompt not found.' });
  }
  const args = req.body?.arguments;
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.values(args).some((value) => typeof value !== 'string')) {
    return res.status(400).json({ error: 'Prompt arguments must be a string map.' });
  }
  try {
    const result = await runtime.getPrompt(connectionId, capability.name, args as Record<string, string>);
    const record: ProvenanceRecord = {
      recordId: randomUUID(),
      recordType: 'mcp-prompt-read',
      ownerId: 'local-operator',
      sourceIdentity: { kind: 'mcp-connection', id: connectionId },
      parentRecordIds: [],
      inputDigest: digest(args),
      outputDigest: digest(result),
      createdAt: new Date().toISOString(),
      sourceClass: connection.sourceClass,
      trustLevel: 'untrusted',
      correlation: { connectionId },
      integrity: 'verified',
      retentionClass: 'session',
    };
    provenance.append(record);
    await registry.update(connectionId, (value) => ({
      ...value,
      health: { state: 'current', lastSuccessfulContact: new Date().toISOString() },
    }));
    logAudit('rig.prompt.read', { connectionId, capabilityId, provenanceRecordId: record.recordId });
    return res.json({ result, provenance: record });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await registry.update(connectionId, (value) => ({ ...value, health: { ...value.health, state: 'degraded' } }));
    logAudit('rig.prompt.failed', { connectionId, capabilityId, error: message });
    return res.status(502).json({ error: message });
  }
});

rigRouter.get('/provenance', (_req, res) => {
  res.json({ records: provenance.list() });
});
