// test/auditLogsPanel.test.tsx
//
// Component-level tests for the Audit panel's load lifecycle in a real DOM. They
// cover the two hazards the reviewer named: a failed refresh must degrade to a
// visible stale state rather than a blank or a false-current one, and overlapping
// loads must never let an older response overwrite a newer one.
//
// Loads are driven by changing the token prop, which re-runs the panel's fetch
// effect, and fetch resolution is controlled by hand so the ordering is exact.
// No DOM clicks are used, so the test does not depend on synthetic-event routing
// through the dialog portal.

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
  // Expose the DOM constructors react-dom and MUI reference off the global.
  for (const name of [
    'HTMLElement', 'Element', 'Node', 'Text', 'DocumentFragment', 'Event', 'CustomEvent',
    'MouseEvent', 'KeyboardEvent', 'MutationObserver', 'DOMParser', 'NodeList',
  ]) {
    const value = (win as unknown as Record<string, unknown>)[name];
    if (value) globals[name] = value;
  }
  globals.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0);
  globals.cancelAnimationFrame = (id: number) => clearTimeout(id);
  return win;
}

/** A fetch whose every call parks until the test resolves it, in a chosen order. */
function controllableFetch() {
  const pending: Array<(value: unknown) => void> = [];
  const fetchImpl = () => new Promise((resolve) => { pending.push(resolve as (v: unknown) => void); });
  return { fetchImpl, pending };
}

const success = (rows: unknown[]) => ({ ok: true, status: 200, json: async () => ({ logs: rows }) });
const failure = () => ({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({}) });

function row(event: string) {
  return { recordId: `audit-${event}`, schemaVersion: 2, timestamp: '2026-07-23T10:00:00.000Z', event, actor: { kind: 'system', id: null, label: 's' }, outcome: 'success', policyDecision: 'allowed', correlation: {}, details: {} };
}

describe('the audit panel load lifecycle is honest and ordered', () => {
  it('recovers a failed refresh through a stale state, then a clean success', async () => {
    const win = installDom();
    const { fetchImpl, pending } = controllableFetch();
    (globalThis as Record<string, unknown>).fetch = fetchImpl;

    const React = (await import('react')).default;
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');
    const { AuditLogsView } = await import('../src/components/workbench/AuditLogsView');

    const container = win.document.createElement('div');
    win.document.body.appendChild(container);
    const root = createRoot(container);
    const render = (token: string) => act(async () => { root.render(React.createElement(AuditLogsView, { token, open: true, onClose: () => {} })); });
    const body = () => win.document.body.textContent ?? '';

    // First load (token t1) succeeds with one row.
    await render('t1');
    await act(async () => { pending[0](success([row('audit.first')])); });
    assert.ok(body().includes('audit.first'), 'the first record is shown');
    assert.ok(!body().includes('Showing cached records'), 'no stale banner on a fresh success');

    // A refresh (token t2) fails; the earlier row stays, disclosed as stale.
    await render('t2');
    await act(async () => { pending[1](failure()); });
    assert.ok(body().includes('Showing cached records'), 'a failed refresh is disclosed as stale');
    assert.ok(body().includes('audit.first'), 'cached rows remain visible');

    // A second refresh (token t3) succeeds; the banner clears and rows update.
    await render('t3');
    await act(async () => { pending[2](success([row('audit.second')])); });
    assert.ok(!body().includes('Showing cached records'), 'the stale banner clears on recovery');
    assert.ok(body().includes('audit.second'), 'the recovered rows are shown');
    assert.ok(!body().includes('audit.first'), 'stale rows are replaced');

    await act(async () => { root.unmount(); });
  });

  it('ignores an older load that completes after a newer one', async () => {
    const win = installDom();
    const { fetchImpl, pending } = controllableFetch();
    (globalThis as Record<string, unknown>).fetch = fetchImpl;

    const React = (await import('react')).default;
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');
    const { AuditLogsView } = await import('../src/components/workbench/AuditLogsView');

    const container = win.document.createElement('div');
    win.document.body.appendChild(container);
    const root = createRoot(container);
    const render = (token: string) => act(async () => { root.render(React.createElement(AuditLogsView, { token, open: true, onClose: () => {} })); });
    const body = () => win.document.body.textContent ?? '';

    // Two overlapping loads: t1 then t2, both still in flight.
    await render('t1');
    await render('t2');
    assert.strictEqual(pending.length, 2, 'both loads are in flight');

    // The newer load (t2) completes first, then the older (t1) completes late.
    await act(async () => { pending[1](success([row('audit.newer')])); });
    await act(async () => { pending[0](success([row('audit.older')])); });

    assert.ok(body().includes('audit.newer'), 'the newer result is shown');
    assert.ok(!body().includes('audit.older'), 'the older, late result is ignored');

    await act(async () => { root.unmount(); });
  });
});
