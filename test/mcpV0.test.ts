import assert from 'assert';
import http from 'http';
import { app } from '../server/index';
import { browserEvidenceStore } from '../server/browserEvidenceStore';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

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
