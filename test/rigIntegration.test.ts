process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import http from 'http';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { GovernedStdioTransport } from '../server/rig/governedStdio';
import { isPrivateAddress, verifyStdioSpec } from '../server/rig/transportSecurity';
import { inspectStructuredResult } from '../src/rig/inspect';
import { attachContextItem, resetContextIds } from '../src/composer/contextTray';
import { attachmentOptions } from '../src/composer/contextTypes';
import { RigRuntime } from '../server/rig/runtime';
import { createDestinationBoundFetch } from '../server/rig/boundFetch';
import { EMPTY_CAPABILITY_SNAPSHOT, type McpConnection } from '../server/rig/types';

describe('Rig routes are protected by the master token boundary', () => {
  it('mounts Rig and Headroom only after authentication middleware', () => {
    const source = fs.readFileSync(path.resolve('server/index.ts'), 'utf8');
    const auth = source.indexOf("app.use((req: Request, res: Response, next: NextFunction)");
    const rig = source.indexOf("app.use('/api/rig', rigRouter)");
    const headroom = source.indexOf("app.use('/api/headroom', headroomRouter)");
    assert.ok(auth >= 0 && rig > auth, 'Rig must mount after authentication');
    assert.ok(auth >= 0 && headroom > auth, 'Headroom must mount after authentication');
  });
});

describe('governed stdio transport', () => {
  it('requires stable absolute interpreter entry points', async () => {
    const executable = process.execPath;
    await assert.rejects(() => verifyStdioSpec({
      kind: 'stdio', executablePath: executable, argv: ['relative.js'], cwd: '/tmp', environment: [], isolationMode: 'none',
    }), /absolute entry point/);
  });

  it('rejects secret-like environment names', async () => {
    await assert.rejects(() => verifyStdioSpec({
      kind: 'stdio', executablePath: '/bin/cat', argv: [], cwd: '/tmp',
      environment: [{ name: 'API_TOKEN', source: 'literal', value: 'secret' }], isolationMode: 'none',
    }), /not permitted/);
  });

  it('exchanges bounded JSON-RPC without a shell', async () => {
    const transport = new GovernedStdioTransport({
      executablePath: '/bin/cat', argv: [], cwd: '/tmp', env: { PATH: '/usr/bin:/bin' }, idleTimeoutMs: 2_000,
    });
    const received = new Promise<unknown>((resolve, reject) => {
      transport.onmessage = resolve;
      transport.onerror = reject;
    });
    await transport.start();
    await transport.send({ jsonrpc: '2.0', id: 1, method: 'ping' });
    assert.deepStrictEqual(await received, { jsonrpc: '2.0', id: 1, method: 'ping' });
    await transport.close();
  });
});

