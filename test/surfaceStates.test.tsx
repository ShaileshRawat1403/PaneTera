// test/surfaceStates.test.tsx
//
// This increment converged the governance surfaces on one loading/error/stale/empty
// grammar without a shared component, because they do not share one state machine.
// These mounted transition tests hold each surface to the meanings it can actually
// prove, and guard the two failure modes the reviewer named: a hard failure must
// never render as an empty surface, and a stale (cached) view must never look
// current.
//
//   Audit    — proves all five states (loaded flag + cached rows).
//   Headroom — proves all five once it tracks a loaded flag (added this increment).
//   Activity — a local stream: proves streaming/empty/ready only; never error/stale.
//
// MUI is imported dynamically, after installDom(), so no ref-forwarding warnings
// appear; every test requires zero React warnings.

process.env.NODE_ENV = 'test';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import type { FeedItem } from '../shared/uiComponent';

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
    const value = (win as unknown as Record<string, unknown>)[name]; if (value) globals[name] = value;
  }
  (win.Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
  globals.requestAnimationFrame = (cb: (t: number) => void) => { cb(Date.now()); return 0; };
  globals.cancelAnimationFrame = () => {};
  return win;
}

async function withMount(fn: (m: {
  win: Window & typeof globalThis;
  doc: Document;
  React: typeof import('react');
  act: typeof import('react').act;
  render: (node: unknown) => Promise<void>;
  text: () => string;
}) => Promise<void>) {
  const win = installDom();
  const warns: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { warns.push(args.map(String).join(' ')); };
  try {
    const React = (await import('react')).default;
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');
    const container = win.document.createElement('div');
    win.document.body.appendChild(container);
    const root = createRoot(container);
    const render = (node: unknown) => act(async () => { root.render(node as Parameters<typeof root.render>[0]); });
    const text = () => win.document.body.textContent ?? '';
    try {
      await fn({ win, doc: win.document, React: React as unknown as typeof import('react'), act, render, text });
    } finally {
      await act(async () => { root.unmount(); });
    }
  } finally {
    console.error = original;
  }
  assert.deepStrictEqual(warns.filter((w) => /Warning:/.test(w)), [], `unexpected warnings:\n${warns.join('\n')}`);
}

// ---------- Audit ----------

const auditRow = (event: string) => ({ recordId: `audit-${event}`, schemaVersion: 2, timestamp: '2026-07-23T10:00:00.000Z', event, actor: { kind: 'system', id: null, label: 's' }, outcome: 'success', policyDecision: 'allowed', correlation: {}, details: {} });
const okLogs = (rows: unknown[]) => ({ ok: true, status: 200, json: async () => ({ logs: rows }) });
const failLogs = () => ({ ok: false, status: 500, statusText: 'Server Error', json: async () => ({}) });

describe('the Audit surface keeps its five load states distinct', () => {
  it('a hard failure with no cache shows an error with Retry, never an empty trail', () => withMount(async ({ doc, React, act, render, text }) => {
    (globalThis as Record<string, unknown>).fetch = async () => failLogs();
    const { AuditLogsView } = await import('../src/components/workbench/AuditLogsView');
    await render(React.createElement(AuditLogsView, { token: 't', open: true, onClose: () => {} }));
    await act(async () => { await Promise.resolve(); });
    const dialog = doc.querySelector('[role="dialog"]') as HTMLElement;
    assert.ok(dialog.querySelector('.MuiAlert-standardError'), 'a hard error Alert is shown');
    assert.ok(dialog.querySelector('button')!, 'a Retry control exists');
    assert.match(text(), /Retry/, 'the error offers Retry');
    assert.doesNotMatch(text(), /No audit records yet\.|Loading the audit trail/, 'a hard failure is not rendered as empty or loading');
  }));

  it('a failed refresh over cached rows is disclosed as stale, not shown as current', () => withMount(async ({ doc, React, act, render, text }) => {
    let mode: 'ok' | 'fail' = 'ok';
    (globalThis as Record<string, unknown>).fetch = async () => (mode === 'ok' ? okLogs([auditRow('login')]) : failLogs());
    const { AuditLogsView } = await import('../src/components/workbench/AuditLogsView');
    await render(React.createElement(AuditLogsView, { token: 't', open: true, onClose: () => {} }));
    await act(async () => { await Promise.resolve(); });
    assert.match(text(), /login/, 'the loaded row is shown');
    // Refresh, now failing.
    mode = 'fail';
    const refresh = doc.querySelector('button[aria-label="Refresh audit trail"]') as HTMLButtonElement;
    await act(async () => { refresh.dispatchEvent(new (doc.defaultView as Window & typeof globalThis).MouseEvent('click', { bubbles: true })); });
    await act(async () => { await Promise.resolve(); });
    assert.match(text(), /Showing cached records\./, 'the failed refresh is disclosed as stale');
    assert.match(text(), /login/, 'the cached row is still shown, not blanked');
    assert.ok((doc.querySelector('[role="dialog"]') as HTMLElement).querySelector('.MuiAlert-standardWarning'), 'stale uses a warning Alert, not a current styling');
  }));

  it('a successful empty load is the one authoritative empty', () => withMount(async ({ React, act, render, text }) => {
    (globalThis as Record<string, unknown>).fetch = async () => okLogs([]);
    const { AuditLogsView } = await import('../src/components/workbench/AuditLogsView');
    await render(React.createElement(AuditLogsView, { token: 't', open: true, onClose: () => {} }));
    await act(async () => { await Promise.resolve(); });
    assert.match(text(), /No audit records yet\./, 'an authoritative empty is shown');
    assert.doesNotMatch(text(), /Loading the audit trail|Showing cached records/, 'empty is not confused with loading or stale');
  }));
});

