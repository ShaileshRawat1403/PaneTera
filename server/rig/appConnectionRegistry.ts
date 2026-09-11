// server/rig/appConnectionRegistry.ts
//
// Turns PaneTera-managed application declarations into Rig registry records.
//
// This module owns how an application is declared, not which applications
// exist. Core PaneTera declares none: an integration declares itself only once
// it is safe and truthful.
//
// Declaring a connection starts nothing. The Rig runtime launches the child
// only after the operator reviews and approves the exact launch
// specification, and owns the process from then until disconnect or shutdown
// (ADR-002, lifecycle amendment).
//
// The launch identity is explicit: the Node executable running PaneTera, the
// absolute tsx CLI, and the absolute MCP server entry. No PATH, NODE_ENV, or
// other ambient environment is persisted. A managed record whose launch
// specification differs is reconciled and returned to approval-required, so a
// changed specification never runs under an earlier approval. Changed fields
// are reported by name only, never binding values.
//
// Isolation: managed children run with isolationMode 'none'. Rig reports
// memory, CPU, file-descriptor, and filesystem limits as unenforced for such
// connections rather than presenting them as isolated.

import path from 'path';
import { logTypedAudit } from '../auditRecord';
import { rigAuditFields } from './auditClassification';
import { digest } from './canonical';
import { connectionIdForName, type RigRegistry } from './registry';
import type { McpTransportSpec, StdioTransportSpec } from './types';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const TSX_CLI = path.join(PROJECT_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');

export interface AppMcpConnection {
  connectionId: string;
  displayName: string;
  /** Absolute path to the MCP server entry file. */
  entryPoint: string;
}

/** Applications PaneTera manages. Empty until an integration declares itself. */
export const APP_CONNECTIONS: readonly AppMcpConnection[] = [];

/** The launch specification a managed application connection must have. */
export function expectedAppTransport(app: AppMcpConnection): StdioTransportSpec {
  return {
    kind: 'stdio',
    executablePath: process.execPath,
    argv: [TSX_CLI, app.entryPoint],
    cwd: PROJECT_ROOT,
    environment: [],
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
 * Declare managed application connections. Calls are serialized and
 * applications handled one at a time, so registration can never race itself
 * into a duplicate record, and one application's failure does not block
 * another's.
 */
export function ensureAppConnections(
  registry: RegistryAccess,
  declarations: readonly AppMcpConnection[] = APP_CONNECTIONS,
): Promise<AppConnectionRegistration[]> {
  const run = registrationQueue.then(() => declareAll(registry, declarations));
  registrationQueue = run.then(() => undefined, () => undefined);
  return run;
}

async function declareAll(registry: RegistryAccess, declarations: readonly AppMcpConnection[]): Promise<AppConnectionRegistration[]> {
  const results: AppConnectionRegistration[] = [];
  for (const app of declarations) {
    try {
      results.push(await declare(registry, app));
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

async function declare(registry: RegistryAccess, app: AppMcpConnection): Promise<AppConnectionRegistration> {
  if (!path.isAbsolute(app.entryPoint)) {
    throw new Error(`${app.displayName} must declare an absolute MCP server entry point.`);
  }
  const expected = expectedAppTransport(app);
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
