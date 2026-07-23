// test/workstationBreakpoint.test.tsx
//
// The regression test for a real defect: crossing the 1024px breakpoint used to
// destroy live state. Codex typed a draft at 760px, resized to 1440px, and the
// composer came back empty. The cause was two conditional layout branches whose
// differing sibling order made React remount the panes, discarding a
// half-written draft and restarting any live preview.
//
// This test reproduces that journey in a real DOM. It mounts the shell with a
// conversation that carries an uncontrolled input and a mount counter, writes a
// draft, flips the media query across the breakpoint in both directions, and
// asserts the draft survives and nothing remounted. Against the old two-branch
// layout it fails; against one stable subtree it passes.

process.env.NODE_ENV = 'test';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

/**
 * A jsdom environment with a matchMedia whose result is live and controllable.
 *
 * `matches` is a getter, not a snapshot, because the hook reads it again inside
 * its change listener. A snapshot would report the old value and the layout
 * would never flip, which would make this test pass for the wrong reason.
 */
function installDom(initialStacked: boolean) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });
  const win = dom.window as unknown as Window & typeof globalThis;
  let matches = initialStacked;
  const listeners = new Set<() => void>();

  (win as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) => {
    const mql = {
      media: query,
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
      addListener: (cb: () => void) => listeners.add(cb),
      removeListener: (cb: () => void) => listeners.delete(cb),
      dispatchEvent: () => true,
      onchange: null,
    };
    Object.defineProperty(mql, 'matches', { get: () => matches });
    return mql as unknown as MediaQueryList;
  };

  const globals = globalThis as Record<string, unknown>;
  globals.window = win;
  globals.document = win.document;
  globals.HTMLElement = win.HTMLElement;
  globals.Node = win.Node;
  globals.getComputedStyle = win.getComputedStyle.bind(win);
  // navigator is a read-only getter on the Node global, so it is redefined
  // rather than assigned.
  Object.defineProperty(globals, 'navigator', { value: win.navigator, configurable: true });

  return {
    win,
    setStacked: (value: boolean) => {
      matches = value;
      listeners.forEach((cb) => cb());
    },
  };
}

const DRAFT = 'boundary-draft-preservation-check';

describe('crossing the workstation breakpoint keeps live state', () => {
  it('preserves a composer draft and never remounts the panes', async () => {
    const { setStacked } = installDom(false);

    const React = (await import('react')).default;
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');
    const { WorkstationShell } = await import('../src/components/workstation/WorkstationShell');

    let conversationMounts = 0;
    let canvasMounts = 0;

    const Conversation = () => {
      React.useEffect(() => {
        conversationMounts += 1;
      }, []);
      // Uncontrolled input: its DOM value survives a re-render but not a
      // remount, which is exactly the distinction under test.
      return React.createElement('input', { id: 'draft', defaultValue: '' });
    };

    const Canvas = () => {
      React.useEffect(() => {
        canvasMounts += 1;
      }, []);
      return React.createElement('div', { id: 'canvas-body' }, 'canvas');
    };

    const governanceStatus = {
      gatewayConnected: true,
      activeWorkspaceName: null,
      policyActive: false,
      portalAuthValid: true,
      workspaceCatalogCount: 0,
      localAdapterActive: false,
      liveAppUrlReachable: false,
      liveAppManifestAvailable: false,
    };

    const element = React.createElement(WorkstationShell, {
      conversation: React.createElement(Conversation),
      canvas: React.createElement(Canvas),
      renderActivity: () => null,
      renderWorkspaceSelector: () => null,
      renderRig: () => null,
      renderHeadroom: () => null,
      governanceStatus,
      onOpenAudit: () => {},
      canvasHasContent: true,
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(element);
    });

    // Start split, write a draft into the uncontrolled input.
    assert.strictEqual(conversationMounts, 1, 'conversation mounted once');
    assert.strictEqual(canvasMounts, 1, 'canvas mounted once');
    const input = () => container.querySelector('#draft') as HTMLInputElement | null;
    assert.ok(input(), 'the draft input is present in the split layout');
    input()!.value = DRAFT;

    // Cross into the stacked layout.
    await act(async () => {
      setStacked(true);
    });

    assert.ok(input(), 'the draft input is still present after crossing to stacked');
    assert.strictEqual(input()!.value, DRAFT, 'the draft survived the crossing to stacked');
    assert.strictEqual(conversationMounts, 1, 'conversation must not remount crossing to stacked');
    assert.strictEqual(canvasMounts, 1, 'canvas must not remount crossing to stacked');

    // And back to split, the direction Codex resized.
    await act(async () => {
      setStacked(false);
    });

    assert.strictEqual(input()!.value, DRAFT, 'the draft survived the crossing back to split');
    assert.strictEqual(conversationMounts, 1, 'conversation must not remount crossing back');
    assert.strictEqual(canvasMounts, 1, 'canvas must not remount crossing back');

    await act(async () => {
      root.unmount();
    });
  });

  it('shows the plane switch only when stacked', async () => {
    const { setStacked } = installDom(false);

    const React = (await import('react')).default;
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');
    const { WorkstationShell } = await import('../src/components/workstation/WorkstationShell');

    const governanceStatus = {
      gatewayConnected: true,
      activeWorkspaceName: null,
      policyActive: false,
      portalAuthValid: true,
      workspaceCatalogCount: 0,
      localAdapterActive: false,
      liveAppUrlReachable: false,
      liveAppManifestAvailable: false,
    };

    const element = React.createElement(WorkstationShell, {
      conversation: React.createElement('div', null, 'conversation'),
      canvas: React.createElement('div', null, 'canvas'),
      renderActivity: () => null,
      renderWorkspaceSelector: () => null,
      renderRig: () => null,
      renderHeadroom: () => null,
      governanceStatus,
      onOpenAudit: () => {},
      canvasHasContent: true,
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(element);
    });

    const switchGroup = () => container.querySelector('[aria-label="Choose which pane to show"]');
    const toggles = () => container.querySelectorAll('button[aria-pressed]');

    assert.strictEqual(switchGroup(), null, 'no plane switch in the split layout');

    await act(async () => {
      setStacked(true);
    });

    assert.ok(switchGroup(), 'the plane switch appears in the stacked layout');
    assert.strictEqual(toggles().length, 2, 'two toggle buttons, both with aria-pressed');
    // Availability reaches assistive technology as text, not only as the dot.
    assert.match(
      switchGroup()!.textContent ?? '',
      /content waiting/,
      'the canvas availability is announced in text',
    );

    await act(async () => {
      root.unmount();
    });
  });
});
