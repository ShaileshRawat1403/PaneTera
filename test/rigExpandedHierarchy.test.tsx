// test/rigExpandedHierarchy.test.tsx
//
// Presentation and accessibility tests for the expanded connection card. They
// mount the real RigPanel, expand a card carrying tools, resources, and prompts,
// and assert the visual hierarchy as structure: capabilities are grouped by kind
// in a fixed order under semantic headings, the human label precedes the
// technical id, a truncated inventory qualifies its counts as "shown", each kind
// exposes only its supported controls, and long identifiers keep their full,
// accessible value.

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

const cap = (id: string, kind: 'tool' | 'resource' | 'prompt', label: string, enabled = true, permission = 'proposable') => ({
  capabilityId: id, kind, name: id, label,
  description: { source: 'schema-derived', text: `${kind} description` },
  inputSchema: null, rawDeclaration: {}, permission, enabled,
  structuralDigest: 'd', presentationDigest: 'd',
});

function connection(opts: { tools?: unknown[]; resources?: unknown[]; prompts?: unknown[]; truncated?: boolean } = {}) {
  return {
    connectionId: 'srv', displayName: 'Server srv', sourceClass: 'panetera-managed',
    transport: { kind: 'stdio', executablePath: '/x', argv: [], cwd: '/', isolationMode: 'none' },
    state: 'connected', health: { state: 'current', lastSuccessfulContact: null },
    capabilities: {
      tools: opts.tools ?? [], resources: opts.resources ?? [], prompts: opts.prompts ?? [],
      truncated: opts.truncated ?? false, discoveredAt: '2026-01-01T00:00:00Z',
    },
    connectionApprovalId: null,
  };
}

