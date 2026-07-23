// test/rigConnectionCard.test.tsx
//
// Mounted render and handler tests for the Rig connection card. They drive real
// RigPanel cards from deterministic fixtures (no real connection is created) and
// assert what a person sees and can do per state: the status words, the
// attention icon for states that need it, the inventory-freshness label, the
// supported actions, and that those actions still call the existing endpoints.

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

const capability = (i: number) => ({
  capabilityId: `cap-${i}`, kind: 'tool', name: `n${i}`, label: `n${i}`,
  description: { source: 'schema-derived', text: 'does a thing' },
  inputSchema: null, rawDeclaration: {}, permission: 'proposable', enabled: false,
  structuralDigest: 'd', presentationDigest: 'd',
});

function fixture(
  state: string,
  health: string,
  opts: { caps?: number; discoveredAt?: string | null; truncated?: boolean } = {},
) {
  return {
    connectionId: `conn-${state}`, displayName: `Server ${state}`, sourceClass: 'local-user-installed',
    transport: { kind: 'stdio', executablePath: '/x', argv: [], cwd: '/', isolationMode: 'none' },
    state, health: { state: health, lastSuccessfulContact: null },
    capabilities: {
      tools: Array.from({ length: opts.caps ?? 0 }, (_, i) => capability(i)),
      resources: [], prompts: [], truncated: opts.truncated ?? false, discoveredAt: opts.discoveredAt ?? null,
    },
    connectionApprovalId: null,
  };
}

async function mountWith(connections: unknown[]) {
  const win = installDom();
  const calls: Array<{ url: string; method: string }> = [];
  // Connection GETs resolve immediately with the fixtures, so a post-action
  // reload settles and `busy` clears between clicks. Action POSTs and DELETE
  // resolve ok and are recorded for handler assertions.
  const fetchImpl = (url: string, init?: { method?: string }) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method });
    if (url.includes('/api/rig/connections') && method === 'GET') return Promise.resolve(resp({ connections }));
    if (url.includes('/api/rig/provenance')) return Promise.resolve(resp({ records: [] }));
    return Promise.resolve(resp({ ok: true, review: { reviewDigest: 'd' } }));
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
  // Let the initial load settle so the card is rendered.
  await act(async () => { await Promise.resolve(); });
  const body = () => win.document.body.textContent ?? '';
  const html = () => win.document.body.innerHTML;
  // Count buttons whose trimmed label matches exactly. The panel's own top-bar
  // "Refresh" collides with a card "Refresh" by substring, so exact matching and
  // counting is how the card action is distinguished from the drawer control.
  const exactButtons = (text: string) =>
    [...win.document.querySelectorAll('button')].filter((b) => (b.textContent ?? '').trim() === text);
  // Click the LAST button matching the text: card actions render after the
  // top-bar controls, so the last match is the card's action.
  const clickButton = (text: string) => act(async () => {
    const matches = [...win.document.querySelectorAll('button')].filter((b) => (b.textContent ?? '').includes(text));
    const btn = matches[matches.length - 1];
    if (!btn) throw new Error(`button not found: ${text}`);
    btn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  });
  return { win, root, act, body, html, calls, exactButtons, clickButton };
}

