// test/workstationVisual.test.tsx
//
// Behaviour guards for the visual-foundation slice. They hold the aesthetics work
// to its honesty rules: every canvas start is a real, wired action (no decorative
// dead control), the brand mark is decorative and not a competing accessible name,
// and the stacked (mobile) layout keeps the composer reachable rather than
// stranding the person on the canvas. Mounted and semantic, not source-string or
// snapshot, and every test requires zero React warnings.

process.env.NODE_ENV = 'test';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

function installDom(stacked = false) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
  const win = dom.window as unknown as Window & typeof globalThis;
  let matches = stacked;
  const listeners = new Set<() => void>();
  (win as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (query: string) => {
    const mql = { media: query, addEventListener: (_: string, cb: () => void) => listeners.add(cb), removeEventListener: (_: string, cb: () => void) => listeners.delete(cb), addListener: (cb: () => void) => listeners.add(cb), removeListener: (cb: () => void) => listeners.delete(cb), dispatchEvent: () => true, onchange: null };
    Object.defineProperty(mql, 'matches', { get: () => matches });
    return mql;
  };
  const g = globalThis as Record<string, unknown>;
  g.window = win; g.document = win.document; g.getComputedStyle = win.getComputedStyle.bind(win);
  Object.defineProperty(g, 'navigator', { value: win.navigator, configurable: true });
  for (const n of ['HTMLElement', 'Element', 'Node', 'Text', 'DocumentFragment', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'MutationObserver', 'NodeList']) {
    const v = (win as unknown as Record<string, unknown>)[n]; if (v) g[n] = v;
  }
  g.requestAnimationFrame = (cb: (t: number) => void) => { cb(Date.now()); return 0; };
  g.cancelAnimationFrame = () => {};
  return win;
}

async function withMount(win: Window & typeof globalThis, fn: (m: { React: typeof import('react'); act: typeof import('react').act; container: HTMLElement; render: (n: unknown) => Promise<void>; }) => Promise<void>) {
  const warns: string[] = [];
  const original = console.error;
  console.error = (...a: unknown[]) => { warns.push(a.map(String).join(' ')); };
  try {
    const React = (await import('react')).default;
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');
    const container = win.document.createElement('div');
    win.document.body.appendChild(container);
    const root = createRoot(container);
    const render = (n: unknown) => act(async () => { root.render(n as Parameters<typeof root.render>[0]); });
    try {
      await fn({ React: React as unknown as typeof import('react'), act, container, render });
    } finally {
      await act(async () => { root.unmount(); });
    }
  } finally {
    console.error = original;
  }
  assert.deepStrictEqual(warns.filter((w) => /Warning:/.test(w)), [], `unexpected warnings:\n${warns.join('\n')}`);
}

const governanceStatus = {
  gatewayConnected: true, activeWorkspaceName: null, policyActive: false, portalAuthValid: true,
  workspaceCatalogCount: 0, localAdapterActive: false, liveAppUrlReachable: false, liveAppManifestAvailable: false,
};

describe('the canvas start offers only real, wired starts', () => {
  it('renders exactly three starts, each connected to a real handler, none dead', async () => {
    const win = installDom();
    await withMount(win, async ({ React, container, render }) => {
      const calls = { project: 0, capability: 0, goal: 0 };
      const { CanvasStart } = await import('../src/components/workstation/CanvasStart');
      await render(React.createElement(CanvasStart, {
        onChooseProject: () => { calls.project += 1; },
        onConnectCapability: () => { calls.capability += 1; },
        onDescribeGoal: () => { calls.goal += 1; },
      }));
      const buttons = [...container.querySelectorAll('button')] as HTMLButtonElement[];
      assert.strictEqual(buttons.length, 3, 'exactly three starts, no extra dead controls');
      for (const b of buttons) {
        b.dispatchEvent(new (win as Window & typeof globalThis).MouseEvent('click', { bubbles: true }));
      }
      // Every button fired exactly one real handler: none is a decorative no-op.
      assert.deepStrictEqual(calls, { project: 1, capability: 1, goal: 1 }, 'each start is wired to its own real handler');
    });
  });
});

describe('the brand mark is decorative, not a competing name', () => {
  it('renders the pane mark hidden from assistive technology with no text', async () => {
    const win = installDom();
    await withMount(win, async ({ React, container, render }) => {
      const { PaneMark } = await import('../src/components/workstation/PaneMark');
      await render(React.createElement(PaneMark));
      const svg = container.querySelector('svg');
      assert.ok(svg, 'the mark renders');
      assert.strictEqual(svg!.getAttribute('aria-hidden'), 'true', 'the mark is hidden from assistive technology');
      assert.strictEqual((svg!.textContent ?? '').trim(), '', 'the mark contributes no accessible text');
    });
  });
});

