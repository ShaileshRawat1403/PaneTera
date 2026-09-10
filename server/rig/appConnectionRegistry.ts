// server/rig/appConnectionRegistry.ts
//
// Declares PaneTera's built-in application MCP connections (Blender, REAPER)
// in the Rig registry.
//
// Declaring a connection starts nothing. The Rig runtime launches the child
// only after the operator reviews and approves the exact launch
// specification, and owns the process from then until disconnect or
// shutdown (ADR-002, lifecycle amendment).
//
// Registration is deterministic. The expected launch specification is
// derived from this module's location, not the working directory. A managed
// record whose transport differs is reconciled to it and returned to
// approval-required, so a changed launch specification never runs under an
// earlier approval. Reconciliation reports changed fields by name only,
// never binding values.
//
// Blender or REAPER not running is a normal disconnected state, never a
// registration failure. Failing to declare an expected connection is a
// PaneTera configuration error, recorded as rig.connection.registration-failed.
//
// Isolation: these children run with isolationMode 'none'. Rig reports
// memory, CPU, file-descriptor, and filesystem limits as unenforced for such
// connections rather than presenting them as isolated.

import path from 'path';
import { logTypedAudit } from '../auditRecord';
import { rigAuditFields } from './auditClassification';
import { digest } from './canonical';
import { connectionIdForName, type RigRegistry } from './registry';
import type { McpTransportSpec, StdioTransportSpec } from './types';

/** The process environment a launch specification is derived from. */
type Environment = Readonly<Record<string, string | undefined>>;

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const TSX_PATH = path.join(PROJECT_ROOT, 'node_modules', '.bin', 'tsx');

export interface AppMcpConnection {
  connectionId: string;
  displayName: string;
  entryPoint: string;
}

export const APP_CONNECTIONS: readonly AppMcpConnection[] = [
  { connectionId: 'blender', displayName: 'Blender', entryPoint: path.join(PROJECT_ROOT, 'server', 'mcp', 'blenderMcpServer.ts') },
  { connectionId: 'reaper', displayName: 'REAPER', entryPoint: path.join(PROJECT_ROOT, 'server', 'mcp', 'reaperMcpServer.ts') },
];

/** The launch specification a managed application connection must have. */
export function expectedAppTransport(app: AppMcpConnection, env: Environment = process.env): StdioTransportSpec {
  return {
    kind: 'stdio',
    executablePath: TSX_PATH,
    argv: [app.entryPoint],
    cwd: PROJECT_ROOT,
    // No PaneTera credential is bound: the Blender and REAPER MCP servers read
    // none. An earlier version bound PORTAL_TOKEN here; reconciliation removes
    // that persisted binding, and launch verification rejects it anyway.
    environment: [
      { name: 'NODE_ENV', source: 'literal', value: env.NODE_ENV || 'development' },
      { name: 'PATH', source: 'literal', value: env.PATH || '/usr/local/bin:/usr/bin:/bin' },
    ],
    isolationMode: 'none',
  };
}

/**
 * Names of the fields that differ from the expected transport. Binding values
 * are compared by digest and never included in the result.
 */
export function transportDifferences(actual: McpTransportSpec, expected: StdioTransportSpec): string[] {
  if (actual.kind !== 'stdio') return ['kind'];
  const differences: string[] = [];
  if (actual.executablePath !== expected.executablePath) differences.push('executablePath');
  if (digest(actual.argv) !== digest(expected.argv)) differences.push('argv');
  if (actual.cwd !== expected.cwd) differences.push('cwd');
  if (actual.isolationMode !== expected.isolationMode) differences.push('isolationMode');

  const actualBindings = new Map((actual.environment ?? []).map((binding) => [binding.name, binding]));
  const expectedBindings = new Map(expected.environment.map((binding) => [binding.name, binding]));
  for (const name of [...new Set([...actualBindings.keys(), ...expectedBindings.keys()])].sort()) {
    const current = actualBindings.get(name);
    const wanted = expectedBindings.get(name);
    if (!wanted) differences.push(`environment:${name}:removed`);
    else if (!current) differences.push(`environment:${name}:added`);
    else if (digest(current) !== digest(wanted)) differences.push(`environment:${name}:changed`);
  }
  return differences;
}

