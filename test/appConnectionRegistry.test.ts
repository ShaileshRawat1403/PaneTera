// test/appConnectionRegistry.test.ts
//
// Declaring Blender and REAPER is deterministic, spawns nothing, reconciles
// drift back to approval-required, and records a failure as evidence
// instead of warning quietly.

process.env.NODE_ENV = 'test';

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAuditLogPath } from '../server/audit';
import { RigRegistry } from '../server/rig/registry';
import { verifyStdioSpec } from '../server/rig/transportSecurity';
import { APP_CONNECTIONS, ensureAppConnections, expectedAppTransport } from '../server/rig/appConnectionRegistry';
import type { StdioTransportSpec } from '../server/rig/types';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const AUDIT_LOG = resolveAuditLogPath();
const ENV = { PATH: '/usr/bin:/bin', NODE_ENV: 'test', PORTAL_TOKEN: 'ambient-token-must-not-be-bound' };
const [BLENDER, REAPER] = APP_CONNECTIONS;

function auditCount(event: string, connectionId: string): number {
  if (!fs.existsSync(AUDIT_LOG)) return 0;
  return fs.readFileSync(AUDIT_LOG, 'utf8').split('\n').filter((line) => {
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
    return new RigRegistry(dir);
  };
  after(() => { for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true }); });

  it('declares both applications from the module location, awaiting approval, and is stable on repeat', async () => {
    const registry = freshRegistry();
    assert.deepEqual(
      (await ensureAppConnections(registry, ENV)).map((r) => [r.connectionId, r.outcome]),
      [['blender', 'registered'], ['reaper', 'registered']],
    );
    for (const app of [BLENDER, REAPER]) {
      const record = registry.get(app.connectionId)!;
      const transport = record.transport as StdioTransportSpec;
      assert.equal(record.sourceClass, 'panetera-managed');
      assert.equal(record.state, 'approval-required');
      assert.equal(transport.executablePath, path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx'));
      assert.deepEqual(transport.argv, [path.join(REPO_ROOT, 'server', 'mcp', `${app.connectionId}McpServer.ts`)]);
      assert.equal(transport.cwd, path.resolve(REPO_ROOT));
      assert.equal(transport.isolationMode, 'none');
      assert.deepEqual(transport, expectedAppTransport(app, ENV));
    }
    assert.deepEqual(
      (await ensureAppConnections(registry, ENV)).map((r) => r.outcome),
      ['unchanged', 'unchanged'],
    );
  });

  it('serializes concurrent calls so a connection is created once', async () => {
    const registry = freshRegistry();
    const [first, second] = await Promise.all([ensureAppConnections(registry, ENV), ensureAppConnections(registry, ENV)]);
    assert.deepEqual(first.map((r) => r.outcome), ['registered', 'registered']);
    assert.deepEqual(second.map((r) => r.outcome), ['unchanged', 'unchanged']);
    assert.equal(registry.list().length, 2);
  });

  it('reconciles a drifted launch specification and returns it to approval', async () => {
    const registry = freshRegistry();
    await ensureAppConnections(registry, ENV);
    await registry.update('blender', (record) => ({
      ...record,
      transport: { ...(record.transport as StdioTransportSpec), cwd: '/tmp' },
      state: 'stopped',
      launchSpecDigest: 'approved-before',
      connectionApprovalId: 'approval-before',
    }));

    const results = await ensureAppConnections(registry, ENV);
    assert.deepEqual(results[0], { connectionId: 'blender', outcome: 'reconciled', changedFields: ['cwd'] });
    const record = registry.get('blender')!;
    assert.deepEqual(record.transport, expectedAppTransport(BLENDER, ENV));
    assert.equal(record.state, 'approval-required');
    assert.equal(record.launchSpecDigest, null);
    assert.equal(record.connectionApprovalId, null);
  });

  it('binds no PaneTera credential into a managed child', () => {
    for (const app of APP_CONNECTIONS) {
      const names = expectedAppTransport(app, ENV).environment.map((binding) => binding.name);
      assert.deepEqual(names, ['NODE_ENV', 'PATH']);
      assert.ok(!JSON.stringify(expectedAppTransport(app, ENV)).includes('ambient-token-must-not-be-bound'));
    }
  });

  it('removes a persisted PORTAL_TOKEN binding without recording its value', async () => {
    const registry = freshRegistry();
    await ensureAppConnections(registry, ENV);
    const secret = `legacy-secret-${Date.now()}`;
    for (const connectionId of ['blender', 'reaper']) {
      await registry.update(connectionId, (record) => {
        const transport = record.transport as StdioTransportSpec;
        return {
          ...record,
          state: 'stopped',
          transport: {
            ...transport,
            environment: [
              transport.environment[0],
              { name: 'PORTAL_TOKEN', source: 'literal', value: secret },
              ...transport.environment.slice(1),
            ],
          },
        };
      });
    }

    const results = await ensureAppConnections(registry, ENV);
    assert.deepEqual(results, [
      { connectionId: 'blender', outcome: 'reconciled', changedFields: ['environment:PORTAL_TOKEN:removed'] },
      { connectionId: 'reaper', outcome: 'reconciled', changedFields: ['environment:PORTAL_TOKEN:removed'] },
    ]);
    for (const connectionId of ['blender', 'reaper']) {
      const record = registry.get(connectionId)!;
      assert.deepEqual((record.transport as StdioTransportSpec).environment.map((binding) => binding.name), ['NODE_ENV', 'PATH']);
      assert.equal(record.state, 'approval-required');
    }
    const persisted = fs.readFileSync(path.join(dirs.at(-1)!, 'rig', 'connections.json'), 'utf8');
    assert.ok(!persisted.includes(secret), 'the persisted registry no longer holds the value');
    assert.ok(!fs.readFileSync(AUDIT_LOG, 'utf8').includes(secret), 'the audit never records the value');
  });

  it('passes launch verification now that no credential is bound, where the old binding was rejected', async () => {
    for (const app of APP_CONNECTIONS) {
      const expected = expectedAppTransport(app, { ...ENV, PATH: process.env.PATH });
      const verified = await verifyStdioSpec(expected);
      assert.deepEqual(Object.keys(verified.env).sort(), ['LANG', 'NODE_ENV', 'PATH']);

      const legacy: StdioTransportSpec = {
        ...expected,
        environment: [...expected.environment, { name: 'PORTAL_TOKEN', source: 'literal', value: 'x' }],
      };
      await assert.rejects(verifyStdioSpec(legacy), /Environment binding PORTAL_TOKEN is not permitted/);
    }
  });

  it('refuses to overwrite a connection it does not manage, or one that is running, and records the failure', async () => {
    const registry = freshRegistry();
    const foreign: StdioTransportSpec = { kind: 'stdio', executablePath: '/usr/bin/true', argv: [], cwd: '/', environment: [], isolationMode: 'none' };
    await registry.create({ displayName: 'Blender', sourceClass: 'local-user-installed', transport: foreign, endpointRef: '/usr/bin/true' });
    await ensureAppConnections(registry, ENV);
    await registry.update('reaper', (record) => ({ ...record, state: 'connected', transport: { ...(record.transport as StdioTransportSpec), cwd: '/tmp' } }));

    const failuresBefore = auditCount('rig.connection.registration-failed', 'blender');
    const results = await ensureAppConnections(registry, ENV);
    assert.equal(results[0].outcome, 'failed');
    assert.match((results[0] as { error: string }).error, /not PaneTera-managed/);
    assert.equal(results[1].outcome, 'failed');
    assert.match((results[1] as { error: string }).error, /cannot be reconciled while it runs/);
    assert.deepEqual(registry.get('blender')!.transport, foreign, 'foreign record untouched');
    assert.equal((registry.get('reaper')!.transport as StdioTransportSpec).cwd, '/tmp', 'running record untouched');
    assert.equal(auditCount('rig.connection.registration-failed', 'blender'), failuresBefore + 1);
  });
});
