// test/testIsolation.test.ts
//
// Test processes must never touch the operator's real PaneTera state. Every
// case runs against a disposable HOME, so a leak into the "real" location
// would land in the sandbox, and each case asserts that it never does.

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTesseraAppDataDir, isTestProcess, productionAppDataDir } from '../server/appData';
import { DEFAULT_AUDIT_LOG_PATH, resolveAuditLogPath } from '../server/audit';
import { defaultRunHistoryDir, resolveRunHistoryDir } from '../server/agent/runHistory';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TSX_LOADER = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'loader.mjs');
const TSX_CLI = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const PRELOAD = path.join(ROOT, 'test', 'support', 'isolatedAppData.mjs');
const PROBE = path.join(ROOT, 'test', 'fixtures', 'serverImportProbe.ts');
const SERVER_ENTRY = path.join(ROOT, 'server', 'index.ts');

interface Sandbox { root: string; home: string; appData: string; cwd: string; auditLog: string }
const sandboxes: Sandbox[] = [];

function sandbox(): Sandbox {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-isolation-'));
  const box = { root, home: path.join(root, 'home'), appData: path.join(root, 'app-data'), cwd: path.join(root, 'cwd'), auditLog: path.join(root, 'audit.log') };
  for (const dir of [box.home, box.appData, box.cwd]) fs.mkdirSync(dir);
  sandboxes.push(box);
  return box;
}

/** Nothing was created where the production app data would resolve for this HOME. */
function homeUntouched(box: Sandbox): boolean {
  return fs.readdirSync(box.home).length === 0;
}

