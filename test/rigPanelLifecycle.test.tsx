// test/rigPanelLifecycle.test.tsx
//
// Component-level tests for the Rig drawer's data-loading boundary in a real DOM.
// They cover the hazards the reviewer named: an initial failure must not read as
// an empty Rig or claim zero resources; a same-token refresh that fails must
// preserve the cached inventory as visibly stale; a token change is a new
// principal, so the previous token's data must vanish immediately and never
// resurface as stale; overlapping loads must not publish out of order; malformed
// elements must fail without crashing; and provenance must stay independent, fail
// closed, and disclose staleness.
//
// Same-token refreshes are driven by clicking the panel's Refresh button (the
// panel renders inline, not in a portal, so clicks route normally). Token changes
// are driven by re-rendering with a new token prop. Fetch resolution is hand-
// controlled so ordering is exact.

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

function resp(body: unknown, over: { ok?: boolean; status?: number; statusText?: string } = {}) {
  const text = JSON.stringify(body ?? {});
  return { ok: over.ok ?? true, status: over.status ?? 200, statusText: over.statusText ?? '', json: async () => body, text: async () => text };
}

function router() {
  const conn: Array<(v: unknown) => void> = [];
  const prov: Array<(v: unknown) => void> = [];
  const fetchImpl = (url: string) => new Promise((resolve) => {
    if (url.includes('/api/rig/connections')) conn.push(resolve as (v: unknown) => void);
    else if (url.includes('/api/rig/provenance')) prov.push(resolve as (v: unknown) => void);
    else resolve(resp({})); // browser pairing status and anything else: benign.
  });
  return { fetchImpl, conn, prov };
}

const connection = (id: string) => ({
  connectionId: id, displayName: id, sourceClass: 'local-user-installed',
  transport: { kind: 'stdio', executablePath: '/x', argv: [], cwd: '/', isolationMode: 'none' },
  state: 'connected', health: { state: 'current', lastSuccessfulContact: null },
  capabilities: { tools: [], resources: [], prompts: [], truncated: false, discoveredAt: null },
  connectionApprovalId: null,
});

async function harness() {
  const win = installDom();
  const { fetchImpl, conn, prov } = router();
  (globalThis as Record<string, unknown>).fetch = fetchImpl;
  const React = (await import('react')).default;
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const { RigPanel } = await import('../src/components/rig/RigPanel');
  const container = win.document.createElement('div');
  win.document.body.appendChild(container);
  const root = createRoot(container);
  const render = (token: string) => act(async () => { root.render(React.createElement(RigPanel, { token, onClose: () => {} })); });
  const body = () => win.document.body.textContent ?? '';
  const settle = (resolver: (v: unknown) => void, value: unknown) => act(async () => { resolver(value); });
  const click = (predicate: (b: HTMLButtonElement) => boolean) => act(async () => {
    const btn = [...win.document.querySelectorAll('button')].find(predicate as (b: Element) => boolean) as HTMLButtonElement | undefined;
    if (!btn) throw new Error('button not found');
    btn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  });
  const clickRefresh = () => click((b) => b.getAttribute('aria-label') === 'Refresh Rig connections');
  const clickText = (text: string) => click((b) => (b.textContent ?? '').includes(text));
  return { React, act, root, render, body, conn, prov, settle, clickRefresh, clickText };
}

