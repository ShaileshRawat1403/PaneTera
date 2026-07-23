// test/canvasStart.test.tsx
//
// Structure and behaviour tests for the initial canvas start state. They assert
// the visual-hierarchy intent as structure, not pixels: one primary path, one
// quieter secondary path, real accessible names, a single workspace heading (not
// a hero stack), and the composer path stated in words. A raw-colour guard keeps
// the slice on theme tokens.

process.env.NODE_ENV = 'test';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { CanvasStart } from '../src/components/workstation/CanvasStart';

function markup(): string {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(CanvasStart, { onChooseProject: () => {}, onConnectCapability: () => {} }),
  );
}

describe('the canvas start presents one primary path and a quieter secondary', () => {
  const html = markup();

  it('marks Choose a project as the primary action', () => {
    assert.ok(html.includes('data-variant="primary"'), 'a primary action exists');
    assert.ok(/data-variant="primary"[\s\S]*?Choose a project/.test(html), 'the primary action is Choose a project');
  });

  it('marks Connect a capability as the secondary action', () => {
    assert.ok(html.includes('data-variant="secondary"'), 'a secondary action exists');
    assert.ok(/data-variant="secondary"[\s\S]*?Connect a capability/.test(html), 'the secondary action is Connect a capability');
  });

  it('has exactly one heading, not a stacked hero', () => {
    const h1 = html.match(/<h1/g) ?? [];
    assert.strictEqual(h1.length, 1, 'exactly one h1');
    assert.ok(!html.includes('<h2') && !html.includes('variant="h3"'), 'no competing large headings');
  });

  it('keeps the composer path available in words, not as a fake button', () => {
    assert.ok(/describe your goal in the composer/i.test(html), 'the composer path is stated');
  });

  it('does not imply a project or capability already exists', () => {
    assert.ok(!/\d+\s+projects?\b/i.test(html), 'no fabricated project count');
    assert.ok(!/connected|available now|active/i.test(html), 'no invented status');
  });
});

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
  const win = dom.window as unknown as Window & typeof globalThis;
  const globals = globalThis as Record<string, unknown>;
  globals.window = win;
  globals.document = win.document;
  globals.getComputedStyle = win.getComputedStyle.bind(win);
  Object.defineProperty(globals, 'navigator', { value: win.navigator, configurable: true });
  for (const name of ['HTMLElement', 'Element', 'Node', 'Text', 'DocumentFragment', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'MutationObserver', 'NodeList']) {
    const value = (win as unknown as Record<string, unknown>)[name];
    if (value) globals[name] = value;
  }
  globals.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0);
  globals.cancelAnimationFrame = (id: number) => clearTimeout(id);
  return win;
}

describe('the start actions invoke their handlers', () => {
  it('routes primary to choose-project and secondary to connect-capability', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const win = installDom();
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');

    let chose = 0;
    let connected = 0;
    const container = win.document.createElement('div');
    win.document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(CanvasStart, {
        onChooseProject: () => { chose += 1; },
        onConnectCapability: () => { connected += 1; },
      }));
    });
    const primary = container.querySelector('[data-variant="primary"]') as HTMLButtonElement;
    const secondary = container.querySelector('[data-variant="secondary"]') as HTMLButtonElement;
    assert.ok(primary && secondary, 'both actions render');
    await act(async () => { primary.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); });
    await act(async () => { secondary.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); });
    assert.strictEqual(chose, 1, 'primary chose a project');
    assert.strictEqual(connected, 1, 'secondary connected a capability');
    await act(async () => { root.unmount(); });
  });
});

describe('the workstation slice stays on theme tokens', () => {
  for (const file of ['src/components/workstation/CanvasStart.tsx', 'src/components/workstation/WorkstationShell.tsx']) {
    it(`${file} uses no raw colour literals`, () => {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      const literals = source.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? [];
      assert.deepStrictEqual(literals, [], `unexpected colour literals: ${literals.join(', ')}`);
    });
  }
});