function withEnv<T>(changes: Record<string, string | undefined>, fn: () => T): T {
  const saved = Object.fromEntries(Object.keys(changes).map((key) => [key, process.env[key]]));
  const apply = (values: Record<string, string | undefined>) => {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  apply(changes);
  try { return fn(); } finally { apply(saved); }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

function childEnv(box: Sandbox, port: number, extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: box.home,
    TESSERA_APP_DATA: box.appData,
    PANETERA_AUDIT_LOG: box.auditLog,
    PANETERA_RUN_HISTORY_DIR: path.join(box.root, 'agent-history'),
    PORTAL_TOKEN: 'isolation-probe-token',
    PORT: String(port),
    PROBE_PORT: String(port),
    NODE_ENV: 'test',
    ...extra,
  };
  delete env.ROOK_BINARY_PATH;
  delete env.FLOWRIGHT_REPO_PATH;
  for (const [key, value] of Object.entries(extra)) if (value === undefined) delete env[key];
  return env;
}

function probeReport(stdout: string): Record<string, unknown> {
  const line = stdout.split('\n').find((candidate) => candidate.startsWith('PROBE'));
  assert.ok(line, `probe produced no report:\n${stdout}`);
  assert.ok(line.startsWith('PROBE '), line);
  return JSON.parse(line.slice('PROBE '.length));
}

describe('test processes cannot reach real PaneTera state', () => {
  it('recognises a test process', () => {
    assert.equal(isTestProcess({ NODE_TEST_CONTEXT: 'child-v8' }, ['node']), true);
    assert.equal(isTestProcess({ NODE_ENV: 'test' }, ['node']), true);
    assert.equal(isTestProcess({}, ['node', '/repo/test/rigFoundation.test.ts']), true);
    assert.equal(isTestProcess({}, ['node', '/repo/server/index.ts']), false);
  });

  it('refuses the production app-data directory, directly or through an override, and creates nothing', () => {
    const box = sandbox();
    withEnv({ HOME: box.home, TESSERA_APP_DATA: undefined }, () => {
      assert.throws(() => getTesseraAppDataDir(), /Refusing to use the real PaneTera app-data directory/);
      assert.equal(productionAppDataDir().startsWith(box.home), true, 'the production path resolves inside the sandbox HOME');
      withEnv({ TESSERA_APP_DATA: productionAppDataDir() }, () => {
        assert.throws(() => getTesseraAppDataDir(), /Refusing to use the real PaneTera app-data directory/);
      });
    });
    assert.equal(homeUntouched(box), true);
  });

  it('uses an explicitly isolated app-data directory', () => {
    const box = sandbox();
    const isolated = path.join(box.appData, 'nested');
    withEnv({ HOME: box.home, TESSERA_APP_DATA: isolated }, () => {
      assert.equal(getTesseraAppDataDir(), isolated);
    });
    assert.equal(fs.existsSync(isolated), true);
    assert.equal(homeUntouched(box), true);
  });

  it('refuses the server audit log from a test process', () => {
    withEnv({ PANETERA_AUDIT_LOG: undefined }, () => {
      assert.throws(() => resolveAuditLogPath(), /Refusing to use the PaneTera server audit log/);
    });
    withEnv({ PANETERA_AUDIT_LOG: DEFAULT_AUDIT_LOG_PATH }, () => {
      assert.throws(() => resolveAuditLogPath(), /Refusing to use the PaneTera server audit log/);
    });
    const box = sandbox();
    withEnv({ PANETERA_AUDIT_LOG: box.auditLog }, () => {
      assert.equal(resolveAuditLogPath(), box.auditLog);
    });
  });

  it('refuses the server run history from a test process', () => {
    withEnv({ PANETERA_RUN_HISTORY_DIR: undefined }, () => {
      assert.throws(() => resolveRunHistoryDir(), /Refusing to use the PaneTera server run history/);
    });
    withEnv({ PANETERA_RUN_HISTORY_DIR: defaultRunHistoryDir() }, () => {
      assert.throws(() => resolveRunHistoryDir(), /Refusing to use the PaneTera server run history/);
    });
    const box = sandbox();
    const isolated = path.join(box.root, 'agent-history');
    withEnv({ PANETERA_RUN_HISTORY_DIR: isolated }, () => {
      assert.equal(resolveRunHistoryDir(), isolated);
    });
  });

  it('the npm test preload isolates each process and removes its state on exit', () => {
    const box = sandbox();
    const result = spawnSync(process.execPath, ['--import', PRELOAD, '-e', [
      'const fs = require("fs");',
      'const s = { root: process.env.PANETERA_TEST_STATE_ROOT, appData: process.env.TESSERA_APP_DATA, audit: process.env.PANETERA_AUDIT_LOG, history: process.env.PANETERA_RUN_HISTORY_DIR };',
      's.appDataExists = fs.existsSync(s.appData);',
      'console.log(JSON.stringify(s));',
    ].join(' ')], { encoding: 'utf8', env: { ...process.env, HOME: box.home } });
    assert.equal(result.status, 0, result.stderr);
    const state = JSON.parse(result.stdout.trim()) as Record<string, string | boolean>;
    const root = state.root as string;
    assert.match(path.basename(root), /^panetera-test-state-/);
    assert.equal(state.appDataExists, true);
    for (const key of ['appData', 'audit', 'history']) {
      assert.equal((state[key] as string).startsWith(root + path.sep), true, `${key} lives under the isolated root`);
    }
    assert.equal(fs.existsSync(root), false, 'the isolated state is removed when the process exits');
    assert.equal(homeUntouched(box), true);
  });

  it('importing the server module neither listens nor declares application connections', { timeout: 90_000 }, async () => {
    const box = sandbox();
    const port = await freePort();
    const result = spawnSync(process.execPath, ['--import', TSX_LOADER, PROBE, 'import'], {
      cwd: box.cwd, encoding: 'utf8', env: childEnv(box, port), timeout: 80_000,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const report = probeReport(result.stdout);
    assert.equal(report.listening, false);
    assert.deepEqual(report.records, [], 'no connection was reconciled or registered by importing');
    assert.equal(homeUntouched(box), true);
  });

  it('starting the server declares connections only inside the supplied app-data directory', { timeout: 90_000 }, async () => {
    const box = sandbox();
    const port = await freePort();
    const result = spawnSync(process.execPath, ['--import', TSX_LOADER, PROBE, 'start'], {
      cwd: box.cwd, encoding: 'utf8', env: childEnv(box, port), timeout: 80_000,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const report = probeReport(result.stdout) as { listening: boolean; registration: string[]; records: Array<{ connectionId: string; state: string }> };
    assert.equal(report.listening, true);
    assert.deepEqual(report.registration, ['registered', 'registered']);
    assert.deepEqual(report.records.map((r) => [r.connectionId, r.state]), [['blender', 'approval-required'], ['reaper', 'approval-required']]);
    assert.ok(fs.readFileSync(box.auditLog, 'utf8').includes('"event":"rig.connection.registered"'), 'audit went to the isolated log');
    assert.equal(homeUntouched(box), true);
  });

  it('the entrypoint starts the server itself, as `tsx watch server/index.ts` does', { timeout: 120_000 }, async () => {
    const box = sandbox();
    const port = await freePort();
    const child = spawn(process.execPath, [TSX_CLI, SERVER_ENTRY], {
      cwd: box.cwd, env: childEnv(box, port, { NODE_ENV: undefined }), detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
    try {
      const registry = path.join(box.appData, 'rig', 'connections.json');
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline) {
        if (output.includes(`listening on http://127.0.0.1:${port}`) && fs.existsSync(registry)
          && ['"blender"', '"reaper"'].every((id) => fs.readFileSync(registry, 'utf8').includes(id))) break;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      assert.ok(output.includes(`listening on http://127.0.0.1:${port}`), `server did not start:\n${output}`);
      const saved = JSON.parse(fs.readFileSync(registry, 'utf8')) as { connections: Array<{ connectionId: string; state: string }> };
      assert.deepEqual(saved.connections.map((c) => [c.connectionId, c.state]), [['blender', 'approval-required'], ['reaper', 'approval-required']]);
      assert.equal(homeUntouched(box), true);
    } finally {
      try { process.kill(-(child.pid as number), 'SIGTERM'); } catch { /* already exited */ }
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
      try { process.kill(-(child.pid as number), 'SIGKILL'); } catch { /* already exited */ }
    }
  });

  it('removes every sandbox it created', () => {
    for (const box of sandboxes.splice(0)) {
      fs.rmSync(box.root, { recursive: true, force: true });
      assert.equal(fs.existsSync(box.root), false);
    }
  });
});

after(() => {
  for (const box of sandboxes) fs.rmSync(box.root, { recursive: true, force: true });
});
