// test/rigLifecycle.test.ts
//
// RigRuntime owns the MCP child processes it starts: one child per
// connection attempt, faults attributed only to the active transport, and
// every child terminated on shutdown. These run real stdio children from
// test/fixtures/rigMcpServer.mjs, each tagged with a unique argv marker so
// the process table can be checked directly.

process.env.NODE_ENV = 'test';

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { RigRuntime } from '../server/rig/runtime';
import type { McpConnection } from '../server/rig/types';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const FIXTURE = fileURLToPath(new URL('./fixtures/rigMcpServer.mjs', import.meta.url));
const markers: string[] = [];

function stdioRecord(connectionId: string, marker: string): McpConnection {
  markers.push(marker);
  return {
    connectionId,
    displayName: connectionId,
    sourceClass: 'local-user-installed',
    transport: { kind: 'stdio', executablePath: process.execPath, argv: [FIXTURE, `--marker=${marker}`], cwd: REPO_ROOT, environment: [], isolationMode: 'none' },
    endpointRef: process.execPath,
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

function pidsFor(marker: string): number[] {
  return execFileSync('ps', ['-A', '-o', 'pid=,args='], { encoding: 'utf8' })
    .split('\n')
    .filter((line) => line.includes(`--marker=${marker}`))
    .map((line) => Number(line.trim().split(/\s+/)[0]));
}

async function waitFor(check: () => boolean, message: string, timeoutMs = 6000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting: ${message}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

after(() => {
  for (const marker of markers) {
    for (const pid of pidsFor(marker)) {
      try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
    }
  }
});

describe('RigRuntime child lifecycle', () => {
  it('refuses a concurrent connect instead of starting a second child', async () => {
    const runtime = new RigRuntime();
    const marker = randomUUID();
    const record = stdioRecord(`concurrent-${marker.slice(0, 8)}`, marker);

    const results = await Promise.allSettled([runtime.connect(record), runtime.connect(record)]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    assert.match(String((rejected.reason as Error).message), /already in progress/);
    assert.equal(pidsFor(marker).length, 1, 'exactly one child process');

    await runtime.disconnectAll();
    await waitFor(() => pidsFor(marker).length === 0, 'child terminated');
  });

  it('reports an unexpected child exit once and marks the connection inactive', async () => {
    const faults: string[] = [];
    const runtime = new RigRuntime((connectionId, error) => { faults.push(`${connectionId}: ${error.message}`); });
    const marker = randomUUID();
    const record = stdioRecord(`exit-${marker.slice(0, 8)}`, marker);
    await runtime.connect(record);
    const [pid] = pidsFor(marker);
    assert.ok(pid, 'child is running');

    process.kill(pid, 'SIGKILL');
    await waitFor(() => faults.length > 0, 'fault reported');
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.deepEqual(faults, [`${record.connectionId}: MCP transport closed unexpectedly.`]);
    assert.equal(runtime.isConnected(record.connectionId), false);
  });

  it('ignores a close from a transport that is no longer the active one', async () => {
    const faults: string[] = [];
    const runtime = new RigRuntime((connectionId) => { faults.push(connectionId); });
    const marker = randomUUID();
    const record = stdioRecord(`stale-${marker.slice(0, 8)}`, marker);
    await runtime.connect(record);

    const active = (runtime as unknown as { active: Map<string, { client: unknown; transport: { close(): Promise<void> } }> }).active;
    const original = active.get(record.connectionId)!;
    active.set(record.connectionId, { ...original });

    await original.transport.close();
    await waitFor(() => pidsFor(marker).length === 0, 'replaced child terminated');
    assert.deepEqual(faults, [], 'a replaced transport does not fault its successor');
    assert.equal(runtime.isConnected(record.connectionId), true, 'the successor is not evicted');
    active.delete(record.connectionId);
  });

  it('disconnectAll terminates every child and refuses new connections', async () => {
    const faults: string[] = [];
    const runtime = new RigRuntime((connectionId) => { faults.push(connectionId); });
    const first = randomUUID();
    const second = randomUUID();
    await runtime.connect(stdioRecord(`all-a-${first.slice(0, 8)}`, first));
    await runtime.connect(stdioRecord(`all-b-${second.slice(0, 8)}`, second));
    assert.equal(pidsFor(first).length + pidsFor(second).length, 2);

    await runtime.disconnectAll();
    await waitFor(() => pidsFor(first).length === 0 && pidsFor(second).length === 0, 'all children terminated');
    assert.equal(runtime.isConnected(`all-a-${first.slice(0, 8)}`), false);
    assert.deepEqual(faults, [], 'an owned shutdown is not a fault');

    const late = randomUUID();
    await assert.rejects(runtime.connect(stdioRecord(`late-${late.slice(0, 8)}`, late)), /shutting down/);
    assert.equal(pidsFor(late).length, 0);
  });
});