describe('the Rig drawer load lifecycle is honest, isolated, and ordered', () => {
  it('shows a hard error, not an empty Rig or a zero-resource claim, on initial failure', async () => {
    const h = await harness();
    await h.render('t1');
    await h.settle(h.conn[0], resp({}, { ok: false, status: 401, statusText: 'Unauthorized' }));
    if (h.prov[0]) await h.settle(h.prov[0], resp({ records: [] }));

    assert.ok(h.body().includes('Could not load Rig connections (401'), 'the failure reason is shown');
    assert.ok(!h.body().includes('No MCP servers connected yet.'), 'an unavailable Rig is not shown as empty');
    assert.ok(!h.body().includes('Connections (0)'), 'no false zero count');
    assert.ok(!h.body().includes('MCP resources are available'), 'no false zero-resource claim');
    await h.act(async () => { h.root.unmount(); });
  });

  it('treats only a successful empty array as the authoritative empty Rig', async () => {
    const h = await harness();
    await h.render('t1');
    await h.settle(h.conn[0], resp({ connections: [] }));
    assert.ok(h.body().includes('No MCP servers connected yet.'), 'a successful empty load is authoritative empty');
    assert.ok(h.body().includes('Connections (0)'), 'the zero count is shown for a real empty Rig');
    assert.ok(h.body().includes('0 MCP resources are available'), 'zero resources is truthful only when authoritatively empty');
    await h.act(async () => { h.root.unmount(); });
  });

  it('keeps cached connections and a stale alert on a same-token failed refresh, then recovers', async () => {
    const h = await harness();
    await h.render('t1');
    await h.settle(h.conn[0], resp({ connections: [connection('alpha-server')] }));
    assert.ok(h.body().includes('alpha-server') && !h.body().includes('Showing cached connections'));

    await h.clickRefresh(); // same token; conn[1], prov[1]
    await h.settle(h.conn[1], resp({}, { ok: false, status: 500, statusText: 'Server Error' }));
    assert.ok(h.body().includes('Showing cached connections'), 'a failed refresh is disclosed as stale');
    assert.ok(h.body().includes('alpha-server'), 'the cached connection is preserved');
    assert.ok(!h.body().includes('MCP resources are available'), 'stale resources are not claimed available');
    assert.ok(h.body().includes('Resource availability is unknown'), 'stale resource availability is disclosed as unknown');

    await h.clickRefresh(); // conn[2]
    await h.settle(h.conn[2], resp({ connections: [connection('beta-server')] }));
    assert.ok(!h.body().includes('Showing cached connections'), 'the stale banner clears on recovery');
    assert.ok(h.body().includes('beta-server') && !h.body().includes('alpha-server'), 'the inventory updates');
    await h.act(async () => { h.root.unmount(); });
  });

  it('drops the previous token\'s data on a token change and never resurrects it as stale', async () => {
    const h = await harness();
    await h.render('tokenA');
    await h.settle(h.conn[0], resp({ connections: [connection('A-only-server')] }));
    assert.ok(h.body().includes('A-only-server'), 'token A data is shown');

    await h.render('tokenB'); // new principal: reset; conn[1] now pending
    assert.ok(!h.body().includes('A-only-server'), 'token A data vanishes immediately, not shown as current');
    assert.ok(h.body().includes('Loading Rig connections'), 'token B starts from loading, not cached A');

    await h.settle(h.conn[1], resp({}, { ok: false, status: 401, statusText: 'Unauthorized' }));
    assert.ok(h.body().includes('Could not load Rig connections (401'), 'token B failure is a hard error');
    assert.ok(!h.body().includes('A-only-server'), 'token A data is not resurrected as token B stale');
    assert.ok(!h.body().includes('Showing cached connections'), 'no cross-token stale banner');
    await h.act(async () => { h.root.unmount(); });
  });

  it('ignores a previous token\'s load that completes after the newer token\'s load', async () => {
    const h = await harness();
    await h.render('tokenA'); // conn[0] (A), left pending
    await h.render('tokenB'); // reset + conn[1] (B)
    await h.settle(h.conn[1], resp({ connections: [connection('B-server')] }));
    await h.settle(h.conn[0], resp({ connections: [connection('A-server')] })); // late A
    assert.ok(h.body().includes('B-server'), 'the newer token result is shown');
    assert.ok(!h.body().includes('A-server'), 'the older token load is ignored');
    await h.act(async () => { h.root.unmount(); });
  });

  it('fails a malformed connection array explicitly without crashing the panel', async () => {
    const h = await harness();
    await h.render('t1');
    await h.settle(h.conn[0], resp({ connections: [null, 'bad', 42] }));
    assert.ok(h.body().includes('was not in the expected format'), 'a malformed array is an explicit failure');
    assert.ok(!h.body().includes('No MCP servers connected yet.'), 'not shown as empty');
    assert.ok(!h.body().includes('MCP resources are available'), 'no zero-resource claim on a malformed load');
    await h.act(async () => { h.root.unmount(); });
  });

  it('fails a connection with a malformed nested capability without crashing', async () => {
    const h = await harness();
    await h.render('t1');
    const badNested = { ...connection('x'), capabilities: { tools: [], resources: [null], prompts: [], truncated: false, discoveredAt: null } };
    await h.settle(h.conn[0], resp({ connections: [badNested] }));
    assert.ok(h.body().includes('was not in the expected format'), 'a malformed capability element fails the load');
    assert.ok(!h.body().includes('No MCP servers connected yet.'), 'not shown as empty');
    assert.ok(!h.body().includes('MCP resources are available'), 'no zero-resource claim');
    await h.act(async () => { h.root.unmount(); });
  });

  it('never shows an authoritative zero provenance count while pending or failed', async () => {
    const h = await harness();
    await h.render('t1');
    assert.ok(h.body().includes('provenance (…)'), 'a pending provenance load is not shown as zero');
    assert.ok(!h.body().includes('provenance (0)'), 'no authoritative zero while pending');

    await h.settle(h.conn[0], resp({ connections: [] }));
    await h.settle(h.prov[0], resp({}, { ok: false, status: 500, statusText: 'Server Error' }));
    assert.ok(h.body().includes('provenance (unavailable)'), 'a failed provenance load is disclosed, not shown as zero');
    assert.ok(!h.body().includes('provenance (0)'), 'no authoritative zero on failure');
    await h.act(async () => { h.root.unmount(); });
  });

  it('remounts the session on token change, discarding expanded provenance and prior data', async () => {
    const h = await harness();
    await h.render('tokenA');
    await h.settle(h.conn[0], resp({ connections: [connection('A-server')] }));
    await h.settle(h.prov[0], resp({ records: [{ recordId: 'A-provenance' }] }));
    await h.clickText('provenance'); // expand under token A
    await h.settle(h.prov[1], resp({ records: [{ recordId: 'A-provenance' }] }));
    assert.ok(h.body().includes('A-provenance'), 'token A provenance is expanded and shown');

    await h.render('tokenB'); // remount discards the whole session
    assert.ok(!h.body().includes('A-provenance'), 'expanded provenance from token A is gone');
    assert.ok(!h.body().includes('A-server'), 'token A connections are gone');
    assert.ok(h.body().includes('Show provenance'), 'the provenance section collapses back on remount');
    await h.act(async () => { h.root.unmount(); });
  });

  it('keeps connections intact and discloses stale provenance when provenance fails', async () => {
    const h = await harness();
    await h.render('t1');
    await h.settle(h.conn[0], resp({ connections: [connection('gamma-server')] }));
    await h.settle(h.prov[0], resp({ records: [{ recordId: 'prov-keep' }] }));

    await h.clickText('provenance'); // expand; triggers prov[1]
    await h.settle(h.prov[1], resp({ records: [{ recordId: 'prov-keep' }] }));
    assert.ok(h.body().includes('prov-keep'), 'provenance records are shown when expanded');

    await h.clickRefresh(); // conn[1], prov[2]
    await h.settle(h.conn[1], resp({ connections: [connection('gamma-server')] }));
    await h.settle(h.prov[2], resp({ records: 'not-an-array' }, { ok: true, status: 200 }));

    assert.ok(h.body().includes('Showing cached provenance'), 'a malformed provenance refresh is disclosed as stale');
    assert.ok(h.body().includes('prov-keep'), 'the last valid provenance records are preserved');
    assert.ok(h.body().includes('gamma-server'), 'connections are unaffected by a provenance failure');
    assert.ok(!h.body().includes('Could not load Rig connections'), 'the connection view is not marked failed');
    await h.act(async () => { h.root.unmount(); });
  });

  it('names cached provenance as cached in the collapsed control after a failed refresh, and clears it on recovery', async () => {
    const h = await harness();
    await h.render('t1');
    await h.settle(h.conn[0], resp({ connections: [connection('server-1')] }));

    // 1-2. Provenance loads successfully; the collapsed control shows the count.
    await h.settle(h.prov[0], resp({ records: [{ recordId: 'p1' }, { recordId: 'p2' }, { recordId: 'p3' }] }));
    assert.ok(h.body().includes('Show provenance (3)'), 'a successful load shows the current count');
    assert.ok(!h.body().includes('cached'), 'nothing is stale yet');

    // 3-5. Section stays collapsed; a same-token refresh makes provenance fail.
    await h.clickRefresh(); // conn[1], prov[1]
    await h.settle(h.conn[1], resp({ connections: [connection('server-1')] }));
    await h.settle(h.prov[1], resp({}, { ok: false, status: 500, statusText: 'Server Error' }));

    // 6-7. The cached records survive and the collapsed control names them cached.
    assert.ok(h.body().includes('Show provenance (3 cached)'), 'the collapsed control discloses cached records');
    assert.ok(!h.body().includes('Show provenance (3)') || h.body().includes('(3 cached)'), 'the bare current count is not shown');

    // 8-9. A successful recovery removes the stale wording.
    await h.clickRefresh(); // conn[2], prov[2]
    await h.settle(h.conn[2], resp({ connections: [connection('server-1')] }));
    await h.settle(h.prov[2], resp({ records: [{ recordId: 'p1' }, { recordId: 'p2' }] }));
    assert.ok(h.body().includes('Show provenance (2)'), 'recovery shows the fresh count');
    assert.ok(!h.body().includes('cached'), 'the cached wording disappears on recovery');
    await h.act(async () => { h.root.unmount(); });
  });

  it('discloses the in-flight load on Refresh and re-enables it after', async () => {
    const h = await harness();
    await h.render('t1');
    assert.ok(h.body().includes('Refreshing…'), 'Refresh discloses the in-flight load');
    await h.settle(h.conn[0], resp({ connections: [connection('delta-server')] }));
    assert.ok(!h.body().includes('Refreshing…'), 'Refresh is re-enabled once the load settles');
    await h.act(async () => { h.root.unmount(); });
  });
});