// ---------- Headroom ----------

const TS = '2026-07-23T10:00:00.000Z';
const capsule = { capsuleId: 'c1', title: 'Cap One', projectId: null, objective: null, decisions: [], assumptions: [], unresolvedQuestions: [], changedUnderstanding: [], context: [], envelopeIds: [], updatedAt: TS };
function headroomFetch(mode: 'empty' | 'one' | 'fail') {
  return async (url: string) => {
    if (mode === 'fail') return { ok: false, status: 500, text: async () => '{}' };
    const u = String(url);
    let payload: Record<string, unknown> = {};
    if (u.includes('/envelopes')) payload = { envelopes: [] };
    else if (u.includes('/capsules')) payload = { capsules: mode === 'one' ? [capsule] : [] };
    else if (u.includes('/scopes')) payload = { scopes: [] };
    return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
  };
}
const headroomProps = (over: Record<string, unknown> = {}) => ({ token: 't', sessionId: 's1', projectId: null, objective: '', onObjectiveChange: () => {}, onResume: () => {}, onClose: () => {}, ...over });
const flush = async (act: typeof import('react').act) => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

function clickRefresh(doc: Document) {
  const btn = doc.querySelector('button[aria-label="Refresh Headroom"]') as HTMLButtonElement;
  const view = doc.defaultView as Window & typeof globalThis;
  btn.dispatchEvent(new view.MouseEvent('click', { bubbles: true }));
}

