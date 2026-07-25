import assert from 'node:assert';
import {
  commandLiveSession,
  resetLiveSessionsForTest,
  startLiveSession,
} from '../liveSession.js';

console.log('Running managed live-session tests...');

function harness({ preexisting = false } = {}) {
  let currentUrl = 'https://example.com/page';
  const removedWindows = [];
  const removedOrigins = [];
  const focusedWindows = [];
  const chromeApi = {
    windows: {
      create: async () => ({
        id: 9,
        tabs: [{ id: 41, windowId: 9, url: currentUrl, status: 'complete' }],
      }),
      remove: async id => { removedWindows.push(id); },
      update: async (id, options) => { focusedWindows.push({ id, options }); },
    },
    tabs: {
      get: async () => ({ id: 41, windowId: 9, url: currentUrl, status: 'complete' }),
      captureVisibleTab: async () => 'data:image/jpeg;base64,ZmFrZS1mcmFtZQ==',
    },
    scripting: {
      executeScript: async ({ args }) => {
        if (args) {
          return [{
            result: {
              tagName: 'button',
              id: 'launch',
              classNames: ['primary'],
              role: 'button',
              text: 'Email me at private@example.com with sk-abcdefghijklmnopqrstuvwxyz1234',
              attributes: { role: 'button', href: 'https://example.com/?token=secret' },
              path: 'html > body > button#launch',
              rect: { x: 1, y: 2, width: 100, height: 40 },
              styles: { display: 'block', color: 'rgb(0, 0, 0)' },
            },
          }];
        }
        return [{
          result: {
            title: 'Example',
            url: currentUrl,
            width: 1200,
            height: 800,
            devicePixelRatio: 2,
          },
        }];
      },
    },
    permissions: {
      remove: async ({ origins }) => { removedOrigins.push(...origins); },
    },
  };
  return {
    chromeApi,
    removedWindows,
    removedOrigins,
    focusedWindows,
    setUrl: value => { currentUrl = value; },
    start: () => startLiveSession({
      url: currentUrl,
      consumerTabId: 7,
      permissionWasPreexisting: preexisting,
    }, {
      chromeApi,
      waitForTabReady: async () => chromeApi.tabs.get(41),
      randomUUID: () => 'session-1',
    }),
  };
}

resetLiveSessionsForTest();
const first = harness();
const opened = await first.start();
assert.strictEqual(opened.success, true);
assert.strictEqual(opened.sessionId, 'live-session-1');
assert.strictEqual(opened.url, 'https://example.com/page');
assert.strictEqual(opened.viewport.width, 1200);
assert.match(opened.screenshotDataUrl, /^data:image\/jpeg;base64,/);

const inspected = await commandLiveSession({
  sessionId: opened.sessionId,
  consumerTabId: 7,
  action: 'inspect',
  point: { xRatio: 0.5, yRatio: 0.25 },
}, { chromeApi: first.chromeApi });
assert.strictEqual(inspected.component.tagName, 'button');
assert.ok(!JSON.stringify(inspected).includes('private@example.com'));
assert.ok(!JSON.stringify(inspected).includes('abcdefghijklmnopqrstuvwxyz1234'));
assert.ok(!JSON.stringify(inspected).includes('secret'));
assert.match(inspected.component.text, /REDACTED/);

await assert.rejects(
  commandLiveSession({
    sessionId: opened.sessionId,
    consumerTabId: 8,
    action: 'snapshot',
  }, { chromeApi: first.chromeApi }),
  /unavailable/
);

first.setUrl('https://other.example/path');
await assert.rejects(
  commandLiveSession({
    sessionId: opened.sessionId,
    consumerTabId: 7,
    action: 'snapshot',
  }, { chromeApi: first.chromeApi }),
  /outside the approved website/
);
first.setUrl('https://example.com/page');

await commandLiveSession({
  sessionId: opened.sessionId,
  consumerTabId: 7,
  action: 'focus',
}, { chromeApi: first.chromeApi });
assert.deepStrictEqual(first.focusedWindows, [{ id: 9, options: { focused: true } }]);

await commandLiveSession({
  sessionId: opened.sessionId,
  consumerTabId: 7,
  action: 'close',
}, { chromeApi: first.chromeApi });
assert.deepStrictEqual(first.removedWindows, [9]);
assert.deepStrictEqual(first.removedOrigins, ['https://example.com/*']);

resetLiveSessionsForTest();
const retained = harness({ preexisting: true });
const retainedSession = await retained.start();
await commandLiveSession({
  sessionId: retainedSession.sessionId,
  consumerTabId: 7,
  action: 'close',
}, { chromeApi: retained.chromeApi });
assert.deepStrictEqual(retained.removedOrigins, [], 'a pre-existing site grant must be retained');

resetLiveSessionsForTest();
console.log('✅ managed live-session tests passed.');