describe('Rig runtime speaks MCP end to end', () => {
  it('connects, discovers and uses tools, resources, and prompts', async () => {
    const runtime = new RigRuntime();
    const entry = path.resolve('test/fixtures/rigMcpServer.mjs');
    const now = new Date().toISOString();
    const connection: McpConnection = {
      connectionId: 'fixture', displayName: 'Fixture', sourceClass: 'local-user-installed',
      transport: {
        kind: 'stdio', executablePath: process.execPath, argv: [entry], cwd: path.resolve('.'),
        environment: [], isolationMode: 'none',
      },
      endpointRef: process.execPath,
      executableDigest: null, entryPointDigest: null, launchSpecDigest: null,
      state: 'starting', health: { state: 'not-measured', lastSuccessfulContact: null },
      capabilities: EMPTY_CAPABILITY_SNAPSHOT,
      createdAt: now, updatedAt: now, connectionApprovalId: 'approval-fixture',
    };
    try {
      const connected = await runtime.connect(connection);
      assert.deepStrictEqual(connected.snapshot.tools.map((item) => item.name), ['echo']);
      assert.deepStrictEqual(connected.snapshot.resources.map((item) => item.name), ['fixture-note']);
      assert.deepStrictEqual(connected.snapshot.prompts.map((item) => item.name), ['greet']);
      const tool = await runtime.callTool('fixture', 'echo', { text: 'hello' }) as any;
      assert.strictEqual(tool.content[0].text, 'hello');
      const resource = await runtime.readResource('fixture', 'fixture://note') as any;
      assert.strictEqual(resource.contents[0].text, 'fixture resource');
      const prompt = await runtime.getPrompt('fixture', 'greet', { name: 'PaneTera' }) as any;
      assert.strictEqual(prompt.messages[0].content.text, 'Hello PaneTera');
    } finally {
      await runtime.disconnect('fixture');
    }
  });

  it('connects to an explicitly approved local Streamable HTTP server', async () => {
    const app = express();
    app.use(express.json());
    app.post('/mcp', async (req, res) => {
      const server = new McpServer({ name: 'HTTP fixture', version: '1.0.0' });
      server.tool('sum', { a: z.number(), b: z.number() }, async ({ a, b }) => ({
        content: [{ type: 'text', text: String(a + b) }],
      }));
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } finally {
        await server.close().catch(() => undefined);
        await transport.close().catch(() => undefined);
      }
    });
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const runtime = new RigRuntime();
    const now = new Date().toISOString();
    const connection: McpConnection = {
      connectionId: 'http-fixture', displayName: 'HTTP Fixture', sourceClass: 'remote-external',
      transport: { kind: 'http', url: `http://127.0.0.1:${address.port}/mcp`, localDevelopment: true, authRef: null },
      endpointRef: `http://127.0.0.1:${address.port}/mcp`, executableDigest: null, entryPointDigest: null, launchSpecDigest: null,
      state: 'starting', health: { state: 'not-measured', lastSuccessfulContact: null }, capabilities: EMPTY_CAPABILITY_SNAPSHOT,
      createdAt: now, updatedAt: now, connectionApprovalId: 'approval-http',
    };
    try {
      const connected = await runtime.connect(connection);
      assert.deepStrictEqual(connected.snapshot.tools.map((item) => item.name), ['sum']);
      const result = await runtime.callTool('http-fixture', 'sum', { a: 2, b: 3 }) as any;
      assert.strictEqual(result.content[0].text, '5');
    } finally {
      await runtime.disconnect('http-fixture');
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe('remote address policy', () => {
  it('classifies loopback and private addresses', () => {
    for (const address of ['127.0.0.1', '10.0.0.2', '192.168.1.4', '172.16.0.1', '::1', 'fd00::1']) {
      assert.strictEqual(isPrivateAddress(address), true, address);
    }
    assert.strictEqual(isPrivateAddress('8.8.8.8'), false);
  });
});

describe('HTTP MCP credentials stay bound to their approved origin', () => {
  it('uses a keychain-backed bearer token directly and strips it after a cross-origin redirect', async () => {
    let directAuthorization: string | undefined;
    let redirectedAuthorization: string | undefined;
    const destination = http.createServer((req, res) => {
      redirectedAuthorization = req.headers.authorization;
      res.end('redirected');
    });
    await new Promise<void>((resolve) => destination.listen(0, '127.0.0.1', resolve));
    const destinationAddress = destination.address();
    assert.ok(destinationAddress && typeof destinationAddress === 'object');
    const origin = http.createServer((req, res) => {
      directAuthorization = req.headers.authorization;
      if (req.url === '/redirect') {
        res.statusCode = 302;
        res.setHeader('location', `http://127.0.0.1:${destinationAddress.port}/target`);
        res.end();
        return;
      }
      res.end('direct');
    });
    await new Promise<void>((resolve) => origin.listen(0, '127.0.0.1', resolve));
    const originAddress = origin.address();
    assert.ok(originAddress && typeof originAddress === 'object');
    const base = `http://127.0.0.1:${originAddress.port}`;
    const governedFetch = createDestinationBoundFetch(
      { kind: 'http', url: `${base}/mcp`, localDevelopment: true, authRef: 'keychain:panetera-rig:fixture' },
      async () => 'fixture-secret',
    );
    try {
      assert.strictEqual(await (await governedFetch(`${base}/direct`)).text(), 'direct');
      assert.strictEqual(directAuthorization, 'Bearer fixture-secret');
      assert.strictEqual(await (await governedFetch(`${base}/redirect`)).text(), 'redirected');
      assert.strictEqual(redirectedAuthorization, undefined);
    } finally {
      await Promise.all([
        new Promise<void>((resolve) => origin.close(() => resolve())),
        new Promise<void>((resolve) => destination.close(() => resolve())),
      ]);
    }
  });
});

describe('MCP resources enter context only through explicit retrieval', () => {
  it('appears in the menu only when Rig has enabled resources', () => {
    const base = {
      hasProjectPicker: false, hasLocalFilePicker: false, hasLocalFolderPicker: false,
      hasProjects: false, hasWebLinks: false, hasMcpResources: false,
    };
    assert.ok(!attachmentOptions(base).some((option) => option.kind === 'mcp-resource'));
    assert.ok(attachmentOptions({ ...base, hasMcpResources: true }).some((option) => option.kind === 'mcp-resource'));
  });

  it('records external provenance and exact material bytes', () => {
    resetContextIds();
    const result = attachContextItem([], {
      kind: 'mcp-resource', label: 'Research note', locator: 'docs://note/1',
      connectionId: 'docs', provenanceRecordId: 'prov-1', capturedAt: '2026-07-21T00:00:00.000Z',
      retrievedMaterial: '{"text":"hello"}',
    });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    assert.strictEqual(result.item.source.origin, 'external-mcp');
    assert.strictEqual(result.item.source.connectionId, 'docs');
    assert.strictEqual(result.item.source.provenanceRecordId, 'prov-1');
    assert.strictEqual(result.item.materialization.mode, 'retrieved');
    assert.strictEqual(result.material, '{"text":"hello"}');
  });

  it('rejects a fabricated resource without retrieved material and provenance', () => {
    assert.deepStrictEqual(attachContextItem([], {
      kind: 'mcp-resource', label: 'Fake', locator: 'docs://fake',
    }), { ok: false, reason: 'missing-material' });
  });
});

describe('unknown MCP output is bounded and inert', () => {
  it('redacts credentials, removes prototype keys, bounds depth and handles cycles', () => {
    const cyclic: Record<string, unknown> = { token: 'secret', html: '<img src=x onerror=alert(1)>' };
    cyclic.self = cyclic;
    Object.defineProperty(cyclic, '__proto__', { value: { polluted: true }, enumerable: true });
    const inspected = inspectStructuredResult(cyclic, { maxDepth: 2, maxNodes: 20, maxStringLength: 100 }) as Record<string, unknown>;
    assert.strictEqual(inspected.token, '[redacted]');
    assert.strictEqual(inspected.self, '[circular]');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(inspected, '__proto__'), false);
    assert.strictEqual(inspected.html, '<img src=x onerror=alert(1)>');
  });
});