describe('the top bar keeps accessible names on every governance control', () => {
  it('names the project switch and each surface launcher', async () => {
    const win = installDom(false); // split layout
    await withMount(win, async ({ React, container, render }) => {
      const { WorkstationShell } = await import('../src/components/workstation/WorkstationShell');
      await render(React.createElement(WorkstationShell, {
        conversation: React.createElement('div', null, 'conversation'),
        canvas: React.createElement('div', null, 'canvas'),
        renderActivity: () => null,
        renderWorkspaceSelector: () => null,
        renderRig: () => null,
        renderHeadroom: () => null,
        governanceStatus,
        onOpenAudit: () => {},
        canvasHasContent: true,
      }));
      for (const name of [
        'Switch project',
        'Toggle Headroom drawer',
        'Toggle Rig drawer',
        'Open audit log',
        'Toggle activity drawer',
        'Switch to light mode',
      ]) {
        assert.ok(container.querySelector(`button[aria-label="${name}"]`), `the top bar keeps an accessible name for "${name}"`);
      }
    });
  });
});

describe('on the stacked (mobile) layout, "Describe your goal" reveals the composer', () => {
  it('from the Canvas plane, switches to Conversation and focuses the visible composer', async () => {
    const win = installDom(true); // stacked
    let canvasInitiallyActive = false;
    let conversationInitiallyInactive = false;
    let describeExists = false;
    let conversationFinallyActive = false;
    let canvasFinallyInactive = false;
    let inputExists = false;
    let inputFocused = false;
    await withMount(win, async ({ React, act, container, render }) => {
      const { WorkstationShell } = await import('../src/components/workstation/WorkstationShell');
      const { CanvasStart } = await import('../src/components/workstation/CanvasStart');
      const { Composer } = await import('../src/components/composer/Composer');

      // The real App coordination is two-phase: the canvas action requests the
      // conversation plane, then the shell acknowledges that it is active and only
      // then bumps the composer's focus key.
      function Harness(): React.ReactElement {
        const [revealKey, setRevealKey] = React.useState(0);
        const [focusKey, setFocusKey] = React.useState(0);
        return React.createElement(WorkstationShell, {
          revealConversationKey: revealKey,
          onConversationRevealed: () => setFocusKey((k) => k + 1),
          conversation: React.createElement(Composer, { onSubmit: () => {}, focusRequestKey: focusKey }),
          canvas: React.createElement(CanvasStart, {
            onChooseProject: () => {},
            onConnectCapability: () => {},
            onDescribeGoal: () => setRevealKey((k) => k + 1),
          }),
          renderActivity: () => null,
          renderWorkspaceSelector: () => null,
          renderRig: () => null,
          renderHeadroom: () => null,
          governanceStatus,
          onOpenAudit: () => {},
          canvasHasContent: true,
        });
      }
      await render(React.createElement(Harness));

      const evt = () => new (win as Window & typeof globalThis).MouseEvent('click', { bubbles: true });
      const planeSwitch = container.querySelector('[aria-label="Choose which pane to show"]')!;
      const toggles = [...planeSwitch.querySelectorAll('button[aria-pressed]')] as HTMLButtonElement[];
      const convToggle = toggles.find((b) => /Conversation/.test(b.textContent ?? ''))!;
      const canvasToggle = toggles.find((b) => /Canvas/.test(b.textContent ?? ''))!;

      // Move to the Canvas plane, where the start lives.
      await act(async () => { canvasToggle.dispatchEvent(evt()); });
      canvasInitiallyActive = canvasToggle.getAttribute('aria-pressed') === 'true';
      conversationInitiallyInactive = convToggle.getAttribute('aria-pressed') === 'false';

      // Click the real "Describe your goal" start.
      const describe = container.querySelector('[data-variant="describe-goal"]') as HTMLButtonElement;
      describeExists = Boolean(describe);
      if (describe) await act(async () => { describe.dispatchEvent(evt()); });

      // It switches to the conversation plane...
      conversationFinallyActive = convToggle.getAttribute('aria-pressed') === 'true';
      canvasFinallyInactive = canvasToggle.getAttribute('aria-pressed') === 'false';
      // ...and lands focus in the composer.
      const input = container.querySelector('textarea[aria-label="Message PaneTera"]');
      inputExists = Boolean(input);
      inputFocused = win.document.activeElement === input;
    });
    // Assert only after the shell is unmounted. A deliberately broken focus mutation
    // must fail cleanly rather than leaving MUI timers alive during exception unwind.
    assert.strictEqual(canvasInitiallyActive, true, 'canvas is active');
    assert.strictEqual(conversationInitiallyInactive, true, 'conversation is inactive');
    assert.strictEqual(describeExists, true, 'the describe-goal start is on the canvas plane');
    assert.strictEqual(conversationFinallyActive, true, 'conversation becomes pressed');
    assert.strictEqual(canvasFinallyInactive, true, 'canvas becomes unpressed');
    assert.strictEqual(inputExists, true, 'the composer input exists');
    assert.strictEqual(inputFocused, true, 'the visible composer receives focus');
  });
});