async function mountRaw(conn: unknown) {
  const win = installDom();
  const fetchImpl = (url: string, init?: { method?: string }) => {
    const method = init?.method ?? 'GET';
    if (url.endsWith('/api/rig/connections') && method === 'GET') return Promise.resolve(resp({ connections: [conn] }));
    if (url.includes('/api/rig/provenance')) return Promise.resolve(resp({ records: [] }));
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
  await act(async () => { await Promise.resolve(); });
  return { win, root, act };
}

async function mountExpanded(conn: unknown) {
  const win = installDom();
  const fetchImpl = (url: string, init?: { method?: string }) => {
    const method = init?.method ?? 'GET';
    if (url.endsWith('/api/rig/connections') && method === 'GET') return Promise.resolve(resp({ connections: [conn] }));
    if (url.includes('/api/rig/provenance')) return Promise.resolve(resp({ records: [] }));
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
  await act(async () => { await Promise.resolve(); });
  const inspect = [...win.document.querySelectorAll('button')].find((b) => (b.textContent ?? '').startsWith('Inspect'));
  await act(async () => { inspect?.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); });
  return { win, root, act };
}

const full = { tools: [cap('t.one', 'tool', 'First Tool')], resources: [cap('r.one', 'resource', 'First Resource')], prompts: [cap('p.one', 'prompt', 'First Prompt')] };

describe('the expanded card groups capabilities by kind in a fixed order', () => {
  it('renders Tools, then Resources, then Prompts as semantic headings', async () => {
    const h = await mountExpanded(connection(full));
    const headings = [...h.win.document.querySelectorAll('h4')].map((n) => (n.textContent ?? '').trim());
    const kinds = headings.filter((t) => /^(Tools|Resources|Prompts)/.test(t));
    assert.deepStrictEqual(kinds.map((t) => t.split(' ·')[0]), ['Tools', 'Resources', 'Prompts'], 'fixed group order');
    // Each group is a labelled section.
    const sections = [...h.win.document.querySelectorAll('section[aria-labelledby]')];
    assert.ok(sections.length >= 3, 'each kind is a labelled section');
    await h.act(async () => { h.root.unmount(); });
  });

  it('places the human label before the technical id for each capability', async () => {
    const h = await mountExpanded(connection(full));
    const html = h.win.document.body.innerHTML;
    for (const [label, id] of [['First Tool', 't.one'], ['First Resource', 'r.one'], ['First Prompt', 'p.one']]) {
      assert.ok(html.indexOf(label) < html.indexOf(id), `${label} precedes ${id}`);
    }
    await h.act(async () => { h.root.unmount(); });
  });

  it('nests the group headings one level below the connection-name heading', async () => {
    const h = await mountExpanded(connection(full));
    const h3 = h.win.document.querySelector('h3');
    assert.ok(h3 && (h3.textContent ?? '').includes('Server srv'), 'the connection name is a semantic heading (h3)');
    const h4s = [...h.win.document.querySelectorAll('h4')].map((n) => (n.textContent ?? '').split(' ·')[0]);
    assert.ok(h4s.includes('Tools'), 'group headings are one level below (h4)');
    // The connection heading precedes its group headings in document order.
    const html = h.win.document.body.innerHTML;
    assert.ok(html.indexOf('Server srv') < html.indexOf('Tools'), 'connection heading precedes its groups');
    await h.act(async () => { h.root.unmount(); });
  });
});

describe('capability kind cannot be reclassified by array placement', () => {
  it('fails the load when a prompt sits in the tools array, exposing no tool invocation', async () => {
    const bad = connection({ tools: [cap('mislabelled', 'prompt', 'Mislabelled')] });
    const h = await mountRaw(bad);
    assert.ok(h.win.document.body.textContent?.includes('was not in the expected format'), 'the malformed payload fails the load');
    assert.ok(![...h.win.document.querySelectorAll('button')].some((b) => (b.textContent ?? '').trim() === 'Review invocation'), 'no tool invocation is exposed');
    await h.act(async () => { h.root.unmount(); });
  });
});

describe('a truncated inventory never implies a complete group', () => {
  it('qualifies every group count as "shown"', async () => {
    const h = await mountExpanded(connection({ ...full, truncated: true }));
    const headings = [...h.win.document.querySelectorAll('h4')].map((n) => (n.textContent ?? '').trim());
    assert.ok(headings.some((t) => /^Tools · 1 shown$/.test(t)), 'tools count is qualified as shown');
    assert.ok(headings.some((t) => /^Resources · 1 shown$/.test(t)));
    assert.ok(headings.some((t) => /^Prompts · 1 shown$/.test(t)));
    const text = h.win.document.body.textContent ?? '';
    assert.ok(text.includes('One or more groups may be incomplete'), 'truncation is disclosed factually');
    assert.ok(text.includes('counts show items returned'), 'counts are framed as items returned');
    // The disclosure must not overclaim that every group is partial.
    assert.ok(!/each group shows only part/i.test(text), 'does not assert every group is incomplete');
    await h.act(async () => { h.root.unmount(); });
  });

  it('uses a plain count when the inventory is complete', async () => {
    const h = await mountExpanded(connection(full));
    const headings = [...h.win.document.querySelectorAll('h4')].map((n) => (n.textContent ?? '').trim());
    assert.ok(headings.some((t) => t === 'Tools · 1'), 'complete groups show a plain count');
    assert.ok(!headings.some((t) => /shown/.test(t)), 'no "shown" qualifier when complete');
    await h.act(async () => { h.root.unmount(); });
  });
});

describe('each kind exposes only its supported controls', () => {
  const has = (win: Window, text: string) => [...win.document.querySelectorAll('button')].some((b) => (b.textContent ?? '').trim() === text);

  it('tools offer invocation, prompts offer prompt retrieval, resources offer neither', async () => {
    const h = await mountExpanded(connection(full));
    assert.ok(has(h.win, 'Review invocation'), 'a tool offers invocation');
    assert.ok(has(h.win, 'Load prompt'), 'a prompt offers retrieval');
    await h.act(async () => { h.root.unmount(); });
  });

  it('a resource-only connection gains no invocation or prompt actions', async () => {
    const h = await mountExpanded(connection({ resources: [cap('r.only', 'resource', 'Only Resource')] }));
    assert.ok(!has(h.win, 'Review invocation'), 'resources get no invocation');
    assert.ok(!has(h.win, 'Load prompt'), 'resources get no prompt retrieval');
    // Governance (enable + permission) remains available for a resource.
    assert.ok(h.win.document.querySelector('input[type="checkbox"]'), 'resource governance remains');
    assert.ok(h.win.document.querySelector('[aria-label="Permission for r.only"]'), 'resource permission remains');
    await h.act(async () => { h.root.unmount(); });
  });
});

describe('long identifiers keep their full, accessible value', () => {
  it('renders the complete id in text and as the title, regardless of length', async () => {
    const longId = 'tool.' + 'segment-'.repeat(20) + 'end';
    const h = await mountExpanded(connection({ tools: [cap(longId, 'tool', 'Long Tool')] }));
    assert.ok(h.win.document.body.textContent?.includes(longId), 'the full id is present in the DOM');
    const el = [...h.win.document.querySelectorAll('[title]')].find((n) => n.getAttribute('title') === longId);
    assert.ok(el, 'the full id is available as an accessible title');
    await h.act(async () => { h.root.unmount(); });
  });
});

describe('the expanded hierarchy emits no React or accessibility warnings', () => {
  it('mounts and expands cleanly', async () => {
    const warnings: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
    try {
      const h = await mountExpanded(connection(full));
      await h.act(async () => { h.root.unmount(); });
    } finally {
      console.error = original;
    }
    assert.deepStrictEqual(warnings.filter((w) => /Warning:|unique "key"/i.test(w)), [], `warnings:\n${warnings.join('\n')}`);
  });
});
