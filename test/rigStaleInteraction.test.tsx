// test/rigStaleInteraction.test.tsx
//
// Mounted stale-interaction safety tests for the Rig drawer. They prove that
// consequential, state-dependent actions are only offered when the shown
// connection state is current, while cached cards stay readable and inspectable
// and the recovery control stays reachable.
//
// The panel's own top-bar "Refresh" starts a same-token load whose connections
// GET is parked, so the drawer can be held in the refreshing and stale modes on
// demand and the exact ordering is controlled by hand.

process.env.NODE_ENV = 'test';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
  const win = dom.window as unknown as Window & typeof globalThis;
  (win as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (query: string) => ({
    media: query, matches: false, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => true,
  });
  const globals = globalThis as Record<string, unknown>;
  globals.window = win;
  globals.document = win.document;
  globals.getComputedStyle = win.getComputedStyle.bind(win);
  Object.defineProperty(globals, 'navigator', { value: win.navigator, configurable: true });
  for (const name of ['HTMLElement', 'Element', 'Node', 'Text', 'DocumentFragment', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'MutationObserver', 'DOMParser', 'NodeList']) {
    const value = (win as unknown as Record<string, unknown>)[name];
    if (value) globals[name] = value;
  }
  globals.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0);
  globals.cancelAnimationFrame = (id: number) => clearTimeout(id);
  return win;
}

function resp(body: unknown, over: { ok?: boolean; status?: number } = {}) {
  return { ok: over.ok ?? true, status: over.status ?? 200, statusText: '', json: async () => body, text: async () => JSON.stringify(body ?? {}) };
}

const capOf = (id: string, kind: 'tool' | 'resource' | 'prompt', enabled = false, permission = 'proposable') => ({
  capabilityId: id, kind, name: id, label: id,
  description: { source: 'schema-derived', text: 'does a thing' },
  inputSchema: null, rawDeclaration: {}, permission, enabled,
  structuralDigest: 'd', presentationDigest: 'd',
});

const connected = (id = 'srv') => ({
  connectionId: id, displayName: `Server ${id}`, sourceClass: 'local-user-installed',
  transport: { kind: 'stdio', executablePath: '/x', argv: [], cwd: '/', isolationMode: 'none' },
  state: 'connected', health: { state: 'current', lastSuccessfulContact: null },
  capabilities: { tools: [capOf('cap-0', 'tool')], resources: [], prompts: [], truncated: false, discoveredAt: '2026-01-01T00:00:00Z' },
  connectionApprovalId: null,
});

/** A connection in an arbitrary state, with managed capabilities so every
 *  expanded control is present and, while live, operable. */
const managed = (state: string, tools: unknown[] = [], prompts: unknown[] = []) => ({
  connectionId: `srv-${state}`, displayName: `Server ${state}`, sourceClass: 'panetera-managed',
  transport: { kind: 'stdio', executablePath: '/x', argv: [], cwd: '/', isolationMode: 'none' },
  state, health: { state: state === 'connected' ? 'current' : 'not-measured', lastSuccessfulContact: null },
  capabilities: { tools, resources: [], prompts, truncated: false, discoveredAt: '2026-01-01T00:00:00Z' },
  connectionApprovalId: null,
});

async function harness(initial: unknown[] = [connected()]) {
  const win = installDom();
  const calls: Array<{ url: string; method: string }> = [];
  const connGet: Array<(v: unknown) => void> = [];
  const fetchImpl = (url: string, init?: { method?: string }) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method });
    // Only the list endpoint is parked; sub-resource GETs like `/:id/review`
    // resolve immediately so the dialog can open.
    if (url.endsWith('/api/rig/connections') && method === 'GET') return new Promise((r) => connGet.push(r as (v: unknown) => void));
    if (url.includes('/api/rig/provenance')) return Promise.resolve(resp({ records: [] }));
    // review returns a digest; proposals return a proposal; everything else ok.
    return Promise.resolve(resp({ ok: true, review: { reviewDigest: 'd' }, proposal: { proposalId: 'prop-1' }, approval: { approvalId: 'appr-1' }, result: {} }));
  };
  (globalThis as Record<string, unknown>).fetch = fetchImpl;
  const React = (await import('react')).default;
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const { RigPanel } = await import('../src/components/rig/RigPanel');
  const container = win.document.createElement('div');
  win.document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(React.createElement(RigPanel, { token: 't', onClose: () => {} })); });

  const buttons = () => [...win.document.querySelectorAll('button')] as HTMLButtonElement[];
  const body = () => win.document.body.textContent ?? '';
  const lastButton = (text: string) => buttons().filter((b) => (b.textContent ?? '').trim() === text).at(-1);
  const cardButton = (text: string) => buttons().filter((b) => (b.textContent ?? '').includes(text)).at(-1);
  const topRefresh = () => buttons().find((b) => b.getAttribute('aria-label') === 'Refresh Rig connections');
  const click = (btn: HTMLButtonElement | undefined) => act(async () => {
    if (!btn) throw new Error('button missing');
    btn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  });
  const settleConn = (i: number, value: unknown) => act(async () => { connGet[i](value); });

  // Initial load, live.
  await settleConn(0, resp({ connections: initial }));
  return { win, root, act, calls, connGet, body, buttons, lastButton, cardButton, topRefresh, click, settleConn };
}

