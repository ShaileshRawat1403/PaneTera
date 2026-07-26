// test/canvasStart.test.tsx
//
// Structure and behaviour tests for the initial canvas start state. They assert
// the visual-hierarchy intent as structure, not pixels: one primary path, one
// quieter secondary path, real accessible names, a single workspace heading (not
// a hero stack), and the composer path stated in words. A raw-colour guard keeps
// the slice on theme tokens.

process.env.NODE_ENV = 'test';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { before, describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { installDom } from './domEnv';
import React from 'react';
import { CanvasStart } from '../src/components/workstation/CanvasStart';

async function markup(): Promise<string> {
  const win = installDom();
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const container = win.document.createElement('div');
  win.document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(CanvasStart, {
      onChooseProject: () => {},
      onConnectCapability: () => {},
      onDescribeGoal: () => {},
    }));
  });
  const html = container.innerHTML;
  await act(async () => { root.unmount(); });
  return html;
}

describe('the canvas start presents one primary path and a quieter secondary', () => {
  let html = '';
  before(async () => { html = await markup(); });

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

  it('states the composer path in words as well as offering it as a real action', () => {
    assert.ok(/describe your goal in the composer/i.test(html), 'the composer path is stated in words');
    assert.ok(/data-variant="describe-goal"[\s\S]*?Describe your goal/.test(html), 'and offered as a real start');
  });

  it('does not imply a project or capability already exists', () => {
    assert.ok(!/\d+\s+projects?\b/i.test(html), 'no fabricated project count');
    assert.ok(!/connected|available now|active/i.test(html), 'no invented status');
  });
});

describe('the start actions invoke their handlers', () => {
  it('routes primary to choose-project and secondary to connect-capability', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const win = installDom();
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');

    let chose = 0;
    let connected = 0;
    let described = 0;
    const container = win.document.createElement('div');
    win.document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(CanvasStart, {
        onChooseProject: () => { chose += 1; },
        onConnectCapability: () => { connected += 1; },
        onDescribeGoal: () => { described += 1; },
      }));
    });
    const primary = container.querySelector('[data-variant="primary"]') as HTMLButtonElement;
    const secondary = container.querySelector('[data-variant="secondary"]') as HTMLButtonElement;
    const describe = container.querySelector('[data-variant="describe-goal"]') as HTMLButtonElement;
    assert.ok(primary && secondary && describe, 'all three actions render');
    await act(async () => { primary.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); });
    await act(async () => { secondary.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); });
    await act(async () => { describe.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); });
    assert.strictEqual(chose, 1, 'primary chose a project');
    assert.strictEqual(connected, 1, 'secondary connected a capability');
    assert.strictEqual(described, 1, 'the third start moves focus to the composer');
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
      // Filter out CSS variable references like rgba(var(--panetera-...), ...)
      const rawLiterals = literals.filter((l) => !l.includes('var(--panetera-'));
      assert.deepStrictEqual(rawLiterals, [], `unexpected colour literals: ${rawLiterals.join(', ')}`);
    });
  }
});
