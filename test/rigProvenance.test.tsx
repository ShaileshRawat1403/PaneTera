// test/rigProvenance.test.tsx
//
// Mounted tests for the Rig provenance presentation. They open the provenance
// section in a real RigPanel and assert the validated, progressively disclosed
// view: each record leads with its type, source, integrity, and trust; unknown
// types read as unknown; raw detail stays hidden until requested; malformed
// payloads fail closed; and an out-of-order load cannot publish over a newer one.

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

const resp = (body: unknown, over: { ok?: boolean; status?: number } = {}) => ({
  ok: over.ok ?? true, status: over.status ?? 200, statusText: '', json: async () => body, text: async () => JSON.stringify(body ?? {}),
});

const record = (over: Record<string, unknown> = {}) => ({
  recordId: 'rec-1', recordType: 'mcp-invocation', ownerId: 'local-operator',
  sourceIdentity: { kind: 'mcp-connection', id: 'conn-9' }, parentRecordIds: [],
  inputDigest: null, outputDigest: null, createdAt: '2026-01-01T00:00:00.000Z',
  sourceClass: 'local-user-installed', trustLevel: 'untrusted', correlation: { proposalId: 'pr-1' },
  integrity: 'verified', retentionClass: 'session', ...over,
});

/** Mount the panel and park every provenance GET for manual resolution. */
async function harness() {
  const win = installDom();
  const prov: Array<(v: unknown) => void> = [];
  const fetchImpl = (url: string, init?: { method?: string }) => {
    const method = init?.method ?? 'GET';
    if (url.endsWith('/api/rig/connections') && method === 'GET') return Promise.resolve(resp({ connections: [] }));
    if (url.includes('/api/rig/provenance')) return new Promise((r) => prov.push(r as (v: unknown) => void));
    return Promise.resolve(resp({ ok: true }));
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
  const body = () => win.document.body.textContent ?? '';
  const buttons = () => [...win.document.querySelectorAll('button')] as HTMLButtonElement[];
  const clickText = (text: string) => act(async () => {
    const b = buttons().find((x) => (x.textContent ?? '').includes(text));
    if (!b) throw new Error(`button not found: ${text}`);
    b.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  });
  const clickAria = (label: string) => act(async () => {
    const b = buttons().find((x) => x.getAttribute('aria-label') === label);
    if (!b) throw new Error(`button not found by aria-label: ${label}`);
    b.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  });
  const settleProv = (i: number, value: unknown) => act(async () => { prov[i](value); });
  return { win, root, act, body, buttons, clickText, clickAria, settleProv, prov };
}

// Load provenance and open the section. Mount triggers prov[0]; opening the
// section triggers prov[1]; both are resolved with the same payload.
async function openWith(payload: unknown) {
  const h = await harness();
  await h.settleProv(0, resp(payload));
  await h.clickText('provenance'); // opens the section, triggering a reload
  await h.settleProv(1, resp(payload));
  return h;
}

describe('the provenance section renders a validated, disclosed view', () => {
  it('leads each record with type, source, integrity, and trust', async () => {
    const h = await openWith({ records: [record()] });
    const text = h.body();
    assert.ok(text.includes('Tool invocation'), 'the record type is labelled');
    assert.ok(text.includes('mcp-connection') && text.includes('conn-9'), 'the source identity is shown');
    assert.ok(text.includes('Integrity verified'), 'integrity is shown verbatim');
    assert.ok(text.includes('Trust: Untrusted'), 'trust is shown independently');
    assert.ok(text.includes('Proposal: pr-1'), 'correlations are labelled');
    await h.act(async () => { h.root.unmount(); });
  });

  it('keeps the raw record hidden until explicitly requested', async () => {
    const h = await openWith({ records: [record()] });
    assert.ok(!h.body().includes('Raw provenance record'), 'raw detail is hidden by default');
    await h.clickText('Show raw record');
    assert.ok(h.body().includes('Raw provenance record'), 'raw detail appears on request');
    await h.act(async () => { h.root.unmount(); });
  });

  it('shows an unknown record type as unknown, never a familiar event', async () => {
    const h = await openWith({ records: [record({ recordType: 'mcp-future-thing' })] });
    const text = h.body();
    assert.ok(text.includes('mcp-future-thing') && text.includes('unknown record type'), 'the type reads as unknown');
    assert.ok(!text.includes('Tool invocation') && !text.includes('Resource read'), 'never mapped to a known event');
    await h.act(async () => { h.root.unmount(); });
  });

  it('shows the authoritative empty state distinctly', async () => {
    const h = await harness();
    await h.settleProv(0, resp({ records: [] }));
    await h.clickText('provenance');
    await h.settleProv(1, resp({ records: [] }));
    assert.ok(h.body().includes('No provenance records yet.'), 'a successful empty load is authoritative empty');
    await h.act(async () => { h.root.unmount(); });
  });
});

describe('the provenance load fails closed on malformed data', () => {
  it('reports an initial malformed payload as unavailable, rendering no records', async () => {
    const h = await harness();
    await h.settleProv(0, resp({ records: 'not-an-array' }));
    assert.ok(h.body().includes('provenance (unavailable)'), 'a malformed initial load is unavailable');
    await h.act(async () => { h.root.unmount(); });
  });

  it('fails the whole load when one element is malformed', async () => {
    const h = await harness();
    await h.settleProv(0, resp({ records: [record(), { recordId: 'bad' }] }));
    assert.ok(h.body().includes('provenance (unavailable)'), 'one malformed element makes the load unreadable');
    await h.clickText('provenance');
    await h.settleProv(1, resp({ records: [record(), { recordId: 'bad' }] }));
    assert.ok(!h.body().includes('Tool invocation'), 'no partial record is rendered');
    await h.act(async () => { h.root.unmount(); });
  });

  it('fails the load on a non-canonical timestamp', async () => {
    const h = await harness();
    await h.settleProv(0, resp({ records: [record({ createdAt: 'not-a-date' })] }));
    assert.ok(h.body().includes('provenance (unavailable)'), 'an invalid timestamp fails the load');
    await h.act(async () => { h.root.unmount(); });
  });

  it('fails the load on a normalized-impossible timestamp (Feb 30)', async () => {
    const h = await harness();
    await h.settleProv(0, resp({ records: [record({ createdAt: '2026-02-30T00:00:00.000Z' })] }));
    assert.ok(h.body().includes('provenance (unavailable)'), 'a rolled-over impossible date fails the load');
    await h.act(async () => { h.root.unmount(); });
  });

  it('fails the load on a blank record type', async () => {
    const h = await harness();
    await h.settleProv(0, resp({ records: [record({ recordType: '   ' })] }));
    assert.ok(h.body().includes('provenance (unavailable)'), 'a blank field fails the load');
    await h.act(async () => { h.root.unmount(); });
  });

  it('fails the load on duplicate record ids', async () => {
    const h = await harness();
    await h.settleProv(0, resp({ records: [record({ recordId: 'dup' }), record({ recordId: 'dup', recordType: 'mcp-prompt-read' })] }));
    assert.ok(h.body().includes('provenance (unavailable)'), 'duplicate record ids fail the load');
    await h.act(async () => { h.root.unmount(); });
  });

  it('never renders a secret-bearing extension field carried on a record', async () => {
    const secret = 'https://example.test/?token=SECRETVALUE';
    const h = await openWith({ records: [{ ...record(), extensionToken: secret }] });
    await h.clickText('Show raw record'); // reveal the raw disclosure
    assert.ok(!h.body().includes('SECRETVALUE'), 'the smuggled secret never renders, even in raw');
    assert.ok(h.body().includes('Tool invocation'), 'the canonical record still renders');
    await h.act(async () => { h.root.unmount(); });
  });
});

describe('provenance ordering and cache', () => {
  it('ignores an older provenance load that completes after a newer one', async () => {
    const h = await harness();          // prov[0] pending (mount)
    await h.clickText('provenance');    // prov[1] pending (open triggers reload)
    // Newer load resolves first, then the older completes late.
    await h.settleProv(1, resp({ records: [record({ recordId: 'newer', sourceIdentity: { kind: 'mcp-connection', id: 'newer-src' } })] }));
    await h.settleProv(0, resp({ records: [record({ recordId: 'older', sourceIdentity: { kind: 'mcp-connection', id: 'older-src' } })] }));
    assert.ok(h.body().includes('newer-src'), 'the newer provenance is shown');
    assert.ok(!h.body().includes('older-src'), 'the older, late provenance is ignored');
    await h.act(async () => { h.root.unmount(); });
  });

  it('preserves cached records and discloses staleness on a failed refresh', async () => {
    const h = await openWith({ records: [record({ sourceIdentity: { kind: 'mcp-connection', id: 'keep-src' } })] });
    assert.ok(h.body().includes('keep-src'), 'records are shown');
    await h.clickAria('Refresh Rig connections'); // triggers a provenance reload too
    // resolve the reload as a failure
    await h.settleProv(2, resp({}, { ok: false, status: 500 }));
    assert.ok(h.body().includes('Showing cached provenance'), 'staleness is disclosed');
    assert.ok(h.body().includes('keep-src'), 'the cached records are preserved');
    await h.act(async () => { h.root.unmount(); });
  });
});

describe('the provenance view emits no React or accessibility warnings', () => {
  it('renders records and raw disclosure cleanly', async () => {
    const warnings: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
    try {
      const h = await openWith({ records: [record({ recordId: 'a' }), record({ recordId: 'b', recordType: 'mcp-prompt-read' })] });
      await h.clickText('Show raw record');
      await h.act(async () => { h.root.unmount(); });
    } finally {
      console.error = original;
    }
    assert.deepStrictEqual(warnings.filter((w) => /Warning:|unique "key"/i.test(w)), [], `warnings:\n${warnings.join('\n')}`);
  });
});
