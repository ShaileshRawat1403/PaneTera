// chrome-extension/test/operator-dispatch.test.js
import assert from 'node:assert';
import { dispatchOperator, knownOps } from '../operator/dispatch.js';
import { setMode, GOVERNED, UNGOVERNED } from '../operator/mode.js';
import { navigate, listTabs } from '../operator/navigation.js';

console.log('Running operator-dispatch tests...');

function makeChrome() {
  const store = {};
  const noopListener = { addListener: () => {}, removeListener: () => {} };
  return {
    storage: { local: {
      get: async (key) => (key in store ? { [key]: store[key] } : {}),
      set: async (obj) => { Object.assign(store, obj); },
    } },
    tabs: {
      query: async () => ([{ id: 1, url: 'https://a.example', title: 'A', active: true, windowId: 9, status: 'complete' }]),
      get: async (id) => ({ id, url: 'https://a.example', title: 'A', status: 'complete', windowId: 9 }),
      update: async (id) => ({ id, windowId: 9 }),
      create: async () => ({ id: 2, windowId: 9 }),
      remove: async () => {},
      onUpdated: noopListener,
    },
    windows: { update: async () => {} },
  };
}

// Registry is populated and stable.
assert.ok(knownOps().includes('navigate'), 'navigate op registered');
assert.ok(knownOps().includes('list_tabs'), 'list_tabs op registered');

// Unknown op is refused clearly.
{
  const chrome = makeChrome();
  const res = await dispatchOperator(chrome, { op: 'launch_missiles' });
  assert.strictEqual(res.ok, false);
  assert.match(res.error, /Unknown operator op/);
}

// Governed mode: a page-authority-free read (list_tabs) is allowed.
{
  const chrome = makeChrome();
  await setMode(chrome, GOVERNED);
  const res = await dispatchOperator(chrome, { op: 'list_tabs', params: {} });
  assert.strictEqual(res.ok, true, 'list_tabs allowed while governed');
  assert.strictEqual(res.mode, GOVERNED);
  assert.strictEqual(res.result.tabs.length, 1);
}

// Governed mode: an acting op (navigate) is blocked with a toggle hint.
{
  const chrome = makeChrome();
  await setMode(chrome, GOVERNED);
  const res = await dispatchOperator(chrome, { op: 'navigate', params: { url: 'https://b.example' } });
  assert.strictEqual(res.ok, false, 'navigate blocked while governed');
  assert.strictEqual(res.blocked, true);
  assert.match(res.error, /full-operator mode/);
}

// Ungoverned mode: navigate runs directly.
{
  const chrome = makeChrome();
  await setMode(chrome, UNGOVERNED);
  const res = await dispatchOperator(chrome, { op: 'navigate', params: { url: 'https://b.example', waitForLoad: false } });
  assert.strictEqual(res.ok, true, 'navigate runs while ungoverned');
  assert.strictEqual(res.mode, UNGOVERNED);
  assert.strictEqual(res.result.tabId, 1);
}

// Audit sink observes both a blocked attempt and a success, and its own throw
// never breaks dispatch.
{
  const chrome = makeChrome();
  await setMode(chrome, GOVERNED);
  const events = [];
  await dispatchOperator(chrome, { op: 'navigate', params: { url: 'https://b.example' } }, {
    onAudit: (e) => { events.push(e); throw new Error('audit sink boom'); },
  });
  assert.strictEqual(events.length, 1, 'audit fired for blocked op');
  assert.strictEqual(events[0].reason, 'blocked-governed');

  await setMode(chrome, UNGOVERNED);
  const okEvents = [];
  const res = await dispatchOperator(chrome, { op: 'list_tabs' }, { onAudit: (e) => okEvents.push(e) });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(okEvents[0].ok, true);
}

// Navigation scheme guard: javascript: and file: are refused at the module.
await assert.rejects(() => navigate(makeChrome(), { url: 'javascript:alert(1)' }), /unsupported scheme/);
await assert.rejects(() => navigate(makeChrome(), { url: 'file:///etc/passwd' }), /unsupported scheme/);

// listTabs projection shape is compact and non-sensitive.
{
  const out = await listTabs(makeChrome(), {});
  assert.deepStrictEqual(Object.keys(out.tabs[0]).sort(), ['active', 'status', 'tabId', 'title', 'url', 'windowId']);
}

console.log('operator-dispatch tests passed.');
