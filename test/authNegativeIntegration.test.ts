// test/authNegativeIntegration.test.ts
//
// Boots the REAL composed app (server/index.ts) and proves every protected
// route refuses unauthenticated callers. Composition is the thing under test:
// the router mounting order, the global master-token gate, and the
// router-level auth on /api/browser and /mcp/browser. See docs/THREAT_MODEL.md
// for the classification this suite pins down.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.PORTAL_TOKEN = 'auth-negative-integration-test-token';
process.env.TESSERA_APP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-auth-appdata-'));
process.env.TESSERA_LEGACY_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-auth-legacy-'));
delete process.env.ROOK_BINARY_PATH;
delete process.env.FLOWRIGHT_REPO_PATH;

interface RouteProbe {
  method: string;
  path: string;
}

// Layer B — app-level routes behind the global master-token gate.
const APP_LEVEL_ROUTES: RouteProbe[] = [
  { method: 'GET', path: '/api/events' },
  { method: 'GET', path: '/api/health' },
  { method: 'POST', path: '/api/memory/remember' },
  { method: 'GET', path: '/api/memory/recall' },
  { method: 'GET', path: '/api/workspaces' },
  { method: 'POST', path: '/api/local-selection' },
  { method: 'GET', path: '/api/local-selection/scopes?sessionId=unauthed-session' },
  { method: 'POST', path: '/api/local-selection/scopes/not-a-grant/revoke' },
  { method: 'POST', path: '/api/workspaces/browse' },
  { method: 'POST', path: '/api/workspaces/add' },
  { method: 'GET', path: '/api/files?workspace=example' },
  { method: 'GET', path: '/api/read?workspace=example&path=README.md' },
  { method: 'GET', path: '/api/search?workspace=example&keyword=test' },
  { method: 'GET', path: '/api/git/history?workspace=example' },
  { method: 'POST', path: '/api/execute' },
  { method: 'POST', path: '/api/execute/kill' },
  { method: 'POST', path: '/api/flowright/runs' },
  { method: 'POST', path: '/api/flowright/runs/not-a-run/drive' },
  { method: 'GET', path: '/api/flowright/runs/not-a-run' },
  { method: 'POST', path: '/api/flowright/runs/not-a-run/review' },
  { method: 'GET', path: '/api/flowright/runs/not-a-run/evidence' },
  { method: 'GET', path: '/api/desktop/apps' },
  { method: 'POST', path: '/api/web-preview/probe' },
  { method: 'POST', path: '/api/browser-observation' },
  { method: 'GET', path: '/api/myai-workspaces' },
  { method: 'POST', path: '/api/myai-workspaces/register' },
  { method: 'POST', path: '/api/myai-workspaces/toggle' },
  { method: 'GET', path: '/api/myai-workspaces/scan' },
  { method: 'POST', path: '/api/myai-workspaces/query' },
  { method: 'GET', path: '/api/myai-workspaces/audit' },
  { method: 'POST', path: '/api/orchestrator/chat' },
  { method: 'POST', path: '/api/chat' },
  { method: 'POST', path: '/api/classify-intent' },
  { method: 'GET', path: '/api/workflow-suggestions' },
  { method: 'GET', path: '/api/evidence' },
];

// Layer C — routers mounted behind the global master-token gate.
const RIG_ROUTES: RouteProbe[] = [
  { method: 'GET', path: '/api/rig/portal-manifest' },
  { method: 'GET', path: '/api/rig/connections' },
  { method: 'POST', path: '/api/rig/connections' },
  { method: 'GET', path: '/api/rig/connections/conn-1/review' },
  { method: 'POST', path: '/api/rig/connections/conn-1/approve' },
  { method: 'POST', path: '/api/rig/connections/conn-1/stop' },
  { method: 'DELETE', path: '/api/rig/connections/conn-1' },
  { method: 'POST', path: '/api/rig/connections/conn-1/refresh' },
  { method: 'PUT', path: '/api/rig/connections/conn-1/capabilities/tool-x' },
  { method: 'POST', path: '/api/rig/proposals' },
  { method: 'POST', path: '/api/rig/proposals/prop-1/approve' },
  { method: 'POST', path: '/api/rig/invocations' },
  { method: 'GET', path: '/api/rig/resources' },
  { method: 'POST', path: '/api/rig/resources/read' },
  { method: 'POST', path: '/api/rig/prompts/get' },
  { method: 'GET', path: '/api/rig/provenance' },
];

