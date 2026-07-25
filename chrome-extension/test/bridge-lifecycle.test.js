import assert from 'node:assert';
import { JSDOM } from 'jsdom';

console.log('Running bridge lifecycle tests...');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5173/' });
const outgoing = [];
const disconnectListeners = [];
const responseListeners = [];
const portMessages = [];
let manifestReads = 0;
let connectCalls = 0;

dom.window.postMessage = (message) => { outgoing.push(message); };
globalThis.window = dom.window;
globalThis.chrome = {
  runtime: {
    getManifest: () => {
      manifestReads += 1;
      return { version: '0.1.0' };
    },
    connect: () => {
      connectCalls += 1;
      return {
        onDisconnect: { addListener: (listener) => disconnectListeners.push(listener) },
        onMessage: { addListener: (listener) => responseListeners.push(listener) },
        postMessage: (message) => portMessages.push(message),
      };
    },
  },
};

await import(`../paneteraBridge.js?lifecycle=${Date.now()}`);
assert.deepStrictEqual(outgoing.pop(), {
  source: 'panetera-browser-operator',
  type: 'READY',
  version: '0.1.0',
});
assert.strictEqual(manifestReads, 1, 'runtime metadata is read exactly once while the context is valid');
assert.strictEqual(connectCalls, 1);

function sendToBridge(message) {
  dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
    data: { source: 'panetera-ui', ...message },
    source: dom.window,
    origin: 'http://localhost:5173',
  }));
}

sendToBridge({ type: 'PAIRING_OFFER', code: '1234-5678', nonce: 'offer-1' });
assert.deepStrictEqual(portMessages.pop(), {
  type: 'offer-pairing',
  code: '1234-5678',
  requestId: 'offer-1',
});
responseListeners[0]({ requestId: 'offer-1', success: true });
assert.deepStrictEqual(outgoing.pop(), {
  source: 'panetera-browser-operator',
  type: 'PAIRING_OFFER_RESULT',
  success: true,
  nonce: 'offer-1',
});

sendToBridge({ type: 'OBSERVE_WEB', url: 'https://example.com/', nonce: 'observe-1' });
assert.deepStrictEqual(portMessages.pop(), {
  type: 'request-web-observation',
  url: 'https://example.com/',
  requestId: 'observe-1',
});
responseListeners[0]({ requestId: 'observe-1', success: true, captureId: 'capture-1' });
assert.deepStrictEqual(outgoing.pop(), {
  source: 'panetera-browser-operator',
  type: 'WEB_OBSERVATION_RESULT',
  success: true,
  captureId: 'capture-1',
  error: undefined,
  nonce: 'observe-1',
});

sendToBridge({ type: 'OPEN_WEB_LIVE', url: 'https://example.com/', nonce: 'live-open-1' });
assert.deepStrictEqual(portMessages.pop(), {
  type: 'request-live-web-session',
  url: 'https://example.com/',
  requestId: 'live-open-1',
});
responseListeners[0]({
  requestId: 'live-open-1',
  success: true,
  sessionId: 'live-1',
  screenshotDataUrl: 'data:image/jpeg;base64,AAAA',
});
assert.deepStrictEqual(outgoing.pop(), {
  source: 'panetera-browser-operator',
  type: 'WEB_LIVE_RESULT',
  requestId: 'live-open-1',
  success: true,
  sessionId: 'live-1',
  screenshotDataUrl: 'data:image/jpeg;base64,AAAA',
  nonce: 'live-open-1',
});

sendToBridge({
  type: 'WEB_LIVE_COMMAND',
  sessionId: 'live-1',
  action: 'inspect',
  point: { xRatio: 0.25, yRatio: 0.5 },
  nonce: 'live-command-1',
});
assert.deepStrictEqual(portMessages.pop(), {
  type: 'request-live-web-command',
  sessionId: 'live-1',
  action: 'inspect',
  point: { xRatio: 0.25, yRatio: 0.5 },
  requestId: 'live-command-1',
});
responseListeners[0]({
  requestId: 'live-command-1',
  success: true,
  component: { tagName: 'button' },
});
assert.deepStrictEqual(outgoing.pop(), {
  source: 'panetera-browser-operator',
  type: 'WEB_LIVE_COMMAND_RESULT',
  requestId: 'live-command-1',
  success: true,
  component: { tagName: 'button' },
  nonce: 'live-command-1',
});

disconnectListeners[0]();
assert.strictEqual(outgoing.pop().type, 'RELOAD_REQUIRED');
sendToBridge({ type: 'PING', nonce: 'ping-after-reload' });
assert.deepStrictEqual(outgoing.pop(), {
  source: 'panetera-browser-operator',
  type: 'READY',
  version: '0.1.0',
  nonce: 'ping-after-reload',
});
assert.strictEqual(connectCalls, 2, 'a live context heals a transiently closed port on handshake');
assert.strictEqual(manifestReads, 2);
sendToBridge({ type: 'PAIRING_OFFER', code: '1234-5678', nonce: 'offer-after-reload' });
assert.deepStrictEqual(portMessages.pop(), {
  type: 'offer-pairing',
  code: '1234-5678',
  requestId: 'offer-after-reload',
});

sendToBridge({ type: 'STATUS_CHECK', nonce: 'status-1' });
assert.deepStrictEqual(portMessages.pop(), {
  type: 'check-status',
  requestId: 'status-1',
});
responseListeners[1]({ requestId: 'status-1', paired: true });
assert.deepStrictEqual(outgoing.pop(), {
  source: 'panetera-browser-operator',
  type: 'OPERATOR_STATUS',
  paired: true,
  error: undefined,
  nonce: 'status-1',
});

// BFCache closes the port too, but restoring that same document is recoverable
// and must create a fresh live port instead of demanding a page reload forever.
dom.window.dispatchEvent(new dom.window.PageTransitionEvent('pagehide', { persisted: true }));
disconnectListeners[1]();
assert.ok(!outgoing.some((message) => message.type === 'RELOAD_REQUIRED'));
dom.window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true }));
assert.strictEqual(connectCalls, 3, 'a restored BFCache document reconnects its bridge');
assert.deepStrictEqual(outgoing.pop(), {
  source: 'panetera-browser-operator',
  type: 'READY',
  version: '0.1.0',
});

delete globalThis.chrome;
delete globalThis.window;
dom.window.close();
console.log('✅ bridge lifecycle tests passed.');
