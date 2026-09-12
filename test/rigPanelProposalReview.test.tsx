// test/rigPanelProposalReview.test.tsx
//
// RigPanel is the review surface for Rig proposals (ADR-005). The reviewer
// sees the stored proposal arguments, and approving runs the stored proposal
// without sending replacement arguments.

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

function resp(body: unknown) {
  return { ok: true, status: 200, statusText: '', json: async () => body, text: async () => JSON.stringify(body ?? {}) };
}

const tool = {
  capabilityId: 'cap-0', kind: 'tool', name: 'cap-0', label: 'cap-0',
  description: { source: 'schema-derived', text: 'does a thing' },
  inputSchema: null, rawDeclaration: {}, permission: 'proposable', enabled: true,
  structuralDigest: 'd', presentationDigest: 'd',
};

const connection = {
  connectionId: 'srv', displayName: 'Server srv', sourceClass: 'panetera-managed',
  transport: { kind: 'stdio', executablePath: '/x', argv: [], cwd: '/', isolationMode: 'none' },
  state: 'connected', health: { state: 'current', lastSuccessfulContact: null },
  capabilities: { tools: [tool], resources: [], prompts: [], truncated: false, discoveredAt: '2026-01-01T00:00:00Z' },
  connectionApprovalId: null,
};

describe('RigPanel proposal review', () => {
  it('shows the stored proposal arguments and approves without sending replacement arguments', async () => {
    const win = installDom();
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    (globalThis as Record<string, unknown>).fetch = (url: string, init?: { method?: string; body?: string }) => {
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body });
      if (url.endsWith('/api/rig/connections') && method === 'GET') return Promise.resolve(resp({ connections: [connection] }));
      if (url.includes('/api/rig/provenance')) return Promise.resolve(resp({ records: [] }));
      if (url.endsWith('/api/rig/proposals') && method === 'GET') return Promise.resolve(resp({ proposals: [] }));
      if (url.endsWith('/api/rig/proposals') && method === 'POST') {
        return Promise.resolve(resp({ proposal: { proposalId: 'prop-1', capabilityId: 'cap-0', arguments: { name: 'stored-name' } } }));
      }
      if (/\/api\/rig\/proposals\/prop-1\/approve$/.test(url)) return Promise.resolve(resp({ approval: { approvalId: 'appr-1' } }));
      if (url.endsWith('/api/rig/invocations')) return Promise.resolve(resp({ result: { ok: true } }));
      return Promise.resolve(resp({ ok: true }));
    };

    const React = (await import('react')).default;
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');
    const { RigPanel } = await import('../src/components/rig/RigPanel');
    const container = win.document.createElement('div');
    win.document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(React.createElement(RigPanel, { token: 't', onClose: () => {} })); });

    const buttons = () => [...win.document.querySelectorAll('button')] as HTMLButtonElement[];
    const click = (button: HTMLButtonElement | undefined) => act(async () => {
      if (!button) throw new Error('button missing');
      button.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    });
    const named = (text: string) => buttons().find((button) => (button.textContent ?? '').trim() === text);

    await click(buttons().find((button) => (button.textContent ?? '').startsWith('Inspect')));
    await click(named('Review invocation'));

    const stored = win.document.querySelector('[data-testid="proposal-stored-arguments"]');
    assert.ok(stored, 'the stored arguments are shown to the reviewer');
    assert.match(stored.textContent ?? '', /"name": "stored-name"/);

    await click(named('Approve and run'));
    const invocation = calls.find((call) => call.method === 'POST' && call.url.endsWith('/api/rig/invocations'));
    assert.ok(invocation, 'approve and run invoked the approval');
    assert.deepStrictEqual(Object.keys(JSON.parse(invocation.body ?? '{}')).sort(), ['approvalId', 'capabilityId', 'connectionId'], 'no replacement arguments are sent');
    await act(async () => { root.unmount(); });
  });
});
