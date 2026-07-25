import express from 'express';
import { randomUUID } from 'crypto';
import { logTypedAudit } from '../auditRecord';
import { operatorPrincipalForRequest, type OperatorPrincipal } from '../operatorPrincipal';
import { rigAuditFields, rigInvocationFailureFields, type InvocationPhase } from './auditClassification';
import { checkArgumentLimits, digest, validateToolArguments } from './canonical';
import { CapabilityApprovalStore } from './approval';
import { ProvenanceStore } from './provenance';
import { RigRegistry } from './registry';
import { RigRuntime } from './runtime';
import { verifyHttpSpec, verifyStdioSpec } from './transportSecurity';
import { deleteBearerCredential, storeBearerCredential } from './keychain';
import { createTypedRigError, type CapabilityCard, type McpConnection, type Permission, type ProvenanceRecord, type RigErrorKind } from './types';

import { buildUnifiedPortalManifest } from './unifiedRegistry';

export const rigRouter = express.Router();
const registry = new RigRegistry();
const runtime = new RigRuntime(async (connectionId, error) => {
  await handleTransportFailure(rigLifecycleDeps(), connectionId, error);
});
const approvals = new CapabilityApprovalStore();
const provenance = new ProvenanceStore();

rigRouter.get('/portal-manifest', (_req, res) => {
  const manifest = buildUnifiedPortalManifest(registry);
  res.json(manifest);
});

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

/** Dependencies for the connection lifecycle failure paths, injectable for tests. */
export interface RigLifecycleDeps {
  registry: Pick<RigRegistry, 'get' | 'update'>;
  runtime: Pick<RigRuntime, 'disconnect'>;
}

function rigLifecycleDeps(): RigLifecycleDeps {
  return { registry, runtime };
}

/**
 * A transport failure observed by PaneTera's runtime. The terminal record is
 * emitted first and unconditionally, so a failing or unreadable registry during
 * the follow-up state update cannot erase the audit. The state degradation is
 * best effort and secondary to the record.
 */
export async function handleTransportFailure(deps: RigLifecycleDeps, connectionId: string, error: Error): Promise<void> {
  logTypedAudit({
    event: 'rig.connection.transport-failed',
    ...rigAuditFields('rig.connection.transport-failed'),
    correlation: { connectionId },
    details: { error: error.message },
  });
  try {
    if (deps.registry.get(connectionId)) {
      await deps.registry.update(connectionId, (value) => ({
        ...value,
        state: 'unreachable',
        health: { ...value.health, state: 'degraded' },
      }));
    }
  } catch {
    // Best effort. The connection may already be gone or the registry unreadable;
    // the audit record is the guarantee, not the state update.
  }
}

/**
 * A failed connect attempt. The terminal record is emitted first, then the
 * disconnect and state degradation are attempted best effort, so a failure to
 * disconnect or to write the degraded state cannot lose the audit or mask the
 * original connect error. Returns the connection for the response, or null if it
 * could not be read.
 */
export async function emitConnectFailure(
  deps: RigLifecycleDeps,
  connectionId: string,
  approvalId: string,
  message: string,
): Promise<McpConnection | null> {
  // PaneTera's connect attempt failed. This is a system-observed failure, not
  // the connector reporting on itself.
  logTypedAudit({
    event: 'rig.connection.failed',
    ...rigAuditFields('rig.connection.failed'),
    correlation: { connectionId, approvalId },
    details: { error: message },
  });
  try {
    await deps.runtime.disconnect(connectionId);
  } catch {
    // Best effort; the audit is already recorded.
  }
  try {
    return await deps.registry.update(connectionId, (value) => ({
      ...value,
      state: 'unreachable',
      health: { ...value.health, state: 'degraded' },
    }));
  } catch {
    try {
      return deps.registry.get(connectionId) ?? null;
    } catch {
      return null;
    }
  }
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
      return replyError(res, 400, 'A name and stdio or HTTP transport are required.');
    }
    if (transport.kind === 'stdio') {
      if (typeof transport.executablePath !== 'string' || typeof transport.cwd !== 'string' || !Array.isArray(transport.argv)) {
        return replyError(res, 400, 'Stdio requires an executable, argv array, and working directory.');
      }
      transport.environment = Array.isArray(transport.environment) ? transport.environment : [];
      transport.isolationMode = transport.isolationMode === 'container' ? 'container' : 'none';
    } else {
      transport.localDevelopment = transport.localDevelopment === true;
      transport.authRef = null;
      if (typeof transport.url !== 'string') return replyError(res, 400, 'HTTP requires a URL.');
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
    logTypedAudit({
      event: 'rig.connection.proposed',
      ...rigAuditFields('rig.connection.proposed', undefined, operatorPrincipalForRequest(req)),
      correlation: { connectionId: record.connectionId },
      details: { transport: transport.kind },
    });
    return res.status(201).json({ connection: publicConnection(record) });
  } catch (error: unknown) {
    return replyError(res, 400, error instanceof Error ? error.message : String(error));
  }
});

