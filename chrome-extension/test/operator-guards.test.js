// chrome-extension/test/operator-guards.test.js
import assert from 'node:assert';
import { isSensitiveOrigin, guardAction, PAGE_ACTING_OPS } from '../operator/guards.js';
import { dispatchOperator } from '../operator/dispatch.js';
import { setMode, UNGOVERNED } from '../operator/mode.js';

console.log('Running operator-guards tests...');

// isSensitiveOrigin: money-movement hosts flagged, ordinary hosts not.
assert.strictEqual(isSensitiveOrigin('https://www.paypal.com/checkout').sensitive, true);
assert.strictEqual(isSensitiveOrigin('https://checkout.stripe.com/pay').sensitive, true);
assert.strictEqual(isSensitiveOrigin('https://mybank.example/login').sensitive, true);
assert.strictEqual(isSensitiveOrigin('https://news.example/article').sensitive, false);
assert.strictEqual(isSensitiveOrigin('not-a-url').sensitive, false);

// guardAction: page-acting op on sensitive origin needs confirmation.
{
  const blocked = guardAction({ op: 'click', url: 'https://www.paypal.com/pay', params: {} });
  assert.strictEqual(blocked.allow, false);
  assert.strictEqual(blocked.reason, 'sensitive-origin');
  assert.match(blocked.message, /confirmed: true/);
}
// Confirmation bypasses the floor.
assert.strictEqual(guardAction({ op: 'click', url: 'https://www.paypal.com/pay', params: { confirmed: true } }).allow, true);
// Non-acting ops (screenshot, navigate, list_tabs) are never floored.
assert.strictEqual(guardAction({ op: 'screenshot', url: 'https://www.paypal.com/pay', params: {} }).allow, true);
assert.strictEqual(guardAction({ op: 'navigate', url: 'https://www.paypal.com/pay', params: {} }).allow, true);
// Acting op on an ordinary origin is allowed.
assert.strictEqual(guardAction({ op: 'type', url: 'https://news.example/', params: {} }).allow, true);
// The acting-op set is what we expect.
assert.deepStrictEqual([...PAGE_ACTING_OPS].sort(), ['click', 'evaluate', 'press_key', 'type']);

// --- dispatch integration ---
function makeChrome(url) {
  const store = {};
  const noop = { addListener: () => {}, removeListener: () => {} };
  return {
    storage: { local: {
      get: async (k) => (k in store ? { [k]: store[k] } : {}),
      set: async (o) => { Object.assign(store, o); },
    } },
    tabs: {
      query: async () => ([{ id: 1, url, active: true, windowId: 9, status: 'complete' }]),
      get: async (id) => ({ id, url, status: 'complete', windowId: 9 }),
    },
    // Minimal chrome.debugger so a confirmed click can execute through CDP.
    debugger: {
      attach: (_t, _v, cb) => cb(),
      detach: (_t, cb) => cb(),
      sendCommand: (_t, _m, _p, cb) => cb({}),
      onEvent: noop,
      onDetach: noop,
    },
  };
}

// Ungoverned click on PayPal without confirmation is blocked by the floor.
{
  const chrome = makeChrome('https://www.paypal.com/pay');
  await setMode(chrome, UNGOVERNED);
  const res = await dispatchOperator(chrome, { op: 'click', params: { x: 10, y: 10 } });
  assert.strictEqual(res.ok, false, 'click on sensitive origin blocked while ungoverned');
  assert.strictEqual(res.blocked, true);
  assert.strictEqual(res.reason, 'sensitive-origin');
}

// Same click with { confirmed: true } passes the floor and executes.
{
  const chrome = makeChrome('https://www.paypal.com/pay');
  await setMode(chrome, UNGOVERNED);
  const res = await dispatchOperator(chrome, { op: 'click', params: { x: 10, y: 10, confirmed: true } });
  assert.strictEqual(res.ok, true, 'confirmed click executes');
  assert.strictEqual(res.result.x, 10);
}

// Ordinary origin needs no confirmation.
{
  const chrome = makeChrome('https://news.example/');
  await setMode(chrome, UNGOVERNED);
  const res = await dispatchOperator(chrome, { op: 'click', params: { x: 5, y: 5 } });
  assert.strictEqual(res.ok, true, 'click on ordinary origin runs without confirmation');
}

console.log('operator-guards tests passed.');