const disabled = (b: HTMLButtonElement | undefined) => Boolean(b && b.disabled);

describe('Rig stale-interaction safety', () => {
  it('1. offers the card actions normally when the shown state is current', async () => {
    const h = await harness();
    assert.ok(h.body().includes('Server srv'), 'the card is shown');
    assert.strictEqual(disabled(h.lastButton('Refresh')), false, 'card refresh is available when live');
    assert.strictEqual(disabled(h.lastButton('Stop')), false, 'stop is available when live');
    assert.strictEqual(disabled(h.lastButton('Remove')), false, 'remove is available when live');
    assert.ok(!h.body().includes('Actions are paused') && !h.body().includes('Refresh to load the current state'));
    await h.act(async () => { h.root.unmount(); });
  });

  it('2. a failed refresh keeps cached cards inspectable', async () => {
    const h = await harness();
    await h.click(h.topRefresh());                 // refreshing: connGet[1] parked
    await h.settleConn(1, resp({}, { ok: false, status: 500 })); // -> stale
    assert.ok(h.body().includes('Server srv'), 'the cached card is preserved');
    const inspect = h.buttons().find((b) => (b.textContent ?? '').startsWith('Inspect'));
    assert.strictEqual(disabled(inspect), false, 'inspection stays available while stale');
    await h.click(inspect);                          // expand the cached details
    assert.ok(h.body().includes('cap-0'), 'cached capability details remain readable');
    await h.act(async () => { h.root.unmount(); });
  });

  it('3. withholds consequential actions while stale, with a text explanation', async () => {
    const h = await harness();
    await h.click(h.topRefresh());
    await h.settleConn(1, resp({}, { ok: false, status: 500 }));
    assert.ok(h.body().includes('Refresh to load the current state before acting'), 'the reason is stated in words');
    assert.strictEqual(disabled(h.lastButton('Refresh')), true, 'card refresh withheld while stale');
    assert.strictEqual(disabled(h.lastButton('Stop')), true, 'stop withheld while stale');
    assert.strictEqual(disabled(h.lastButton('Remove')), true, 'remove withheld while stale');
    // The disabled controls point at the shared explanation for assistive tech.
    const stop = h.lastButton('Stop');
    assert.strictEqual(stop?.getAttribute('aria-describedby'), 'rig-actions-paused');
    await h.act(async () => { h.root.unmount(); });
  });

  it('4. keeps the recovery control usable while stale', async () => {
    const h = await harness();
    await h.click(h.topRefresh());
    await h.settleConn(1, resp({}, { ok: false, status: 500 }));
    const retry = h.buttons().find((b) => (b.textContent ?? '').trim() === 'Retry');
    assert.strictEqual(disabled(retry), false, 'Retry is reachable to recover current state');
    const before = h.calls.filter((c) => c.url.includes('/connections') && c.method === 'GET').length;
    await h.click(retry);
    const after = h.calls.filter((c) => c.url.includes('/connections') && c.method === 'GET').length;
    assert.strictEqual(after, before + 1, 'Retry issues a fresh connections load');
    await h.act(async () => { h.root.unmount(); });
  });

  it('5. restores actions after a successful refresh', async () => {
    const h = await harness();
    await h.click(h.topRefresh());
    await h.settleConn(1, resp({}, { ok: false, status: 500 })); // stale
    assert.strictEqual(disabled(h.lastButton('Stop')), true, 'withheld while stale');
    await h.click(h.topRefresh());                                // refreshing again (connGet[2])
    await h.settleConn(2, resp({ connections: [connected()] }));  // recovered -> live
    assert.strictEqual(disabled(h.lastButton('Stop')), false, 'actions restored after recovery');
    assert.ok(!h.body().includes('Refresh to load the current state'), 'the paused note clears');
    await h.act(async () => { h.root.unmount(); });
  });

  it('6. an in-flight refresh cannot be bypassed through card controls', async () => {
    const h = await harness();
    await h.click(h.topRefresh());                 // refreshing: connGet[1] parked, not resolved
    assert.ok(h.body().includes('Actions are paused'), 'refreshing is disclosed');
    assert.strictEqual(disabled(h.lastButton('Stop')), true, 'stop paused during refresh');
    const before = h.calls.filter((c) => c.method === 'POST' && /\/stop$/.test(c.url)).length;
    await h.click(h.lastButton('Stop'));           // disabled: must do nothing
    const after = h.calls.filter((c) => c.method === 'POST' && /\/stop$/.test(c.url)).length;
    assert.strictEqual(after, before, 'a paused control cannot race the refresh');
    await h.act(async () => { h.root.unmount(); });
  });

  it('7. emits no React or accessibility warnings across the mode transitions', async () => {
    const warnings: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
    try {
      const h = await harness();
      await h.click(h.topRefresh());
      await h.settleConn(1, resp({}, { ok: false, status: 500 }));
      const inspect = h.buttons().find((b) => (b.textContent ?? '').startsWith('Inspect'));
      await h.click(inspect);
      await h.act(async () => { h.root.unmount(); });
    } finally {
      console.error = original;
    }
    assert.deepStrictEqual(warnings.filter((w) => /Warning:|unique "key"/i.test(w)), [], `warnings:\n${warnings.join('\n')}`);
  });
});