rigRouter.get('/connections/:connectionId/review', async (req, res) => {
  const connection = registry.get(req.params.connectionId);
  if (!connection) return replyError(res, 404, 'Rig connection not found.');
  try {
    return res.json({ review: await connectionReview(connection) });
  } catch (error: unknown) {
    return replyError(res, 400, error instanceof Error ? error.message : String(error));
  }
});

rigRouter.post('/connections/:connectionId/approve', async (req, res) => {
  const connectionId = req.params.connectionId;
  const current = registry.get(connectionId);
  if (!current) return replyError(res, 404, 'Rig connection not found.');
  if (current.state !== 'approval-required' && current.state !== 'stopped' && current.state !== 'unreachable') {
    return replyError(res, 409, 'Connection is not awaiting approval.');
  }

  const approvalId = randomUUID();
  try {
    const review = await connectionReview(current);
    if (typeof req.body?.reviewDigest !== 'string' || req.body.reviewDigest !== review.reviewDigest) {
      return replyError(res, 409, 'Connection details changed or were not reviewed. Review the exact launch specification again.');
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
      logTypedAudit({
        event: 'rig.connection.approved',
        ...rigAuditFields('rig.connection.approved', undefined, operatorPrincipalForRequest(req)),
        correlation: { connectionId, approvalId },
        details: { transport: 'stdio', launchSpecDigest: verified.launchSpecDigest, executablePath: verified.executablePath },
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
      logTypedAudit({
        event: 'rig.connection.approved',
        ...rigAuditFields('rig.connection.approved', undefined, operatorPrincipalForRequest(req)),
        correlation: { connectionId, approvalId },
        details: { transport: 'http', origin: verified.url.origin, localDevelopment: current.transport.localDevelopment },
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
    // PaneTera's runtime established the session. The connector is the endpoint,
    // not the actor that connected to it.
    logTypedAudit({
      event: 'rig.connection.connected',
      ...rigAuditFields('rig.connection.connected'),
      correlation: { connectionId, approvalId },
      details: {
        structuralChanged,
        presentationChanged,
        capabilityCounts: {
          tools: record.capabilities.tools.length,
          resources: record.capabilities.resources.length,
          prompts: record.capabilities.prompts.length,
        },
      },
    });
    return res.json({ connection: publicConnection(record), attention: { structuralChanged, presentationChanged } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const record = await emitConnectFailure(rigLifecycleDeps(), connectionId, approvalId, message);
    return res.status(502).json({ error: message, connection: record ? publicConnection(record) : undefined });
  }
});

rigRouter.post('/connections/:connectionId/stop', async (req, res) => {
  try {
    const connectionId = req.params.connectionId;
    if (!registry.get(connectionId)) return replyError(res, 404, 'Rig connection not found.');
    await runtime.disconnect(connectionId);
    const record = await registry.update(connectionId, (value) => ({ ...value, state: 'stopped' }));
    logTypedAudit({
      event: 'rig.connection.stopped',
      ...rigAuditFields('rig.connection.stopped', undefined, operatorPrincipalForRequest(req)),
      correlation: { connectionId },
      details: {},
    });
    return res.json({ connection: publicConnection(record) });
  } catch (error: unknown) {
    return replyError(res, 500, error instanceof Error ? error.message : String(error));
  }
});

rigRouter.delete('/connections/:connectionId', async (req, res) => {
  try {
    const connectionId = req.params.connectionId;
    const current = registry.get(connectionId);
    if (!current) return replyError(res, 404, 'Rig connection not found.');
    await runtime.disconnect(connectionId);
    if (current.transport.kind === 'http' && current.transport.authRef) {
      await deleteBearerCredential(current.transport.authRef);
    }
    const removed = await registry.remove(connectionId);
    logTypedAudit({
      event: 'rig.connection.removed',
      ...rigAuditFields('rig.connection.removed', undefined, operatorPrincipalForRequest(req)),
      correlation: { connectionId },
      details: {
        transport: removed.transport.kind,
        capabilityCounts: {
          tools: removed.capabilities.tools.length,
          resources: removed.capabilities.resources.length,
          prompts: removed.capabilities.prompts.length,
        },
      },
    });
    return res.json({ removed: true });
  } catch (error: unknown) {
    return replyError(res, 500, error instanceof Error ? error.message : String(error));
  }
});

rigRouter.post('/connections/:connectionId/refresh', async (req, res) => {
  const record = registry.get(req.params.connectionId);
  if (!record || record.state !== 'connected' || !runtime.isConnected(record.connectionId)) {
    return replyError(res, 409, 'Connection is not active.');
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
      logTypedAudit({
        event: 'rig.capabilities.changed',
        ...rigAuditFields('rig.capabilities.changed'),
        correlation: { connectionId: record.connectionId },
        details: { structuralChanged, presentationChanged },
      });
    }
    return res.json({ connection: publicConnection(updated), attention: { structuralChanged, presentationChanged } });
  } catch (error: unknown) {
    await registry.update(record.connectionId, (value) => ({ ...value, health: { ...value.health, state: 'degraded' } }));
    return replyError(res, 502, error instanceof Error ? error.message : String(error));
  }
});

rigRouter.put('/connections/:connectionId/capabilities/:capabilityId', async (req, res) => {
  try {
    const { connectionId, capabilityId } = req.params;
    const current = registry.get(connectionId);
    if (!current) return replyError(res, 404, 'Rig connection not found.');
    const existing = findCapability(current, capabilityId);
    if (!existing) return replyError(res, 404, 'Capability not found.');
    const enabled = req.body?.enabled === true;
    const requested = req.body?.permission as Permission;
    if (!['denied', 'proposable', 'auto-invocable'].includes(requested)) {
      return replyError(res, 400, 'Invalid capability permission.');
    }
    if (requested === 'auto-invocable' && current.sourceClass !== 'panetera-managed') {
      return replyError(res, 403, 'External capabilities cannot be made automatic.');
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
    logTypedAudit({
      event: 'rig.capability.policy',
      ...rigAuditFields('rig.capability.policy', undefined, operatorPrincipalForRequest(req)),
      correlation: { connectionId },
      details: { capabilityId, enabled, permission: enabled ? requested : 'denied' },
    });
    return res.json({ connection: publicConnection(updated) });
  } catch (error: unknown) {
    return replyError(res, 500, error instanceof Error ? error.message : String(error));
  }
});

rigRouter.post('/proposals', (req, res) => {
  const { connectionId, capabilityId, arguments: args } = req.body ?? {};
  const connection = registry.get(String(connectionId));
  const capability = connection ? findCapability(connection, String(capabilityId)) : null;
  if (!connection || connection.state !== 'connected' || !capability || capability.kind !== 'tool') {
    return replyError(res, 404, 'Connected tool capability not found.');
  }
  if (!capability.enabled || capability.permission !== 'proposable') {
    return replyError(res, 403, 'Capability is not enabled for proposals.');
  }
  const proposal = approvals.propose({
    connectionId: connection.connectionId,
    capabilityId: capability.capabilityId,
    capabilityDigest: capability.structuralDigest,
    arguments: args && typeof args === 'object' && !Array.isArray(args) ? args : {},
    displayArguments: args ?? {},
  });
  logTypedAudit({
    event: 'rig.invocation.proposed',
    ...rigAuditFields('rig.invocation.proposed', undefined, operatorPrincipalForRequest(req)),
    correlation: { connectionId, proposalId: proposal.proposalId },
    details: { capabilityId, argumentsDigest: proposal.argumentsDigest },
  });
  return res.status(201).json({ proposal });
});

rigRouter.post('/proposals/:proposalId/approve', (req, res) => {
  try {
    const approval = approvals.approve(req.params.proposalId);
    logTypedAudit({
      event: 'rig.invocation.approved',
      ...rigAuditFields('rig.invocation.approved', undefined, operatorPrincipalForRequest(req)),
      correlation: { connectionId: approval.connectionId, proposalId: approval.proposalId, approvalId: approval.approvalId },
      details: { capabilityId: approval.capabilityId },
    });
    return res.json({ approval });
  } catch (error: unknown) {
    return replyError(res, 409, error instanceof Error ? error.message : String(error));
  }
});

export interface RigDataDeps {
  registry: Pick<RigRegistry, 'get' | 'update'>;
  runtime: Pick<RigRuntime, 'callTool' | 'readResource' | 'getPrompt'>;
  approvals: Pick<CapabilityApprovalStore, 'claim' | 'consume'>;
  provenance: Pick<ProvenanceStore, 'append'>;
}

/**
 * Degrade a connection's health after a failure, without ever suppressing the
 * audit or masking the primary error. The audit is emitted before this runs, so
 * a registry failure here cannot erase the terminal record.
 */
async function degradeHealthBestEffort(deps: RigDataDeps, connectionId: string): Promise<void> {
  try {
    if (deps.registry.get(connectionId)) {
      await deps.registry.update(connectionId, (value) => ({ ...value, health: { ...value.health, state: 'degraded' } }));
    }
  } catch {
    // Best effort. Health degradation is secondary to the audit record.
  }
}

/** A pre-serialized HTTP response, so the payload is built inside the audited boundary. */
export interface HandlerResult {
  status: number;
  payload: string;
}

export function mapStatusToErrorKind(status: number): RigErrorKind {
  switch (status) {
    case 400: return 'validation';
    case 403: return 'authorization';
    case 404: return 'not-found';
    case 409: return 'validation';
    case 500: return 'server-error';
    case 502: return 'server-error';
    default: return 'server-error';
  }
}

export function replyError(res: express.Response, status: number, message: string, details?: unknown) {
  const kind = mapStatusToErrorKind(status);
  return res.status(status).json({
    version: 2,
    error: createTypedRigError(kind, message, details),
  });
}

/** Serialize a small, trusted response object. Used only for denial and error bodies. */
function jbody(status: number, obj: unknown): HandlerResult {
  if (obj && typeof obj === 'object' && 'error' in obj && typeof (obj as { error: unknown }).error === 'string') {
    const message = (obj as { error: string }).error;
    const kind = mapStatusToErrorKind(status);
    return {
      status,
      payload: JSON.stringify({ version: 2, error: createTypedRigError(kind, message) }),
    };
  }
  return { status, payload: JSON.stringify(obj) };
}

/**
 * Look up the governed connection and capability. A read of PaneTera's own
 * connection state can fail (corrupt or unreadable registry), so the lookup is
 * fallible and the caller must audit that failure rather than let it escape.
 */
function lookupCapability(
  deps: RigDataDeps,
  connectionId: string,
  capabilityId: string,
): { connection: McpConnection | null; capability: CapabilityCard | null } {
  const connection = deps.registry.get(connectionId);
  const capability = connection ? findCapability(connection, capabilityId) : null;
  return { connection, capability };
}

/**
 * Invoke a governed tool. Exactly one terminal record is emitted on every
 * attempted action, including a failed registry lookup, and the record is always
 * written before any best-effort health update. The failure phase is tracked
 * explicitly so a consumption failure after a successful call reads as
 * finalization, not as the call. The success payload is serialized inside the
 * audited boundary, so a response that cannot be built is recorded as a
 * finalization error rather than a false success.
 */
export async function handleInvocation(
  deps: RigDataDeps,
  input: { connectionId?: unknown; capabilityId?: unknown; approvalId?: unknown; arguments?: unknown },
  principal?: OperatorPrincipal,
): Promise<HandlerResult> {
  const connectionId = String(input.connectionId ?? '');
  const capabilityId = String(input.capabilityId ?? '');

  let connection: McpConnection | null;
  let capability: CapabilityCard | null;
  try {
    ({ connection, capability } = lookupCapability(deps, connectionId, capabilityId));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logTypedAudit({
      event: 'rig.invocation.failed',
      ...rigInvocationFailureFields('registry-lookup', principal),
      correlation: { connectionId },
      details: { phase: 'registry-lookup', error: message },
    });
    return jbody(500, { error: 'Unable to read connection state.' });
  }

  if (!connection || connection.state !== 'connected' || !capability || capability.kind !== 'tool' || !capability.enabled) {
    logTypedAudit({
      event: 'rig.invocation.failed',
      ...rigInvocationFailureFields('target-invalid', principal),
      correlation: { connectionId },
      details: { phase: 'target-invalid', reason: 'enabled connected tool not found' },
    });
    return jbody(409, { error: 'Enabled connected tool not found.' });
  }

  const argumentsValue = input.arguments && typeof input.arguments === 'object' && !Array.isArray(input.arguments)
    ? (input.arguments as Record<string, unknown>)
    : {};

  const limitsCheck = checkArgumentLimits(argumentsValue);
  if (!limitsCheck.ok) {
    const errorMsg = limitsCheck.error || 'Argument payload limits exceeded.';
    logTypedAudit({
      event: 'rig.invocation.failed',
      ...rigInvocationFailureFields('target-invalid', principal),
      correlation: { connectionId },
      details: { phase: 'argument-limits', error: errorMsg },
    });
    return jbody(400, { error: errorMsg });
  }

  const validation = validateToolArguments(capability.inputSchema, argumentsValue);
  if (!validation.valid) {
    const errorMsg = validation.error || 'Invalid tool arguments.';
    logTypedAudit({
      event: 'rig.invocation.failed',
      ...rigInvocationFailureFields('target-invalid', principal),
      correlation: { connectionId },
      details: { phase: 'argument-validation', error: errorMsg },
    });
    return jbody(400, { error: errorMsg });
  }

  let phase: InvocationPhase = 'approval-claim';
  let approval: { proposalId: string; approvalId: string } | undefined;
  try {
    const claim = deps.approvals.claim(String(input.approvalId ?? ''), {
      connectionId,
      capabilityId,
      capabilityDigest: capability.structuralDigest,
      arguments: argumentsValue,
    });
    approval = claim.approval;
    const claimId = claim.claimId;

    phase = 'connector-call';
    let output: unknown;
    try {
      output = await deps.runtime.callTool(connectionId, capability.name, argumentsValue);
    } catch (callError) {
      // Release the claim, but never let a consumption error mask the call error.
      try { deps.approvals.consume(claim.approval.approvalId, claimId); } catch { /* best effort */ }
      throw callError;
    }

    // The call succeeded; everything after this is local finalization, so a
    // consumption, provenance, or serialization failure is attributed to
    // finalization.
    phase = 'local-finalization';
    deps.approvals.consume(claim.approval.approvalId, claimId);
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
    // Build the response before persisting provenance or recording success. If
    // the untrusted connector output cannot be serialized, this throws without
    // leaving a verified provenance record for a response the client never got.
    const payload = JSON.stringify({ result: output, provenance: record });
    deps.provenance.append(record);
    await deps.registry.update(connectionId, (value) => ({
      ...value,
      health: { state: 'current', lastSuccessfulContact: new Date().toISOString() },
    }));
    logTypedAudit({
      event: 'rig.invocation.completed',
      ...rigAuditFields('rig.invocation.completed', connection),
      correlation: { connectionId, proposalId: approval.proposalId, approvalId: approval.approvalId, parentRecordId: record.recordId },
      details: { capabilityId, provenanceRecordId: record.recordId, outputDigest: record.outputDigest },
    });
    return { status: 200, payload };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // Guaranteed terminal record, before any best-effort health update.
    if (phase === 'approval-claim') {
      // The rejected approvalId is unverified, so it is not recorded as
      // authoritative correlation.
      logTypedAudit({
        event: 'rig.invocation.failed',
        ...rigInvocationFailureFields('approval-claim', principal),
        correlation: { connectionId },
        details: { phase, error: message },
      });
    } else {
      logTypedAudit({
        event: 'rig.invocation.failed',
        ...rigInvocationFailureFields(phase, principal),
        correlation: { connectionId, proposalId: approval?.proposalId, approvalId: approval?.approvalId },
        details: { phase, error: message },
      });
    }
    await degradeHealthBestEffort(deps, connectionId);
    return jbody(409, { error: message });
  }
}

export function expandUriTemplate(template: string, parameters?: Record<string, string>): string {
  if (!parameters) return template;
  return template.replace(/\{([^}]+)\}/g, (_, key) => parameters[key] ?? `{${key}}`);
}

/** Read a governed resource. One terminal record per attempted action, audit before health. */
export async function handleResourceRead(
  deps: RigDataDeps,
  input: { connectionId?: unknown; capabilityId?: unknown; parameters?: unknown },
  principal?: OperatorPrincipal,
): Promise<HandlerResult> {
  const connectionId = String(input.connectionId ?? '');
  const capabilityId = String(input.capabilityId ?? '');
  const parameters = input.parameters && typeof input.parameters === 'object' && !Array.isArray(input.parameters)
    ? (input.parameters as Record<string, string>)
    : undefined;

  let connection: McpConnection | null;
  let capability: CapabilityCard | null;
  try {
    ({ connection, capability } = lookupCapability(deps, connectionId, capabilityId));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logTypedAudit({
      event: 'rig.resource.failed',
      ...rigAuditFields('rig.resource.failed'),
      correlation: { connectionId },
      details: { capabilityId, phase: 'registry-lookup', error: message },
    });
    return jbody(500, { error: 'Unable to read connection state.' });
  }

  if (!connection || connection.state !== 'connected' || !capability || capability.kind !== 'resource' || !capability.enabled || capability.permission === 'denied') {
    logTypedAudit({
      event: 'rig.resource.denied',
      ...rigAuditFields('rig.resource.denied', undefined, principal),
      correlation: { connectionId },
      details: { capabilityId, reason: 'enabled connected resource not found' },
    });
    return jbody(403, { error: 'Enabled connected resource not found.' });
  }

  const declaration = capability.rawDeclaration as Record<string, unknown>;
  const rawUri = typeof declaration.uri === 'string' ? declaration.uri : typeof declaration.uriTemplate === 'string' ? declaration.uriTemplate : '';

  if (!rawUri) {
    logTypedAudit({
      event: 'rig.resource.failed',
      ...rigAuditFields('rig.resource.failed'),
      correlation: { connectionId },
      details: { capabilityId, reason: 'resource has no fixed uri or uriTemplate' },
    });
    return jbody(422, { error: 'Resource has no fixed URI or uriTemplate.' });
  }

  const targetUri = expandUriTemplate(rawUri, parameters);

  try {
    const result = await deps.runtime.readResource(connectionId, targetUri);
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
    const payload = JSON.stringify({ result, provenance: record });
    deps.provenance.append(record);
    await deps.registry.update(connectionId, (value) => ({
      ...value,
      health: { state: 'current', lastSuccessfulContact: new Date().toISOString() },
    }));
    logTypedAudit({
      event: 'rig.resource.read',
      ...rigAuditFields('rig.resource.read', connection),
      correlation: { connectionId, parentRecordId: record.recordId },
      details: { capabilityId, provenanceRecordId: record.recordId },
    });
    return { status: 200, payload };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logTypedAudit({
      event: 'rig.resource.failed',
      ...rigAuditFields('rig.resource.failed'),
      correlation: { connectionId },
      details: { capabilityId, error: message },
    });
    await degradeHealthBestEffort(deps, connectionId);
    return jbody(502, { error: message });
  }
}

/** Read a governed prompt. One terminal record per attempted action, audit before health. */
export async function handlePromptGet(
  deps: RigDataDeps,
  input: { connectionId?: unknown; capabilityId?: unknown; arguments?: unknown },
  principal?: OperatorPrincipal,
): Promise<HandlerResult> {
  const connectionId = String(input.connectionId ?? '');
  const capabilityId = String(input.capabilityId ?? '');

  let connection: McpConnection | null;
  let capability: CapabilityCard | null;
  try {
    ({ connection, capability } = lookupCapability(deps, connectionId, capabilityId));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logTypedAudit({
      event: 'rig.prompt.failed',
      ...rigAuditFields('rig.prompt.failed'),
      correlation: { connectionId },
      details: { capabilityId, phase: 'registry-lookup', error: message },
    });
    return jbody(500, { error: 'Unable to read connection state.' });
  }

  if (!connection || connection.state !== 'connected' || !capability || capability.kind !== 'prompt' || !capability.enabled || capability.permission === 'denied') {
    logTypedAudit({
      event: 'rig.prompt.denied',
      ...rigAuditFields('rig.prompt.denied', undefined, principal),
      correlation: { connectionId },
      details: { capabilityId, reason: 'enabled connected prompt not found' },
    });
    return jbody(403, { error: 'Enabled connected prompt not found.' });
  }
  const args = input.arguments;
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.values(args).some((value) => typeof value !== 'string')) {
    // Not a policy denial: the operator supplied malformed arguments, so the
    // request failed input validation before policy was consulted.
    logTypedAudit({
      event: 'rig.prompt.invalid',
      ...rigAuditFields('rig.prompt.invalid', undefined, principal),
      correlation: { connectionId },
      details: { capabilityId, reason: 'prompt arguments must be a string map' },
    });
    return jbody(422, { error: 'Prompt arguments must be a string map.' });
  }
  try {
    const result = await deps.runtime.getPrompt(connectionId, capability.name, args as Record<string, string>);
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
    const payload = JSON.stringify({ result, provenance: record });
    deps.provenance.append(record);
    await deps.registry.update(connectionId, (value) => ({
      ...value,
      health: { state: 'current', lastSuccessfulContact: new Date().toISOString() },
    }));
    logTypedAudit({
      event: 'rig.prompt.read',
      ...rigAuditFields('rig.prompt.read', connection),
      correlation: { connectionId, parentRecordId: record.recordId },
      details: { capabilityId, provenanceRecordId: record.recordId },
    });
    return { status: 200, payload };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logTypedAudit({
      event: 'rig.prompt.failed',
      ...rigAuditFields('rig.prompt.failed'),
      correlation: { connectionId },
      details: { capabilityId, error: message },
    });
    await degradeHealthBestEffort(deps, connectionId);
    return jbody(502, { error: message });
  }
}

const rigDataDeps = (): RigDataDeps => ({ registry, runtime, approvals, provenance });

function sendHandlerResult(res: express.Response, result: HandlerResult): express.Response {
  return res.status(result.status).type('application/json').send(result.payload);
}

rigRouter.post('/invocations', async (req, res) => {
  const result = await handleInvocation(rigDataDeps(), req.body ?? {}, operatorPrincipalForRequest(req));
  return sendHandlerResult(res, result);
});

rigRouter.get('/resources', (_req, res) => {
  const resources = registry.list().flatMap((connection) => connection.capabilities.resources
    .filter((resource) => connection.state === 'connected' && resource.enabled)
    .map((resource) => ({ ...resource, connectionId: connection.connectionId, connectionName: connection.displayName })));
  res.json({ resources });
});

rigRouter.post('/resources/read', async (req, res) => {
  const result = await handleResourceRead(rigDataDeps(), req.body ?? {}, operatorPrincipalForRequest(req));
  return sendHandlerResult(res, result);
});

rigRouter.post('/prompts/get', async (req, res) => {
  const result = await handlePromptGet(rigDataDeps(), req.body ?? {}, operatorPrincipalForRequest(req));
  return sendHandlerResult(res, result);
});

rigRouter.get('/provenance', (_req, res) => {
  res.json({ records: provenance.list() });
});
