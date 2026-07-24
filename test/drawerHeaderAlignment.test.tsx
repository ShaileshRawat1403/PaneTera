// test/drawerHeaderAlignment.test.tsx
//
// This increment brought the Activity (PreviewPanel) and Audit (AuditLogsView)
// headers into line with the Rig/Headroom DrawerShell grammar without forcing them
// through one shared component: a fixed header with an h6 title as the accessible
// name, right-aligned actions ending in an explicitly named Close, and a body that
// scrolls beneath it. These mounted tests assert that grammar for both surfaces.
//
// The focus trap and focus restoration on close come from the real MUI Modal/Dialog
// and are verified in real Chrome, not here (jsdom cannot run the trap faithfully).
//
// MUI is imported dynamically, after installDom(), so @emotion initialises with a
// DOM present and no ref-forwarding warnings appear; every test requires zero
// React warnings.

process.env.NODE_ENV = 'test';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import type { FeedItem } from '../shared/uiComponent';

const FOLLOWING = 4; // Node.DOCUMENT_POSITION_FOLLOWING

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
  // Synchronous rAF so the Dialog's Fade transition completes inside act(), rather
  // than firing on a later timer that trips "update not wrapped in act" warnings.
  globals.requestAnimationFrame = (cb: (t: number) => void) => { cb(Date.now()); return 0; };
  globals.cancelAnimationFrame = () => {};
  return win;
}

/** Mount a node with console.error captured, asserting zero React warnings. */
async function withMount(fn: (m: {
  win: Window & typeof globalThis;
  doc: Document;
  React: typeof import('react');
  act: typeof import('react').act;
  render: (node: unknown) => Promise<void>;
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
    try {
      await fn({ win, doc: win.document, React: React as unknown as typeof import('react'), act, render });
    } finally {
      // Always unmount, even on a failed assertion, so the Modal's focus-trap timer
      // is torn down and the test process does not hang.
      await act(async () => { root.unmount(); });
    }
  } finally {
    console.error = original;
  }
  assert.deepStrictEqual(warns.filter((w) => /Warning:/.test(w)), [], `unexpected warnings:\n${warns.join('\n')}`);
}

describe('the Audit dialog header follows the shell grammar', () => {
  it('names the dialog by its h6 title, puts Refresh then Close in the header, and keeps filters in the scrolling body with no footer', () => withMount(async ({ doc, React, act, render }) => {
    (globalThis as Record<string, unknown>).fetch = async () => ({ ok: true, status: 200, json: async () => ({ logs: [] }) });
    const { AuditLogsView } = await import('../src/components/workbench/AuditLogsView');
    await render(React.createElement(AuditLogsView, { token: 't', open: true, onClose: () => {} }));
    await act(async () => { await Promise.resolve(); });

    const dialog = doc.querySelector('[role="dialog"]') as HTMLElement;
    assert.ok(dialog, 'the audit dialog is present');
    assert.strictEqual(dialog.getAttribute('aria-labelledby'), 'audit-trail-title', 'the dialog is labelled by its title');
    const title = doc.getElementById('audit-trail-title')!;
    assert.strictEqual(title.tagName, 'H6', 'the title is an h6');
    assert.match(title.textContent ?? '', /Audit trail/, 'the title text is the accessible name');

    // The title heading must not be nested inside another heading: MUI's DialogTitle
    // defaults to <h2>, so without component="div" the h6 would sit inside an h2.
    let ancestor = title.parentElement;
    let nestedHeading = false;
    while (ancestor && ancestor !== dialog) {
      if (/^H[1-6]$/.test(ancestor.tagName)) nestedHeading = true;
      ancestor = ancestor.parentElement;
    }
    assert.ok(!nestedHeading, 'the title heading is not nested inside another heading');

    const header = doc.querySelector('.MuiDialogTitle-root') as HTMLElement;
    const content = doc.querySelector('.MuiDialogContent-root') as HTMLElement;
    assert.ok(header && content, 'the dialog has a title header and a content body');

    const refresh = header.querySelector('button[aria-label="Refresh audit trail"]');
    const close = header.querySelector('button[aria-label="Close Audit"]');
    assert.ok(refresh, 'Refresh lives in the header');
    assert.ok(close, 'Close lives in the header');
    assert.ok((refresh!.compareDocumentPosition(close!) & FOLLOWING) !== 0, 'Refresh precedes Close');

    assert.ok(!doc.querySelector('.MuiDialogActions-root'), 'there is no redundant footer');

    assert.ok(content.querySelector('[aria-label="Filter by actor kind"]'), 'filters live in the scrolling body');
    assert.ok(!header.querySelector('[aria-label="Filter by actor kind"]'), 'filters are not in the fixed header');
  }));
});

const terminalItem: FeedItem = { id: 'feed-1', type: 'TerminalLogs', data: { logs: [] }, timestamp: '2026-07-23T10:00:00.000Z' };

describe('the Activity panel header follows the shell grammar', () => {
  it('renders a fixed header with an h6 title and a named Close, with only the body scrolling', () => withMount(async ({ doc, React, render }) => {
    const { PreviewPanel } = await import('../src/components/PreviewPanel');
    await render(React.createElement(PreviewPanel, {
      previewFeed: [], onClose: () => {}, onAction: () => {}, onRemoveItem: () => {}, onClearFeed: () => {}, onApproveAction: () => {}, token: 't', loading: false,
    }));

    const header = doc.querySelector('header') as HTMLElement;
    assert.ok(header, 'the header is a semantic <header>');
    const title = header.querySelector('h6');
    assert.ok(title && title.textContent === 'Activity', 'the title is an h6 reading Activity');
    assert.ok(header.querySelector('button[aria-label="Close Activity"]'), 'Close is named in the header');
    assert.ok(header.querySelector('svg[aria-hidden="true"]'), 'the leading icon is decorative');
    assert.ok(!doc.querySelector('button[aria-label="Clear Activity feed"]'), 'Clear Feed is absent when the feed is empty');

    const scroll = doc.querySelector('.scroll-container') as HTMLElement;
    assert.ok(scroll, 'a distinct scroll region exists');
    assert.ok(!scroll.contains(header) && !header.contains(scroll), 'the header and the scroll region are separate siblings');
  }));

  it('shows Clear Feed before Close once the feed has items', () => withMount(async ({ doc, React, render }) => {
    const { PreviewPanel } = await import('../src/components/PreviewPanel');
    await render(React.createElement(PreviewPanel, {
      previewFeed: [terminalItem], onClose: () => {}, onAction: () => {}, onRemoveItem: () => {}, onClearFeed: () => {}, onApproveAction: () => {}, token: 't', loading: false,
    }));
    const header = doc.querySelector('header') as HTMLElement;
    const clear = header.querySelector('button[aria-label="Clear Activity feed"]');
    const close = header.querySelector('button[aria-label="Close Activity"]');
    assert.ok(clear, 'Clear Feed appears when the feed is populated');
    assert.ok(close, 'Close is still present');
    assert.ok((clear!.compareDocumentPosition(close!) & FOLLOWING) !== 0, 'Clear Feed precedes Close');
  }));
});