describe('the Headroom surface keeps its load states distinct', () => {
  it('a first load still in flight shows a quiet status line, not an authoritative empty', () => withMount(async ({ React, render, text }) => {
    (globalThis as Record<string, unknown>).fetch = () => new Promise(() => {}); // never resolves
    const { HeadroomPanel } = await import('../src/components/headroom/HeadroomPanel');
    await render(React.createElement(HeadroomPanel, headroomProps()));
    assert.match(text(), /Loading Headroom…/, 'the loading status line is shown');
    assert.doesNotMatch(text(), /No context has been pinned yet\.|No temporary local scopes are active\./, 'loading is never rendered as an authoritative empty');
  }));

  it('a hard failure with no prior load shows an error, never an empty Headroom', () => withMount(async ({ doc, React, act, render, text }) => {
    (globalThis as Record<string, unknown>).fetch = headroomFetch('fail') as unknown as typeof fetch;
    const { HeadroomPanel } = await import('../src/components/headroom/HeadroomPanel');
    await render(React.createElement(HeadroomPanel, headroomProps()));
    await flush(act);
    assert.ok(doc.querySelector('.MuiAlert-standardError'), 'a hard error Alert is shown');
    assert.doesNotMatch(text(), /No context has been pinned yet\.|No temporary local scopes are active\./, 'a hard failure is not rendered as empty');
  }));

  it('a successful empty load is an authoritative empty', () => withMount(async ({ React, act, render, text }) => {
    (globalThis as Record<string, unknown>).fetch = headroomFetch('empty') as unknown as typeof fetch;
    const { HeadroomPanel } = await import('../src/components/headroom/HeadroomPanel');
    await render(React.createElement(HeadroomPanel, headroomProps()));
    await flush(act);
    assert.match(text(), /No context has been pinned yet\./, 'the authoritative empty is shown');
    assert.doesNotMatch(text(), /Loading Headroom…/, 'empty is not confused with loading');
  }));

  it('a 2xx with a malformed top-level shape is a failure, never an authoritative empty', () => withMount(async ({ doc, React, act, render, text }) => {
    // A 200 whose body carries no arrays must be unreadable, not coerced to empty.
    (globalThis as Record<string, unknown>).fetch = (async () => ({ ok: true, status: 200, text: async () => '{}' })) as unknown as typeof fetch;
    const { HeadroomPanel } = await import('../src/components/headroom/HeadroomPanel');
    await render(React.createElement(HeadroomPanel, headroomProps()));
    await flush(act);
    assert.ok(doc.querySelector('.MuiAlert-standardError'), 'a malformed shape is reported as a hard error');
    assert.doesNotMatch(text(), /No context has been pinned yet\.|No temporary local scopes are active\./, 'a malformed shape is never an authoritative empty');
  }));

  // Exact nested-structure and enum regressions: each of these once passed the
  // top-level array check but is malformed inside, and the renderer would crash or
  // misrepresent it. Each must be an unreadable hard failure, never authoritative.
  const validCapsuleBase = { capsuleId: 'c1', title: 'X', projectId: null, objective: null, decisions: [], assumptions: [], unresolvedQuestions: [], changedUnderstanding: [], context: [], envelopeIds: [], updatedAt: TS };
  const validScopeBase = { id: 's1', path: '/p', kind: 'file', recursive: false, freshness: 'current', expiresAt: TS };
  const malformedCases: Array<{ name: string; capsules: unknown[]; scopes: unknown[]; envelopes: unknown[] }> = [
    { name: 'a materialized entry that is null', capsules: [], scopes: [], envelopes: [{ envelopeId: 'e1', createdAt: TS, materialized: [null] }] },
    { name: 'a materialized unit that is not "bytes"', capsules: [], scopes: [], envelopes: [{ envelopeId: 'e1', createdAt: TS, materialized: [{ measurement: { unit: 'tokens', value: 5 } }] }] },
    { name: 'a materialized measurement missing its value', capsules: [], scopes: [], envelopes: [{ envelopeId: 'e1', createdAt: TS, materialized: [{ measurement: { unit: 'bytes' } }] }] },
    { name: 'a materialized value that is not a finite number', capsules: [], scopes: [], envelopes: [{ envelopeId: 'e1', createdAt: TS, materialized: [{ measurement: { unit: 'bytes', value: 'x' } }] }] },
    { name: 'a capsule envelopeId that is not a string', scopes: [], envelopes: [], capsules: [{ ...validCapsuleBase, envelopeIds: [123] }] },
    { name: 'a capsule projectId that is neither string nor null', scopes: [], envelopes: [], capsules: [{ ...validCapsuleBase, projectId: 5 }] },
    { name: 'a capsule updatedAt that is not a valid timestamp', scopes: [], envelopes: [], capsules: [{ ...validCapsuleBase, updatedAt: 'not-a-date' }] },
    { name: 'a scope kind outside the known enum', capsules: [], envelopes: [], scopes: [{ ...validScopeBase, kind: 'bogus' }] },
    { name: 'a scope freshness outside the known enum', capsules: [], envelopes: [], scopes: [{ ...validScopeBase, freshness: 'whenever' }] },
    { name: 'a scope expiresAt that is not a valid timestamp', capsules: [], envelopes: [], scopes: [{ ...validScopeBase, expiresAt: 'not-a-date' }] },
    { name: 'a scope expiresAt with an impossible calendar date', capsules: [], envelopes: [], scopes: [{ ...validScopeBase, expiresAt: '2026-02-30T00:00:00.000Z' }] },
    { name: 'a scope expiresAt with a timezone offset rather than Z', capsules: [], envelopes: [], scopes: [{ ...validScopeBase, expiresAt: '2026-07-23T10:00:00.000+05:00' }] },
    { name: 'a scope expiresAt with a non-millisecond fraction', capsules: [], envelopes: [], scopes: [{ ...validScopeBase, expiresAt: '2026-07-23T10:00:00.5Z' }] },
  ];
  for (const c of malformedCases) {
    it(`rejects ${c.name} as a hard failure, never an authoritative empty`, () => withMount(async ({ doc, React, act, render, text }) => {
      (globalThis as Record<string, unknown>).fetch = (async (url: string) => {
        const u = String(url);
        const payload = u.includes('/envelopes') ? { envelopes: c.envelopes } : u.includes('/capsules') ? { capsules: c.capsules } : { scopes: c.scopes };
        return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
      }) as unknown as typeof fetch;
      const { HeadroomPanel } = await import('../src/components/headroom/HeadroomPanel');
      await render(React.createElement(HeadroomPanel, headroomProps()));
      await flush(act);
      assert.ok(doc.querySelector('.MuiAlert-standardError'), 'the malformed element is reported as a hard error');
      assert.doesNotMatch(text(), /No context has been pinned yet\./, 'the malformed element is never an authoritative empty');
    }));
  }

  it('a same-token, same-session Refresh that fails is stale and keeps the cached content', () => withMount(async ({ doc, React, act, render, text }) => {
    // The legitimate stale path: the explicit Refresh action, same token and session.
    let mode: 'one' | 'fail' = 'one';
    (globalThis as Record<string, unknown>).fetch = ((url: string) => headroomFetch(mode)(url)) as unknown as typeof fetch;
    const { HeadroomPanel } = await import('../src/components/headroom/HeadroomPanel');
    await render(React.createElement(HeadroomPanel, headroomProps()));
    await flush(act);
    assert.match(text(), /Cap One/, 'the loaded capsule is shown');
    mode = 'fail';
    await act(async () => { clickRefresh(doc); });
    await flush(act);
    assert.match(text(), /Showing cached context\./, 'the failed Refresh is disclosed as stale');
    assert.match(text(), /Cap One/, 'cached content is kept, not blanked');
    assert.ok(doc.querySelector('.MuiAlert-standardWarning'), 'stale uses a warning Alert');
  }));

  it('the Refresh control gates against overlapping loads while a load is pending', () => withMount(async ({ doc, React, act, render, text }) => {
    let phase: 'ok' | 'park' = 'ok';
    (globalThis as Record<string, unknown>).fetch = ((url: string) => (phase === 'ok' ? headroomFetch('one')(url) : new Promise(() => {}))) as unknown as typeof fetch;
    const { HeadroomPanel } = await import('../src/components/headroom/HeadroomPanel');
    await render(React.createElement(HeadroomPanel, headroomProps()));
    await flush(act);
    assert.match(text(), /Cap One/, 'the loaded capsule is shown');
    phase = 'park';
    await act(async () => { clickRefresh(doc); });
    const btn = doc.querySelector('button[aria-label="Refresh Headroom"]') as HTMLButtonElement;
    assert.strictEqual(btn.disabled, true, 'Refresh is disabled while a load is pending');
    assert.match(btn.textContent ?? '', /Refreshing…/, 'the pending state is disclosed on the control');
  }));

  it('the action-error Retry is also gated while a load is pending', () => withMount(async ({ doc, React, act, render }) => {
    let phase: 'ok' | 'park' = 'ok';
    (globalThis as Record<string, unknown>).fetch = ((url: string, init?: { method?: string }) => {
      if (init?.method === 'POST') return Promise.reject(new Error('save failed'));
      return phase === 'ok' ? headroomFetch('empty')(url) : new Promise(() => {});
    }) as unknown as typeof fetch;
    const { HeadroomPanel } = await import('../src/components/headroom/HeadroomPanel');
    await render(React.createElement(HeadroomPanel, headroomProps({ objective: 'obj' })));
    await flush(act);
    // Raise the action-error notice banner via a failing Save.
    const save = [...doc.querySelectorAll('button')].find((b) => /Save capsule/.test(b.textContent ?? '')) as HTMLButtonElement;
    await act(async () => { save.dispatchEvent(new (doc.defaultView as Window & typeof globalThis).MouseEvent('click', { bubbles: true })); });
    await flush(act);
    const noticeAlert = doc.querySelector('.MuiAlert-standardError') as HTMLElement;
    assert.ok(noticeAlert && /save failed/.test(noticeAlert.textContent ?? ''), 'the action error is shown');
    // With a load now pending, the action-error Retry must not start another load.
    phase = 'park';
    await act(async () => { clickRefresh(doc); });
    const retry = (doc.querySelector('.MuiAlert-standardError') as HTMLElement).querySelector('button') as HTMLButtonElement;
    assert.strictEqual(retry.disabled, true, 'the action-error Retry is disabled while a load is pending');
  }));

  // Same-boundary load ordering (an older reload cannot overwrite a newer one) is
  // proven directly against the extracted coordinator in test/loadGeneration.test.ts,
  // because changing the session id here would exercise the App remount, not ordering.

  it('a token+session keyed remount starts a fresh boundary, never inheriting cached data', () => withMount(async ({ doc, React, act, render, text }) => {
    let mode: 'one' | 'fail' = 'one';
    (globalThis as Record<string, unknown>).fetch = ((url: string) => headroomFetch(mode)(url)) as unknown as typeof fetch;
    const { HeadroomPanel } = await import('../src/components/headroom/HeadroomPanel');
    await render(React.createElement(HeadroomPanel, { key: 't:s1', ...headroomProps({ token: 't', sessionId: 's1' }) }));
    await flush(act);
    assert.match(text(), /Cap One/, 'the first mount shows its capsule');
    // A new key (new session or principal) remounts; the failing load has no cache.
    mode = 'fail';
    await render(React.createElement(HeadroomPanel, { key: 't:s2', ...headroomProps({ token: 't', sessionId: 's2' }) }));
    await flush(act);
    assert.ok(doc.querySelector('.MuiAlert-standardError'), 'the remount sees a hard error, not stale');
    assert.doesNotMatch(text(), /Showing cached context\./, 'no cross-boundary stale disclosure');
    assert.doesNotMatch(text(), /Cap One/, 'the prior boundary\'s data is not inherited');
  }));

  it('App keys the Headroom panel on token and session so a change remounts it', () => {
    const src = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
    assert.match(src, /key=\{`\$\{token\}:\$\{headroomSessionId\}`\}/, 'HeadroomPanel is keyed on token+session in App');
  });
});

