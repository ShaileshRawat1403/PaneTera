// test/composerFocus.test.tsx
//
// The composer takes focus when the host bumps its focus-request key, and never on
// the initial mount. This is the composer half of the canvas "Describe your goal"
// flow; the plane-switch half is covered in test/workstationVisual.test.tsx. Kept in
// its own file, mounting only the composer, so the focus guard can be exercised (and
// mutation-checked) without the heavier stacked-shell integration.

process.env.NODE_ENV = 'test';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
  const win = dom.window as unknown as Window & typeof globalThis;
  (win as unknown as { matchMedia: (q: string) => unknown }).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return true; }, media: '', onchange: null });
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

describe('the composer focuses on request, never on mount', () => {
  it('takes focus when the focus-request key is bumped', async () => {
    const win = installDom();
    const warns: string[] = [];
    const original = console.error;
    console.error = (...a: unknown[]) => { warns.push(a.map(String).join(' ')); };
    try {
      const React = (await import('react')).default;
      const { createRoot } = await import('react-dom/client');
      const { act } = await import('react');
      const { Composer } = await import('../src/components/composer/Composer');

      function Host(): React.ReactElement {
        const [k, setK] = React.useState(0);
        return React.createElement('div', null,
          React.createElement('button', { id: 'bump', onClick: () => setK((v) => v + 1) }, 'bump'),
          React.createElement(Composer, { onSubmit: () => {}, focusRequestKey: k }),
        );
      }

      const container = win.document.createElement('div');
      win.document.body.appendChild(container);
      const root = createRoot(container);
      await act(async () => { root.render(React.createElement(Host)); });

      const input = container.querySelector('textarea[aria-label="Message PaneTera"]') as HTMLTextAreaElement;
      const inputExists = Boolean(input);
      const focusedOnMount = win.document.activeElement === input;
      await act(async () => { (container.querySelector('#bump') as HTMLButtonElement).dispatchEvent(new win.MouseEvent('click', { bubbles: true })); });
      const focusedAfterRequest = win.document.activeElement === input;

      // Always unmount before asserting, so a failed assertion cannot leave the
      // composer (with live MUI timers) mounted and hang the process.
      await act(async () => { root.unmount(); });

      assert.ok(inputExists, 'the composer input exists');
      assert.strictEqual(focusedOnMount, false, 'the composer does not steal focus on mount');
      assert.strictEqual(focusedAfterRequest, true, 'the composer takes focus when asked');
    } finally {
      console.error = original;
    }
    assert.deepStrictEqual(warns.filter((w) => /Warning:/.test(w)), [], `unexpected warnings:\n${warns.join('\n')}`);
  });
});