const HEADROOM_ROUTES: RouteProbe[] = [
  { method: 'POST', path: '/api/headroom/envelopes' },
  { method: 'GET', path: '/api/headroom/envelopes' },
  { method: 'GET', path: '/api/headroom/envelopes/env-1' },
  { method: 'POST', path: '/api/headroom/envelopes/env-1/pin' },
  { method: 'GET', path: '/api/headroom/capsules' },
  { method: 'PUT', path: '/api/headroom/capsules/cap-1' },
  { method: 'POST', path: '/api/headroom/capsules' },
  { method: 'DELETE', path: '/api/headroom/capsules/cap-1' },
  { method: 'POST', path: '/api/headroom/capsules/cap-1/annotations' },
];

const NATIVE_GRANTS_ROUTES: RouteProbe[] = [
  { method: 'POST', path: '/api/native-grants/file' },
  { method: 'POST', path: '/api/native-grants/folder' },
  { method: 'GET', path: '/api/native-grants/some-token' },
  { method: 'DELETE', path: '/api/native-grants/some-token' },
];

const TESSERA_ROUTES: RouteProbe[] = [
  { method: 'POST', path: '/api/tessera/sessions' },
  { method: 'GET', path: '/api/tessera/sessions/sess-1' },
  { method: 'POST', path: '/api/tessera/sessions/sess-1/evidence' },
  { method: 'POST', path: '/api/tessera/analysis/synthesize' },
];

const AGENT_ROUTES: RouteProbe[] = [
  { method: 'POST', path: '/api/agent/run' },
  { method: 'GET', path: '/api/agent/runs' },
  { method: 'GET', path: '/api/agent/run/run-1' },
  { method: 'GET', path: '/api/agent/run/run-1/events' },
  { method: 'POST', path: '/api/agent/run/run-1/cancel' },
  { method: 'POST', path: '/api/agent/run/run-1/approve-browser' },
  { method: 'POST', path: '/api/agent/run/run-1/reject-browser' },
  { method: 'GET', path: '/api/agent/queue/status' },
  { method: 'POST', path: '/api/agent/queue/config' },
  { method: 'GET', path: '/api/agent/history' },
  { method: 'GET', path: '/api/agent/history/run-1' },
  { method: 'GET', path: '/api/agent/history/run-1/replay' },
  { method: 'GET', path: '/api/agent/history/stats' },
  { method: 'GET', path: '/api/agent/capabilities' },
  { method: 'GET', path: '/api/agent/capabilities/stats' },
  { method: 'POST', path: '/api/agent/capabilities/cap-1/health' },
  { method: 'GET', path: '/api/agent/models/stats' },
];

const MODEL_ROUTES: RouteProbe[] = [
  { method: 'GET', path: '/api/models' },
  { method: 'GET', path: '/api/models/active' },
  { method: 'POST', path: '/api/models/active' },
];

const SCHEMA_ROUTES: RouteProbe[] = [
  { method: 'GET', path: '/api/schemas' },
  { method: 'POST', path: '/api/schemas' },
  { method: 'GET', path: '/api/schemas/schema-1' },
  { method: 'PUT', path: '/api/schemas/schema-1' },
  { method: 'DELETE', path: '/api/schemas/schema-1' },
  { method: 'POST', path: '/api/schemas/schema-1/validate' },
];

// Layer A — mounted before the global token gate; each route has its own auth.
const BROWSER_ROUTES: RouteProbe[] = [
  { method: 'POST', path: '/api/browser/pairing/start' },
  { method: 'GET', path: '/api/browser/pairing/status' },
  { method: 'DELETE', path: '/api/browser/pairing/pending' },
  { method: 'DELETE', path: '/api/browser/pairing/sessions/sess-x' },
  { method: 'GET', path: '/api/browser/session' },
  { method: 'DELETE', path: '/api/browser/session' },
  { method: 'POST', path: '/api/browser/observations' },
  { method: 'GET', path: '/api/browser/actions/pending' },
  { method: 'POST', path: '/api/browser/actions/preview-result' },
  { method: 'GET', path: '/api/browser/actions/claim' },
  { method: 'POST', path: '/api/browser/actions/complete' },
  { method: 'GET', path: '/api/browser/inspections/pending' },
  { method: 'POST', path: '/api/browser/inspections/complete' },
  { method: 'GET', path: '/api/browser/observations/pending' },
  { method: 'POST', path: '/api/browser/observations/complete' },
];

const MCP_FACADE_ROUTES: RouteProbe[] = [{ method: 'POST', path: '/mcp/browser' }];

const PROTECTED_ROUTES: RouteProbe[] = [
  ...APP_LEVEL_ROUTES,
  ...RIG_ROUTES,
  ...HEADROOM_ROUTES,
  ...NATIVE_GRANTS_ROUTES,
  ...TESSERA_ROUTES,
  ...AGENT_ROUTES,
  ...MODEL_ROUTES,
  ...SCHEMA_ROUTES,
  ...BROWSER_ROUTES,
  ...MCP_FACADE_ROUTES,
];