// ---------- Activity ----------

const feedItem: FeedItem = { id: 'f1', type: 'TerminalLogs', data: { logs: [] }, timestamp: '2026-07-23T10:00:00.000Z' };
const activityProps = (over: Record<string, unknown>) => ({ previewFeed: [], onClose: () => {}, onAction: () => {}, onRemoveItem: () => {}, onClearFeed: () => {}, onApproveAction: () => {}, token: 't', loading: false, ...over });

describe('the Activity surface proves only streaming, empty, and ready', () => {
  it('a streaming state shows a quiet status line, not the empty text', () => withMount(async ({ doc, React, render, text }) => {
    const { PreviewPanel } = await import('../src/components/PreviewPanel');
    await render(React.createElement(PreviewPanel, activityProps({ loading: true, previewFeed: [] })));
    const status = [...doc.querySelectorAll('[role="status"]')].map((n) => n.textContent).join(' ');
    assert.match(status, /Waiting for the latest activity/, 'a polite status line announces streaming');
    assert.doesNotMatch(text(), /No activity yet\./, 'streaming is never rendered as the empty state');
  }));

  it('an authoritative empty shows the quiet empty line when nothing streams', () => withMount(async ({ React, render, text }) => {
    const { PreviewPanel } = await import('../src/components/PreviewPanel');
    await render(React.createElement(PreviewPanel, activityProps({ loading: false, previewFeed: [] })));
    assert.match(text(), /No activity yet\./, 'the authoritative empty is shown');
    assert.doesNotMatch(text(), /Waiting for the latest activity/, 'empty is not confused with streaming');
  }));

  it('ready content is shown and no empty or streaming line appears', () => withMount(async ({ React, render, text }) => {
    const { PreviewPanel } = await import('../src/components/PreviewPanel');
    await render(React.createElement(PreviewPanel, activityProps({ loading: false, previewFeed: [feedItem] })));
    assert.doesNotMatch(text(), /No activity yet\.|Waiting for the latest activity/, 'ready content is neither empty nor streaming');
  }));
});