const named = (text: string, buttons: HTMLButtonElement[]) => buttons.find((b) => (b.textContent ?? '').trim() === text);

describe('Rig dialog completion respects the stale guard', () => {
  it('disables Approve when a refresh begins after the review dialog opened, and makes no approval request', async () => {
    const h = await harness([managed('stopped', [capOf('cap-0', 'tool')])]);
    await h.click(named('Review and reconnect', h.buttons())); // opens the review dialog (GET /review)
    assert.ok(h.body().includes('Review exact connection'), 'the review dialog is open');
    assert.strictEqual(disabled(named('Approve connection', h.buttons())), false, 'Approve is available while live');

    await h.click(h.topRefresh()); // refreshing begins with the dialog still open
    assert.strictEqual(disabled(named('Approve connection', h.buttons())), true, 'Approve is disabled during refresh');
    assert.strictEqual(disabled(named('Cancel', h.buttons())), false, 'Cancel stays available');
    const approvals = h.calls.filter((c) => c.method === 'POST' && /\/approve$/.test(c.url)).length;
    assert.strictEqual(approvals, 0, 'no approval request is made while paused');
    await h.act(async () => { h.root.unmount(); });
  });

  it('keeps Approve disabled after the refresh fails, with an explanation inside the dialog', async () => {
    const h = await harness([managed('stopped', [capOf('cap-0', 'tool')])]);
    await h.click(named('Review and reconnect', h.buttons()));
    await h.click(h.topRefresh());
    await h.settleConn(1, resp({}, { ok: false, status: 500 })); // -> stale, dialog still open
    assert.strictEqual(disabled(named('Approve connection', h.buttons())), true, 'Approve stays disabled while stale');
    // The explanation lives inside the modal, since the background is hidden from AT.
    const dialog = h.win.document.querySelector('[role="dialog"]');
    assert.ok(dialog && /Refresh to load the current state before acting/.test(dialog.textContent ?? ''), 'dialog-local explanation is present');
    await h.act(async () => { h.root.unmount(); });
  });

  it('prevents final deletion when the remove dialog is open during refresh/stale', async () => {
    const h = await harness([connected()]);
    await h.click(named('Remove', h.buttons())); // opens the remove dialog
    assert.ok(h.body().includes('Remove this Rig connection?'), 'the remove dialog is open');
    assert.strictEqual(disabled(named('Remove connection', h.buttons())), false, 'deletion available while live');

    await h.click(h.topRefresh());
    await h.settleConn(1, resp({}, { ok: false, status: 500 })); // stale
    assert.strictEqual(disabled(named('Remove connection', h.buttons())), true, 'deletion withheld while stale');
    assert.strictEqual(disabled(named('Cancel', h.buttons())), false, 'Cancel stays available');
    const deletes = h.calls.filter((c) => c.method === 'DELETE').length;
    assert.strictEqual(deletes, 0, 'no deletion request is made while paused');
    await h.act(async () => { h.root.unmount(); });
  });
});