describe('the connection card states what a connection is, its state, and attention', () => {
  it('shows approval-required with attention, a review action, and no refresh/stop', async () => {
    const h = await mountWith([fixture('approval-required', 'not-measured', { caps: 0 })]);
    assert.ok(h.body().includes('Approval required'), 'status words are shown');
    assert.ok(h.html().includes('WarningAmberIcon'), 'attention is signalled beyond colour');
    assert.ok(h.body().includes('Review and connect'), 'the supported recovery action is offered');
    assert.strictEqual(h.exactButtons('Stop').length, 0, 'no stop action');
    assert.strictEqual(h.exactButtons('Refresh').length, 1, 'only the drawer refresh, no card refresh');
    assert.ok(h.body().includes('No capabilities · not discovered'), 'inventory is disclosed as never discovered');
    await h.act(async () => { h.root.unmount(); });
  });

  it('shows a cleanly healthy connected card: no attention icon, no health qualifier, discovered inventory', async () => {
    const h = await mountWith([fixture('connected', 'current', { caps: 2, discoveredAt: '2026-01-01T00:00:00Z' })]);
    assert.ok(h.body().includes('Connected'), 'connected status');
    assert.ok(!h.html().includes('WarningAmberIcon'), 'no attention icon when cleanly healthy');
    assert.ok(!h.body().includes('Health'), 'no health qualifier when current');
    assert.ok(h.body().includes('2 discovered'), 'inventory is factual (discovered), not "live"');
    assert.ok(!h.body().includes('live') && !h.body().includes('authoritative'), 'no trusted-truth wording');
    assert.strictEqual(h.exactButtons('Stop').length, 1, 'stop offered when connected');
    assert.strictEqual(h.exactButtons('Refresh').length, 2, 'card refresh in addition to the drawer refresh');
    await h.act(async () => { h.root.unmount(); });
  });

  it('renders current health with no discovery timestamp as not discovered, never live', async () => {
    const h = await mountWith([fixture('connected', 'current', { caps: 0, discoveredAt: null })]);
    assert.ok(h.body().includes('No capabilities · not discovered'), 'health current does not imply a discovered inventory');
    assert.ok(!h.body().includes('live'), 'no false live claim from healthy transport');
    await h.act(async () => { h.root.unmount(); });
  });

  it('renders a truncated snapshot without an exact complete count, including the Inspect label', async () => {
    const h = await mountWith([fixture('connected', 'current', { caps: 3, discoveredAt: '2026-01-01T00:00:00Z', truncated: true })]);
    assert.ok(h.body().includes('3 shown · inventory truncated'), 'truncation is disclosed');
    assert.ok(!h.body().includes('3 discovered'), 'never presented as a complete discovered count');
    // Every displayed count keeps the truncation qualifier, including Inspect.
    assert.strictEqual(h.exactButtons('Inspect (3 shown)').length, 1, 'the Inspect count is qualified as shown');
    assert.strictEqual(h.exactButtons('Inspect (3)').length, 0, 'never a bare complete Inspect count');
    await h.act(async () => { h.root.unmount(); });
  });

  it('shows degraded health as attention, qualified in words', async () => {
    const h = await mountWith([fixture('connected', 'degraded', { caps: 2, discoveredAt: '2026-01-01T00:00:00Z' })]);
    assert.ok(h.body().includes('Health degraded'), 'health is qualified in words');
    assert.ok(h.html().includes('WarningAmberIcon'), 'degraded connected still flags attention');
    await h.act(async () => { h.root.unmount(); });
  });

  it('shows not-measured health as qualified without an alarm', async () => {
    const h = await mountWith([fixture('connected', 'not-measured', { caps: 2, discoveredAt: '2026-01-01T00:00:00Z' })]);
    assert.ok(h.body().includes('Health not measured'), 'health not measured is stated');
    assert.ok(!h.html().includes('WarningAmberIcon'), 'not-measured is not an alarm');
    await h.act(async () => { h.root.unmount(); });
  });

  it('distinguishes stopped (inactive) from unreachable (failure), showing last-discovered inventory', async () => {
    const stopped = await mountWith([fixture('stopped', 'not-measured', { caps: 1, discoveredAt: '2026-01-01T00:00:00Z' })]);
    assert.ok(stopped.body().includes('Stopped'), 'stopped status');
    assert.ok(!stopped.html().includes('WarningAmberIcon'), 'inactive is quiet, not an alarm');
    assert.ok(stopped.body().includes('Review and reconnect'), 'reconnect is offered');
    assert.ok(stopped.body().includes('1 last discovered'), 'a disconnected prior snapshot is last-discovered');
    await stopped.act(async () => { stopped.root.unmount(); });

    const unreachable = await mountWith([fixture('unreachable', 'not-measured', { caps: 1, discoveredAt: '2026-01-01T00:00:00Z' })]);
    assert.ok(unreachable.body().includes('Unreachable'), 'unreachable status');
    assert.ok(unreachable.html().includes('WarningAmberIcon'), 'failure flags attention');
    await unreachable.act(async () => { unreachable.root.unmount(); });
  });

  it('offers no invented recovery for auth-required', async () => {
    const h = await mountWith([fixture('auth-required', 'not-measured', { caps: 0 })]);
    assert.ok(h.body().includes('Authentication required'), 'the state is named honestly');
    assert.ok(!h.body().includes('Review and'), 'no review/connect that the backend would reject');
    assert.strictEqual(h.exactButtons('Refresh').length, 1, 'no card refresh, only the drawer control');
    assert.strictEqual(h.exactButtons('Stop').length, 0, 'no stop');
    assert.ok(h.body().includes('Inspect') && h.body().includes('Remove'), 'only inspect and remove remain');
    await h.act(async () => { h.root.unmount(); });
  });

  it('fails the load on an unknown state instead of rendering it as a known card', async () => {
    const h = await mountWith([{ ...fixture('connected', 'current', { caps: 1, discoveredAt: '2026-01-01T00:00:00Z' }), state: 'future-state' }]);
    assert.ok(h.body().includes('was not in the expected format'), 'an unknown state makes the load unreadable');
    assert.ok(!h.body().includes('Disabled'), 'never silently rendered as Disabled');
    assert.ok(!h.body().includes('Connected'), 'no known-state card is rendered');
    await h.act(async () => { h.root.unmount(); });
  });

  it('fails the load on an unknown health value', async () => {
    const conn = fixture('connected', 'current', { caps: 1, discoveredAt: '2026-01-01T00:00:00Z' });
    const h = await mountWith([{ ...conn, health: { state: 'future-health', lastSuccessfulContact: null } }]);
    assert.ok(h.body().includes('was not in the expected format'), 'an unknown health makes the load unreadable');
    assert.ok(!h.body().includes('Connected'), 'no card rendered');
    await h.act(async () => { h.root.unmount(); });
  });
});

