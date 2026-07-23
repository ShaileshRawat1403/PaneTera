import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extDir = path.resolve(__dirname, '..');
const chromeCandidates = [
  process.env.PANETERA_CHROME_PATH,
  '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);
const chromePath = chromeCandidates.find(candidate => fs.existsSync(candidate));

console.log('Running real Chrome extension acceptance...');
if (!chromePath) throw new Error('Required Chrome acceptance was not run: no Chrome-compatible binary is available');

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    request.once('error', reject);
    request.setTimeout(1_000, () => request.destroy(new Error('CDP request timeout')));
  });
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const waiter = this.pending.get(message.id);
        if (!waiter) return;
        this.pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error.message));
        else waiter.resolve(message.result);
      } else {
        this.events.push(message);
      }
    });
  }

  static connect(url) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.addEventListener('open', () => resolve(new CdpClient(socket)), { once: true });
      socket.addEventListener('error', () => reject(new Error('Unable to connect to CDP target')), { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() { this.socket.close(); }
}

const fixturePort = await freePort();
const cdpPort = await freePort();
const fixtureUrl = `http://127.0.0.1:${fixturePort}/fixture?token=raw-secret`;
const fixtureServer = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html><html><head><title>Fixture sk-abcdefghijklmnopqrstuvwxyz123456</title></head><body>
    <article><h1>Acceptance article</h1><p>Visible evidence</p></article>
    <table><tbody><tr><td>Account <input value="private-form-value"></td><td>Static label</td></tr></tbody></table>
  </body></html>`);
});
await new Promise(resolve => fixtureServer.listen(fixturePort, '127.0.0.1', resolve));

const userDir = fs.mkdtempSync(path.join('/tmp', 'panetera-chrome-profile-'));
let stderr = '';
const chromeProc = spawn(chromePath, [
  '--no-sandbox',
  `--user-data-dir=${userDir}`,
  `--remote-debugging-port=${cdpPort}`,
  `--disable-extensions-except=${extDir}`,
  `--load-extension=${extDir}`,
  '--headless=new',
  fixtureUrl,
], { stdio: ['ignore', 'pipe', 'pipe'] });
chromeProc.stderr.on('data', chunk => { stderr += String(chunk); });

async function waitForTargets() {
  let lastTargets = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    await sleep(250);
    try {
      const targets = await getJson(`http://127.0.0.1:${cdpPort}/json/list`);
      lastTargets = targets;
      const worker = targets.find(target => target.type === 'service_worker' && target.url.startsWith('chrome-extension://') && target.url.endsWith('/background.js'));
      const page = targets.find(target => target.type === 'page' && target.url.startsWith(`http://127.0.0.1:${fixturePort}/fixture`));
      if (worker && page) return { worker, page };
    } catch {}
  }
  const summary = lastTargets.map(target => `${target.type}:${target.url}`).join(', ');
  throw new Error(`Chrome did not expose both the PaneTera service worker and fixture page. Targets: ${summary || 'none'}. stderr: ${stderr.slice(-2000)}`);
}

let workerClient;
let pageClient;
try {
  const { worker, page } = await waitForTargets();
  workerClient = await CdpClient.connect(worker.webSocketDebuggerUrl);
  pageClient = await CdpClient.connect(page.webSocketDebuggerUrl);
  await workerClient.send('Runtime.enable');
  await pageClient.send('Runtime.enable');
  await workerClient.send('Log.enable');

  const manifestResult = await workerClient.send('Runtime.evaluate', {
    expression: 'chrome.runtime.getManifest()', returnByValue: true, awaitPromise: true
  });
  assert.strictEqual(manifestResult.result.value.name, 'PaneTera Browser Operator', 'actual extension service worker must load the PaneTera manifest');

  const bundle = fs.readFileSync(path.join(extDir, 'dist', 'capture.bundle.js'), 'utf8');
  const loadResult = await pageClient.send('Runtime.evaluate', { expression: bundle, awaitPromise: true });
  assert.ok(!loadResult.exceptionDetails, 'production capture bundle must evaluate in real Chrome');
  const extractionResult = await pageClient.send('Runtime.evaluate', {
    expression: `({
      phase1: PaneTeraExtractors['browser.page.observe'](),
      table: PaneTeraExtractors['browser.table.extract'](),
      article: PaneTeraExtractors['browser.article.extract']()
    })`,
    returnByValue: true,
    awaitPromise: true
  });
  assert.ok(!extractionResult.exceptionDetails, 'real Chrome extraction must complete without an exception');
  const captures = extractionResult.result.value;
  const serialized = JSON.stringify(captures);
  assert.ok(captures.phase1 && captures.table && captures.article, 'Phase 1 and Phase 2 capabilities must execute');
  assert.strictEqual(serialized.includes('raw-secret'), false, 'real Chrome capture must redact URL query secrets');
  assert.strictEqual(serialized.includes('private-form-value'), false, 'real Chrome capture must not expose form values');
  assert.strictEqual(serialized.includes('sk-abcdefghijklmnopqrstuvwxyz'), false, 'real Chrome capture must redact title credentials');
  assert.ok(serialized.includes('[FORM_VALUE_REDACTED]'), 'real Chrome table extraction must preserve a form-value redaction marker');

  const bridgeResult = await pageClient.send('Runtime.evaluate', {
    expression: `new Promise((resolve) => {
      const nonce = crypto.randomUUID();
      const timeout = setTimeout(() => resolve({ timeout: true }), 1500);
      window.addEventListener('message', function onBridgeMessage(event) {
        if (event.data?.source !== 'panetera-browser-operator' || event.data?.type !== 'READY' || event.data?.nonce !== nonce) return;
        window.removeEventListener('message', onBridgeMessage);
        clearTimeout(timeout);
        resolve({ ready: true, version: event.data.version });
      });
      window.postMessage({ source: 'panetera-ui', type: 'PING', nonce }, window.location.origin);
    })`,
    returnByValue: true,
    awaitPromise: true
  });
  assert.deepStrictEqual(bridgeResult.result.value, { ready: true, version: '0.1.0' }, 'the real content-script bridge must answer through its stable port');

  await sleep(200);
  const runtimeErrors = [...workerClient.events, ...pageClient.events].filter(event =>
    event.method === 'Runtime.exceptionThrown' ||
    (event.method === 'Log.entryAdded' && ['error', 'warning'].includes(event.params?.entry?.level))
  );
  assert.deepStrictEqual(runtimeErrors, [], 'extension and extraction targets must have no runtime errors');
  assert.strictEqual(/Manifest.*error|Service worker registration failed/i.test(stderr), false, 'Chrome stderr must not contain extension load failures');
  console.log(`✅ Real Chrome acceptance passed (${worker.url}).`);
} finally {
  workerClient?.close();
  pageClient?.close();
  chromeProc.kill('SIGTERM');
  await sleep(250);
  if (!chromeProc.killed) chromeProc.kill('SIGKILL');
  await new Promise(resolve => fixtureServer.close(resolve));
  fs.rmSync(userDir, { recursive: true, force: true });
}
