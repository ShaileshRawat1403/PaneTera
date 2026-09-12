// test/appConnectionRegistry.test.ts
//
// Managed application declarations are deterministic, spawn nothing, bind an
// explicit launch identity with no ambient environment, reconcile drift back
// to approval-required, and record failure as evidence. Core PaneTera
// declares no applications; these cases supply a fixture declaration.

process.env.NODE_ENV = 'test';

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RigRegistry } from '../server/rig/registry';
import { resolveAuditLogPath } from '../server/audit';
import { verifyStdioSpec } from '../server/rig/transportSecurity';
import { APP_CONNECTIONS, ensureAppConnections, expectedAppTransport, type AppMcpConnection } from '../server/rig/appConnectionRegistry';
import type { StdioTransportSpec } from '../server/rig/types';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const FIXTURE: AppMcpConnection = {
  connectionId: 'fixture-app',
  displayName: 'Fixture App',
  entryPoint: path.join(REPO_ROOT, 'test', 'fixtures', 'rigMcpServer.mjs'),
};

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

describe('ensureAppConnections', () => {
  const dirs: string[] = [];
  const freshRegistry = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-app-registry-'));
    dirs.push(dir);
    return { registry: new RigRegistry(dir), dir };
  };
  after(() => { for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true }); });

  it('core PaneTera declares no applications', async () => {
    assert.deepEqual(APP_CONNECTIONS, []);
    const { registry } = freshRegistry();
    assert.deepEqual(await ensureAppConnections(registry), []);
    assert.deepEqual(registry.list(), []);
  });

  it('declares an explicit launch identity with no ambient environment, and is stable on repeat', async () => {
    const { registry } = freshRegistry();
    assert.deepEqual(await ensureAppConnections(registry, [FIXTURE]), [{ connectionId: 'fixture-app', outcome: 'registered' }]);
    const record = registry.get('fixture-app')!;
    const transport = record.transport as StdioTransportSpec;
    assert.equal(record.sourceClass, 'panetera-managed');
    assert.equal(record.state, 'approval-required');
    assert.equal(transport.executablePath, process.execPath);
    assert.deepEqual(transport.argv, [path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), FIXTURE.entryPoint]);
    assert.equal(transport.cwd, REPO_ROOT);
    assert.deepEqual(transport.environment, []);
    assert.equal(transport.isolationMode, 'none');
    assert.deepEqual(await ensureAppConnections(registry, [FIXTURE]), [{ connectionId: 'fixture-app', outcome: 'unchanged' }]);
  });

  it('serializes concurrent calls so a connection is created once', async () => {
    const { registry } = freshRegistry();
    const [first, second] = await Promise.all([ensureAppConnections(registry, [FIXTURE]), ensureAppConnections(registry, [FIXTURE])]);
    assert.deepEqual(first.map((r) => r.outcome), ['registered']);
    assert.deepEqual(second.map((r) => r.outcome), ['unchanged']);
    assert.equal(registry.list().length, 1);
  });

  it('reconciles a drifted launch specification and returns it to approval', async () => {
    const { registry } = freshRegistry();
    await ensureAppConnections(registry, [FIXTURE]);
    await registry.update('fixture-app', (record) => ({
      ...record,
      transport: { ...(record.transport as StdioTransportSpec), cwd: '/tmp' },
      state: 'stopped',
      launchSpecDigest: 'approved-before',
      connectionApprovalId: 'approval-before',
    }));
    assert.deepEqual(await ensureAppConnections(registry, [FIXTURE]), [{ connectionId: 'fixture-app', outcome: 'reconciled', changedFields: ['cwd'] }]);
    const record = registry.get('fixture-app')!;
    assert.deepEqual(record.transport, expectedAppTransport(FIXTURE));
    assert.equal(record.state, 'approval-required');
    assert.equal(record.launchSpecDigest, null);
    assert.equal(record.connectionApprovalId, null);
  });

  it('removes persisted ambient bindings, including a credential, without recording their values', async () => {
    const { registry, dir } = freshRegistry();
    await ensureAppConnections(registry, [FIXTURE]);
    const secret = `legacy-secret-${Date.now()}`;
    await registry.update('fixture-app', (record) => ({
      ...record,
      state: 'stopped',
      transport: {
        ...(record.transport as StdioTransportSpec),
        executablePath: '/usr/local/bin/tsx',
        argv: [FIXTURE.entryPoint],
        environment: [
          { name: 'NODE_ENV', source: 'literal', value: 'test' },
          { name: 'PORTAL_TOKEN', source: 'literal', value: secret },
          { name: 'PATH', source: 'literal', value: '/opt/somewhere/bin:/usr/bin' },
        ],
      },
    }));
    const [result] = await ensureAppConnections(registry, [FIXTURE]);
    assert.deepEqual(result, {
      connectionId: 'fixture-app',
      outcome: 'reconciled',
      changedFields: ['executablePath', 'argv', 'environment:NODE_ENV:removed', 'environment:PATH:removed', 'environment:PORTAL_TOKEN:removed'],
    });
    assert.deepEqual((registry.get('fixture-app')!.transport as StdioTransportSpec).environment, []);
    assert.ok(!fs.readFileSync(path.join(dir, 'rig', 'connections.json'), 'utf8').includes(secret));
    assert.ok(!fs.readFileSync(resolveAuditLogPath(), 'utf8').includes(secret));
  });

  it('passes launch verification with an explicit executable and no PATH', async () => {
    const verified = await verifyStdioSpec(expectedAppTransport(FIXTURE));
    assert.deepEqual(Object.keys(verified.env).sort(), ['LANG', 'PATH']);
    assert.equal(verified.env.PATH, '/usr/bin:/bin', 'only the fixed base PATH, nothing persisted');
    const legacy: StdioTransportSpec = { ...expectedAppTransport(FIXTURE), environment: [{ name: 'PORTAL_TOKEN', source: 'literal', value: 'x' }] };
    await assert.rejects(verifyStdioSpec(legacy), /Environment binding PORTAL_TOKEN is not permitted/);
  });

  it('rejects a relative entry point with evidence', async () => {
    const { registry } = freshRegistry();
    const before = auditCount('rig.connection.registration-failed', 'relative-app');
    const [result] = await ensureAppConnections(registry, [{ connectionId: 'relative-app', displayName: 'Relative App', entryPoint: 'server/mcp/x.ts' }]);
    assert.equal(result.outcome, 'failed');
    assert.match((result as { error: string }).error, /absolute MCP server entry point/);
    assert.equal(auditCount('rig.connection.registration-failed', 'relative-app'), before + 1);
    assert.deepEqual(registry.list(), []);
  });

  it('refuses to overwrite a connection it does not manage, or one that is running, and records the failure', async () => {
    const { registry } = freshRegistry();
    const foreign: StdioTransportSpec = { kind: 'stdio', executablePath: '/usr/bin/true', argv: [], cwd: '/', environment: [], isolationMode: 'none' };
    await registry.create({ displayName: 'Fixture App', sourceClass: 'local-user-installed', transport: foreign, endpointRef: '/usr/bin/true' });
    const before = auditCount('rig.connection.registration-failed', 'fixture-app');
    const [foreignResult] = await ensureAppConnections(registry, [FIXTURE]);
    assert.equal(foreignResult.outcome, 'failed');
    assert.match((foreignResult as { error: string }).error, /not PaneTera-managed/);
    assert.deepEqual(registry.get('fixture-app')!.transport, foreign);

    const running = freshRegistry().registry;
    await ensureAppConnections(running, [FIXTURE]);
    await running.update('fixture-app', (record) => ({ ...record, state: 'connected', transport: { ...(record.transport as StdioTransportSpec), cwd: '/tmp' } }));
    const [runningResult] = await ensureAppConnections(running, [FIXTURE]);
    assert.match((runningResult as { error: string }).error, /cannot be reconciled while it runs/);
    assert.equal((running.get('fixture-app')!.transport as StdioTransportSpec).cwd, '/tmp');
    assert.equal(auditCount('rig.connection.registration-failed', 'fixture-app'), before + 2);
  });
});