describe('the mounted card suite emits no React warnings', () => {
  it('renders and expands a multi-capability card without duplicate-key or other warnings', async () => {
    const warnings: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
    try {
      const h = await mountWith([fixture('connected', 'current', { caps: 3, discoveredAt: '2026-01-01T00:00:00Z' })]);
      await h.clickButton('Inspect'); // render the keyed capability list
      await h.act(async () => { h.root.unmount(); });
    } finally {
      console.error = original;
    }
    const reactWarnings = warnings.filter((w) => /Warning:|unique "key"/i.test(w));
    assert.deepStrictEqual(reactWarnings, [], `unexpected React warnings:\n${warnings.join('\n')}`);
  });
});

describe('the card actions still call the existing handlers', () => {
  it('refresh and stop hit their endpoints on a connected connection', async () => {
    const h = await mountWith([fixture('connected', 'current', { caps: 1, discoveredAt: '2026-01-01T00:00:00Z' })]);
    await h.clickButton('Refresh');
    await h.clickButton('Stop');
    assert.ok(h.calls.some((c) => c.method === 'POST' && /\/connections\/.*\/refresh$/.test(c.url)), 'refresh endpoint called');
    assert.ok(h.calls.some((c) => c.method === 'POST' && /\/connections\/.*\/stop$/.test(c.url)), 'stop endpoint called');
    await h.act(async () => { h.root.unmount(); });
  });

  it('review-and-connect opens the review flow via its endpoint', async () => {
    const h = await mountWith([fixture('approval-required', 'not-measured', { caps: 0 })]);
    await h.clickButton('Review and connect');
    assert.ok(h.calls.some((c) => /\/connections\/.*\/review$/.test(c.url)), 'review endpoint called');
    await h.act(async () => { h.root.unmount(); });
  });

  it('remove opens the confirmation dialog rather than deleting immediately', async () => {
    const h = await mountWith([fixture('connected', 'current', { caps: 1, discoveredAt: '2026-01-01T00:00:00Z' })]);
    await h.clickButton('Remove');
    assert.ok(h.body().includes('Remove this Rig connection?'), 'the destructive action is guarded by confirmation');
    await h.act(async () => { h.root.unmount(); });
  });
});
