// test/domEnv.ts
//
// Installs a jsdom DOM as a module-load side effect, and exports installDom for
// per-test reuse.
//
// This module MUST be imported before @mui/material (and anything that imports it).
// @mui + @emotion decide at import time whether they are running in a browser (a
// `document` is present) or in a server context, and that decision governs whether
// their styled / ref-forwarding wrappers forward refs. Imported after MUI, the
// wrappers initialise in the server mode and every ButtonBase / transition / Tooltip
// child then trips React's "Function components cannot be given refs" warning under
// jsdom. Imported first, a DOM exists at MUI init and those warnings never occur — so
// the tests can require genuinely zero React warnings without any suppression.

import { JSDOM } from 'jsdom';

export function installDom(): Window & typeof globalThis {
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
  for (const n of ['HTMLElement', 'Element', 'Node', 'Text', 'DocumentFragment', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'MutationObserver', 'DOMParser', 'NodeList', 'getSelection']) {
    const v = (win as unknown as Record<string, unknown>)[n]; if (v) globals[n] = v;
  }
  // Flush rAF synchronously so MUI's Modal/Slide mount effects (and the Paper's DOM
  // node) are attached before the transition's enter handler reads the node.
  globals.requestAnimationFrame = (cb: (t: number) => void) => { cb(Date.now()); return 0; };
  globals.cancelAnimationFrame = () => {};
  return win;
}

// Side effect: guarantee a DOM exists before any consumer imports @mui/@emotion.
installDom();
