// test/launchIdentity.test.ts
//
// A governed launch identity binds the code that will execute: the
// executable, a runtime loader, and the MCP server source behind it. A change
// to any of them invalidates the approval that covered it.

process.env.NODE_ENV = 'test';

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyStdioSpec } from '../server/rig/transportSecurity';
import { RigRuntime } from '../server/rig/runtime';
import { RigRegistry } from '../server/rig/registry';
import { ensureAppConnections, expectedAppTransport } from '../server/rig/appConnectionRegistry';
import type { McpConnection, StdioTransportSpec } from '../server/rig/types';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const FIXTURE = path.join(REPO_ROOT, 'test', 'fixtures', 'rigMcpServer.mjs');
const dirs: string[] = [];
const tempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-launch-identity-'));
  dirs.push(dir);
  return dir;
};
after(() => { for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true }); });

function childrenWithMarker(marker: string): string[] {
  return execFileSync('ps', ['-A', '-o', 'args='], { encoding: 'utf8' }).split('\n').filter((line) => line.includes(`--marker=${marker}`));
}

describe('launch identity binds the code that runs', () => {
  it('binds every absolute file argument by content, including a server entry behind a loader', async () => {
    const dir = tempDir();
    const loader = path.join(dir, 'loader.mjs');
    const entry = path.join(dir, 'server.mjs');
    fs.writeFileSync(loader, 'export {};\n');
    fs.writeFileSync(entry, 'console.log("v1");\n');
    const spec: StdioTransportSpec = { kind: 'stdio', executablePath: process.execPath, argv: [loader, entry, '--flag=value'], cwd: dir, environment: [], isolationMode: 'none' };

    const first = await verifyStdioSpec(spec);
    assert.deepEqual(first.argvFileDigests.map((file) => file.index), [0, 1], 'flags are not files and are not digested');

    fs.writeFileSync(entry, 'console.log("v2");\n');
    const second = await verifyStdioSpec(spec);
    assert.equal(second.entryPointDigest, first.entryPointDigest, 'the loader in argv[0] is unchanged');
    assert.notEqual(second.launchSpecDigest, first.launchSpecDigest, 'a changed server entry changes the launch identity');

    fs.writeFileSync(loader, 'export const changed = true;\n');
    assert.notEqual((await verifyStdioSpec(spec)).launchSpecDigest, second.launchSpecDigest, 'a changed loader changes it too');
  });

  it('refuses to connect when the launch identity differs from the approved one, starting no child', async () => {
    const marker = randomUUID();
    const transport: StdioTransportSpec = { kind: 'stdio', executablePath: process.execPath, argv: [FIXTURE, `--marker=${marker}`], cwd: REPO_ROOT, environment: [], isolationMode: 'none' };
    const record = {
      connectionId: `approved-${marker.slice(0, 8)}`,
      displayName: 'Approved',
      sourceClass: 'local-user-installed',
      transport,
      endpointRef: process.execPath,
      executableDigest: null,
      entryPointDigest: null,
      launchSpecDigest: 'sha256:approved-before-the-change',
      state: 'starting',
      health: { state: 'not-measured', lastSuccessfulContact: null },
      capabilities: { tools: [], resources: [], prompts: [], structuralDigest: '', presentationDigest: '', discoveredAt: '', truncated: false },
      createdAt: 'now',
      updatedAt: 'now',
      connectionApprovalId: 'approval-1',
    } as unknown as McpConnection;

    const runtime = new RigRuntime();
    await assert.rejects(runtime.connect(record), /Launch identity changed after approval/);
    assert.deepEqual(childrenWithMarker(marker), [], 'no child was started');

    const verified = await verifyStdioSpec(transport);
    await runtime.connect({ ...record, launchSpecDigest: verified.launchSpecDigest });
    assert.equal(runtime.isConnected(record.connectionId), true, 'the matching identity connects');
    await runtime.disconnectAll();
  });

  it('returns an approved declaration to approval-required when its server source changes', async () => {
    const dir = tempDir();
    const entry = path.join(dir, 'server.mjs');
    fs.writeFileSync(entry, 'export {};\n');
    const app = { connectionId: 'source-app', displayName: 'Source App', entryPoint: entry };
    const registry = new RigRegistry(dir);

    await ensureAppConnections(registry, [app]);
    const approved = await verifyStdioSpec(expectedAppTransport(app));
    await registry.update('source-app', (record) => ({ ...record, state: 'stopped', launchSpecDigest: approved.launchSpecDigest, connectionApprovalId: 'approval-1' }));
    assert.deepEqual(await ensureAppConnections(registry, [app]), [{ connectionId: 'source-app', outcome: 'unchanged' }]);

    fs.writeFileSync(entry, 'export const changed = true;\n');
    assert.deepEqual(await ensureAppConnections(registry, [app]), [{ connectionId: 'source-app', outcome: 'reconciled', changedFields: ['launchIdentity'] }]);
    const record = registry.get('source-app')!;
    assert.equal(record.state, 'approval-required');
    assert.equal(record.launchSpecDigest, null);
    assert.equal(record.connectionApprovalId, null);
  });
});