describe('Rig expanded-capability controls respect the stale guard', () => {
  const expandFirst = async (h: Awaited<ReturnType<typeof harness>>) => {
    const inspect = h.buttons().find((b) => (b.textContent ?? '').startsWith('Inspect'));
    await h.click(inspect);
  };
  const checkbox = (win: Window) => win.document.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
  const permissionCombo = (win: Window) => win.document.querySelector('[aria-label^="Permission for"]') as HTMLElement | null;
  const argTextarea = (win: Window) => win.document.querySelector('textarea:not([aria-hidden="true"])') as HTMLTextAreaElement | null;

  it('gates enable, permission, and invocation controls while stale, but keeps arguments editable', async () => {
    const h = await harness([managed('connected', [capOf('cap-0', 'tool', true, 'proposable')], [capOf('cap-1', 'prompt', true, 'proposable')])]);
    await expandFirst(h);
    assert.ok(h.body().includes('cap-0') && h.body().includes('cap-1'), 'capabilities are inspectable');
    assert.strictEqual(disabled(named('Review invocation', h.buttons())), false, 'invocation available while live');

    await h.click(h.topRefresh());
    await h.settleConn(1, resp({}, { ok: false, status: 500 })); // stale

    assert.strictEqual(checkbox(h.win)?.disabled, true, 'enable checkbox gated while stale');
    assert.ok(permissionCombo(h.win)?.className.includes('Mui-disabled'), 'permission select gated while stale');
    assert.strictEqual(disabled(named('Review invocation', h.buttons())), true, 'propose invocation gated while stale');
    assert.strictEqual(disabled(named('Load prompt', h.buttons())), true, 'prompt retrieval gated while stale');
    // Inspection and cached argument entry remain usable.
    const ta = argTextarea(h.win);
    assert.ok(ta && ta.disabled === false, 'cached argument field stays editable');
    await h.act(async () => { h.root.unmount(); });
  });

  it('gates Approve and run once a proposal exists and a refresh is in flight', async () => {
    const h = await harness([managed('connected', [capOf('cap-0', 'tool', true, 'proposable')])]);
    await expandFirst(h);
    await h.click(named('Review invocation', h.buttons())); // propose (live) -> proposal exists
    assert.ok(h.body().includes('Approve and run'), 'the proposal produced an approve-and-run affordance');
    assert.strictEqual(disabled(named('Approve and run', h.buttons())), false, 'available while live');

    await h.click(h.topRefresh()); // refreshing in flight
    assert.strictEqual(disabled(named('Approve and run', h.buttons())), true, 'approve-and-run gated during refresh');
    const invocations = h.calls.filter((c) => c.method === 'POST' && /\/invocations$/.test(c.url)).length;
    assert.strictEqual(invocations, 0, 'no invocation is run while paused');
    await h.act(async () => { h.root.unmount(); });
  });

  it('restores expanded controls only from the newly loaded state', async () => {
    const h = await harness([managed('connected', [capOf('cap-0', 'tool', true, 'proposable')])]);
    await expandFirst(h);
    await h.click(h.topRefresh());
    await h.settleConn(1, resp({}, { ok: false, status: 500 })); // stale
    assert.strictEqual(disabled(named('Review invocation', h.buttons())), true, 'gated while stale');
    await h.click(h.topRefresh());
    await h.settleConn(2, resp({ connections: [managed('connected', [capOf('cap-0', 'tool', true, 'proposable')])] })); // recovered
    // The card stays expanded across the refresh (same connection id), so the
    // capability controls re-render from the newly loaded state without re-expanding.
    assert.strictEqual(disabled(named('Review invocation', h.buttons())), false, 'controls restored from the new state');
    await h.act(async () => { h.root.unmount(); });
  });
});