export type AppConnectionRegistration =
  | { connectionId: string; outcome: 'registered' | 'unchanged' }
  | { connectionId: string; outcome: 'reconciled'; changedFields: string[] }
  | { connectionId: string; outcome: 'failed'; error: string };

type RegistryAccess = Pick<RigRegistry, 'get' | 'create' | 'update'>;

let registrationQueue: Promise<unknown> = Promise.resolve();

/**
 * Declare every built-in application connection. Calls are serialized and
 * applications handled one at a time, so registration can never race itself
 * into a duplicate record, and one application's failure does not block the
 * other's.
 */
export function ensureAppConnections(
  registry: RegistryAccess,
  env: Environment = process.env,
): Promise<AppConnectionRegistration[]> {
  const run = registrationQueue.then(() => declareAll(registry, env));
  registrationQueue = run.then(() => undefined, () => undefined);
  return run;
}

async function declareAll(registry: RegistryAccess, env: Environment): Promise<AppConnectionRegistration[]> {
  const results: AppConnectionRegistration[] = [];
  for (const app of APP_CONNECTIONS) {
    try {
      results.push(await declare(registry, app, env));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logTypedAudit({
        event: 'rig.connection.registration-failed',
        ...rigAuditFields('rig.connection.registration-failed'),
        correlation: { connectionId: app.connectionId },
        details: { error: message },
      });
      results.push({ connectionId: app.connectionId, outcome: 'failed', error: message });
    }
  }
  return results;
}

async function declare(registry: RegistryAccess, app: AppMcpConnection, env: Environment): Promise<AppConnectionRegistration> {
  const expected = expectedAppTransport(app, env);
  const existing = registry.get(app.connectionId);

  if (!existing) {
    if (connectionIdForName(app.displayName) !== app.connectionId) {
      throw new Error(`${app.displayName} would not register under the connection id "${app.connectionId}".`);
    }
    const record = await registry.create({
      displayName: app.displayName,
      sourceClass: 'panetera-managed',
      transport: expected,
      endpointRef: expected.executablePath,
    });
    logTypedAudit({
      event: 'rig.connection.registered',
      ...rigAuditFields('rig.connection.registered'),
      correlation: { connectionId: app.connectionId },
      details: { state: record.state, isolationMode: expected.isolationMode },
    });
    return { connectionId: app.connectionId, outcome: 'registered' };
  }

  if (existing.sourceClass !== 'panetera-managed') {
    throw new Error(`Rig connection "${app.connectionId}" exists but is not PaneTera-managed, so it was left unchanged.`);
  }

  const changedFields = transportDifferences(existing.transport, expected);
  if (changedFields.length === 0) return { connectionId: app.connectionId, outcome: 'unchanged' };

  if (existing.state === 'connected' || existing.state === 'starting') {
    throw new Error(`Rig connection "${app.connectionId}" is ${existing.state}; its launch specification cannot be reconciled while it runs.`);
  }

  await registry.update(app.connectionId, (record) => ({
    ...record,
    transport: expected,
    endpointRef: expected.executablePath,
    executableDigest: null,
    entryPointDigest: null,
    launchSpecDigest: null,
    connectionApprovalId: null,
    state: 'approval-required',
  }));
  logTypedAudit({
    event: 'rig.connection.reconciled',
    ...rigAuditFields('rig.connection.reconciled'),
    correlation: { connectionId: app.connectionId },
    details: { changedFields, state: 'approval-required' },
  });
  return { connectionId: app.connectionId, outcome: 'reconciled', changedFields };
}