const TOKEN = process.env.PORTAL_TOKEN as string;

let server: http.Server;
let baseUrl: string;

async function probe(method: string, requestPath: string): Promise<Response> {
  return fetch(`${baseUrl}${requestPath}`, { method });
}

describe('Negative auth integration against the real composed app', () => {
  before(async () => {
    const { app } = await import('../server/index');
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(() => {
    server.closeAllConnections();
    return new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('refuses a missing credential on every protected route', async () => {
    const refused: Array<{ method: string; path: string; status: number }> = [];
    for (const route of PROTECTED_ROUTES) {
      const resp = await probe(route.method, route.path);
      if (resp.status !== 401) {
        refused.push({ method: route.method, path: route.path, status: resp.status });
      }
    }
    assert.deepStrictEqual(refused, [], 'routes above did not return 401 without a credential');
  });

  it('refuses a wrong credential on a representative route per layer', async () => {
    const wrongTokenRoutes: RouteProbe[] = [
      { method: 'GET', path: '/api/workspaces' },
      { method: 'GET', path: '/api/rig/connections' },
      { method: 'POST', path: '/api/headroom/envelopes' },
      { method: 'GET', path: '/api/native-grants/some-token' },
      { method: 'GET', path: '/api/tessera/sessions/sess-1' },
      { method: 'GET', path: '/api/agent/runs' },
      { method: 'GET', path: '/api/models' },
      { method: 'GET', path: '/api/schemas' },
      { method: 'POST', path: '/api/browser/pairing/start' },
      { method: 'GET', path: '/api/browser/session' },
      { method: 'POST', path: '/mcp/browser' },
    ];
    const accepted: Array<{ method: string; path: string; status: number }> = [];
    for (const route of wrongTokenRoutes) {
      const resp = await fetch(`${baseUrl}${route.path}`, {
        method: route.method,
        headers: { Authorization: 'Bearer definitely-not-the-portal-token' },
      });
      if (resp.status !== 401) {
        accepted.push({ method: route.method, path: route.path, status: resp.status });
      }
    }
    assert.deepStrictEqual(accepted, [], 'routes above accepted a wrong credential');
  });

  it('honors the master token in the Authorization header', async () => {
    const resp = await fetch(`${baseUrl}/api/workspaces`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    assert.strictEqual(resp.status, 200, 'authenticated request must reach the handler');
  });

  it('allows the query token only on /api/events', async () => {
    const eventsCtrl = new AbortController();
    try {
      const events = await fetch(`${baseUrl}/api/events?token=${encodeURIComponent(TOKEN)}`, {
        signal: eventsCtrl.signal,
      });
      assert.strictEqual(events.status, 200, '/api/events must accept the query token');
    } finally {
      eventsCtrl.abort();
    }
    const elsewhere = await fetch(`${baseUrl}/api/workspaces?token=${encodeURIComponent(TOKEN)}`);
    assert.strictEqual(elsewhere.status, 401, 'query token must not be honored outside /api/events');
  });

  it('keeps documented-open surfaces at their classified behavior', async () => {
    const health = await probe('GET', '/api/browser/health');
    assert.strictEqual(health.status, 200, 'browser health is loopback-public by design');

    const apps = await probe('GET', '/api/workbench/apps');
    assert.strictEqual(apps.status, 200, 'workbench app metadata is public by design');

    const status = await probe('GET', '/api/workbench/apps/not-an-app/status');
    assert.strictEqual(status.status, 200, 'workbench probe is public by design (loopback-bound)');

    // FINDING-001: workbench audit ingestion is open today. Pinned so a fix
    // that moves it into the 401 sweep is visible when it lands.
    const audit = await fetch(`${baseUrl}/api/workbench/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'workbench.layout.change' }),
    });
    assert.strictEqual(audit.status, 200, 'FINDING-001: unauthenticated workbench audit write succeeds');

    const exchange = await fetch(`${baseUrl}/api/browser/pairing/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'AAAA-AAAA', runtimeId: 'runtime-x', installationId: 'inst-y' }),
    });
    assert.strictEqual(exchange.status, 400, 'pairing exchange is code-gated, not token-gated');

    const refresh = await fetch(`${baseUrl}/api/browser/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'nope', installationId: 'inst-y' }),
    });
    assert.strictEqual(refresh.status, 401, 'bad refresh token must be refused');
  });

  it('rejects unsupported methods on the MCP facade', async () => {
    const getResp = await probe('GET', '/mcp/browser');
    assert.strictEqual(getResp.status, 405);
    const deleteResp = await probe('DELETE', '/mcp/browser');
    assert.strictEqual(deleteResp.status, 405);
  });
});
