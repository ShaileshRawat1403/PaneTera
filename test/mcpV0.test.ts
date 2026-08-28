// Boots the real composed app in-process. NODE_ENV must be set to 'test'
// *before* server/index.ts is evaluated, or the module opens its own listener
// on PORT and starts the file watcher as an import side effect -- handles that
// nothing here owns and nothing closes, so the runner hung until it timed out.
// ES imports are hoisted above statements, so the app is pulled in dynamically
// below rather than with a static import. Type-only imports stay static: they
// are erased and carry no side effect.
process.env.NODE_ENV = 'test';

// Boots the real composed app in-process. NODE_ENV must be 'test' before
// server/index.ts is evaluated, or the module opens its own listener on PORT
// and starts the file watcher as an import side effect -- handles that nothing
// here owns and nothing closes, so the runner hung until it timed out.
//
// Static imports are hoisted above this assignment, so the app is pulled in
// dynamically inside runTests() instead. These files transpile to CJS, which
// has no top-level await, so the import cannot sit at module scope either.
process.env.NODE_ENV = 'test';

import assert from 'assert';
import http from 'http';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import type { McpClientPrincipal } from '../server/mcp/browserMcpAuth';

type ServerModule = typeof import('../server/index');
type EvidenceModule = typeof import('../server/browserEvidenceStore');
type AuthModule = typeof import('../server/mcp/browserMcpAuth');

let app: ServerModule['app'];
let browserEvidenceStore: EvidenceModule['browserEvidenceStore'];
let registerMcpCredential: AuthModule['registerMcpCredential'];

async function loadServer(): Promise<void> {
  ({ app } = await import('../server/index'));
  ({ browserEvidenceStore } = await import('../server/browserEvidenceStore'));
  ({ registerMcpCredential } = await import('../server/mcp/browserMcpAuth'));
}

console.log('Running Browser Operator MCP Façade V0 unit tests...');

const PORT = 4011;
const V0_CREDENTIAL = 'mcp-local-v0-credential';

let server: http.Server;

function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(PORT, '127.0.0.1', () => resolve());
  });
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

class FetchClientTransport implements Transport {
  private url: string;
  private token: string;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  async start(): Promise<void> {}

  async close(): Promise<void> {
    if (this.onclose) this.onclose();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.token}`,
          'Host': '127.0.0.1:4011' // Bypass host check
        },
        body: JSON.stringify(message)
      });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (this.onmessage) {
        if (Array.isArray(data)) {
          for (const msg of data) {
            this.onmessage(msg);
          }
        } else {
          this.onmessage(data);
        }
      }
    } catch (e: any) {
      if (this.onerror) this.onerror(e);
    }
  }
}

async function runTests() {
  await loadServer();
  await startServer();

  function httpRequest(options: http.RequestOptions, postData?: string): Promise<http.IncomingMessage> {
    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        resolve(res);
      });
      req.on('error', reject);
      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  }

  try {
    // 1. Clear store
    (browserEvidenceStore as any).observations = [];
    (browserEvidenceStore as any).extractions = [];

    // 1b. Register the credential these assertions authenticate with.
    //
    // Without this every request below carried an unregistered bearer and was
    // rejected at 401, so the Host and Origin assertions never reached the
    // guard they exist to test -- the suite reported a DNS-rebinding failure
    // that was really a missing fixture. Registering it means a 403 now proves
    // the rebinding guard fired on an *authenticated* request, which is the
    // only version of that assertion worth having.
    const principal: McpClientPrincipal = {
      clientId: 'mcp-v0-facade-test',
      subjectId: 'operator-under-test',
      scopes: ['read'],
    };
    registerMcpCredential(V0_CREDENTIAL, principal);

    // 2. GET returns 405
    let res = await httpRequest({ host: '127.0.0.1', port: PORT, path: '/mcp/browser', method: 'GET' });
    assert.strictEqual(res.statusCode, 405, 'GET should return 405');

    // 3. DELETE returns 405
    res = await httpRequest({ host: '127.0.0.1', port: PORT, path: '/mcp/browser', method: 'DELETE' });
    assert.strictEqual(res.statusCode, 405, 'DELETE should return 405');

    // 4. Missing auth returns 401
    res = await httpRequest({
      host: '127.0.0.1', port: PORT, path: '/mcp/browser', method: 'POST',
      headers: { 'Host': '127.0.0.1:4011', 'Content-Type': 'application/json' }
    }, '{}');
    assert.strictEqual(res.statusCode, 401, 'Missing auth should return 401');

    // 5. Invalid auth returns 401
    res = await httpRequest({
      host: '127.0.0.1', port: PORT, path: '/mcp/browser', method: 'POST',
      headers: { 'Host': '127.0.0.1:4011', 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': 'Bearer bad' }
    }, '{}');
    assert.strictEqual(res.statusCode, 401, 'Invalid auth should return 401');

    // 6. Bad Host returns 403
    res = await httpRequest({
      host: '127.0.0.1', port: PORT, path: '/mcp/browser', method: 'POST',
      headers: { 'Host': 'example.com', 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': `Bearer ${V0_CREDENTIAL}` }
    }, '{}');
    assert.strictEqual(res.statusCode, 403, 'Bad Host should return 403');

    // 7. Bad Origin returns 403
    res = await httpRequest({
      host: '127.0.0.1', port: PORT, path: '/mcp/browser', method: 'POST',
      headers: { 'Host': '127.0.0.1:4011', 'Accept': 'application/json', 'Origin': 'http://example.com', 'Content-Type': 'application/json', 'Authorization': `Bearer ${V0_CREDENTIAL}` }
    }, '{}');
    assert.strictEqual(res.statusCode, 403, 'Bad Origin should return 403');

    // 8. Bad Content-Type returns 415
    res = await httpRequest({
      host: '127.0.0.1', port: PORT, path: '/mcp/browser', method: 'POST',
      headers: { 'Host': '127.0.0.1:4011', 'Accept': 'application/json', 'Content-Type': 'text/plain', 'Authorization': `Bearer ${V0_CREDENTIAL}` }
    }, '{}');
    assert.strictEqual(res.statusCode, 415, 'Bad Content-Type should return 415');

    // 9. Stateless raw test
    console.log('Testing MCP initialized payload (Stateless)...');
    
    const initReq = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } }
    };

    let initRes = await httpRequest({
      host: '127.0.0.1', port: PORT, path: '/mcp/browser', method: 'POST',
      headers: { 'Host': '127.0.0.1:4011', 'Accept': 'application/json, text/event-stream', 'Content-Type': 'application/json', 'Authorization': `Bearer ${V0_CREDENTIAL}` }
    }, JSON.stringify(initReq));

    let initBody = '';
    for await (const chunk of initRes) {
      initBody += chunk;
    }
    
    console.log('Initialize response status:', initRes.statusCode);
    console.log('Initialize response body:', initBody);
    
    assert.strictEqual(initRes.statusCode, 200, 'Initialize should return 200');

    console.log('✓ All MCP Façade V0 unit tests passed!');
  } catch (err: any) {
    console.error('FAIL:', err);
    await stopServer();
    process.exit(1);
  }

  await stopServer();
}

runTests();
