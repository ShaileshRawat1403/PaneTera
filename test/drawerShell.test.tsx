// test/drawerShell.test.tsx
//
// Tests for the shared governance-drawer shell. They assert the consistent shell
// grammar the Rig and Headroom drawers now share — a labelled region, an h6 title
// with an optional description, right-aligned Refresh (optional) and Close with
// explicit accessible names, a fixed header while only the body scrolls, and
// keyboard order that matches the visual hierarchy. For the drawer itself, this file
// proves only what jsdom can prove faithfully: the trigger opens the Rig drawer as a
// labelled Modal region, and Escape routes through the Modal's onClose to close it.
// Focus trapping into the open drawer and focus restoration to the trigger on close
// depend on real element geometry and MUI's live FocusTrap, so they are verified in
// real Chrome (including a disableRestoreFocus mutation), not asserted here.
//
// Everything is mounted (no SSR), and every test requires genuinely zero React
// warnings. That is possible because ./domEnv installs the DOM before @mui is
// imported; see that file for why import order — not a suppression filter — is what
// keeps the emotion ref-forwarding warnings from appearing.

process.env.NODE_ENV = 'test';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// MUST precede every @mui import (directly here and transitively via the components).
import { installDom } from './domEnv';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import React from 'react';
import * as ReactTransitionGroup from 'react-transition-group';
import { DrawerShell } from '../src/components/workstation/DrawerShell';
import { WorkstationShell, type GovernanceSummary } from '../src/components/workstation/WorkstationShell';

// Test-harness shim, scoped to this file's process. MUI's temporary Drawer animates
// its Paper with a Slide transition whose enter/exit handlers call reflow(node) —
// node.scrollTop — on mount. Under jsdom the transition node resolves null, so the
// Paper never mounts and any Drawer test would crash before it began (verified with
// a bare <Drawer open/> probe). Neutralising the reflow step lets the *real* MUI
// Modal mount, so the open / Escape-close semantics — which come from the Modal, not
// the animation — can be exercised. It changes nothing about that behaviour; it only
// skips the layout reflow jsdom cannot perform.
{
  const proto = (ReactTransitionGroup.Transition as unknown as {
    prototype: { performEnter: (...a: unknown[]) => void; performExit: (...a: unknown[]) => void };
  }).prototype;
  proto.performEnter = function (this: { setState: (s: unknown) => void }) { this.setState({ status: 'entered' }); };
  proto.performExit = function (this: { setState: (s: unknown, cb?: () => void) => void; props: { onExited?: (n?: unknown) => void } }) {
    this.setState({ status: 'exited' }, () => { this.props.onExited?.(); });
  };
}

/** Run a mounted body with console.error captured, asserting no React warnings. */
async function mounted(body: (ctx: Awaited<ReturnType<typeof setup>>) => Promise<void>) {
  const warns: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { warns.push(args.map(String).join(' ')); };
  const ctx = await setup();
  try {
    await body(ctx);
    await ctx.act(async () => { ctx.root.unmount(); });
  } finally {
    console.error = original;
  }
  // Genuinely zero React warnings. No filter: ./domEnv installs the DOM before @mui
  // is imported, so the emotion ref-forwarding warnings never fire in the first place.
  const real = warns.filter((w) => /Warning:/.test(w));
  assert.deepStrictEqual(real, [], `unexpected warnings:\n${warns.join('\n')}`);
}

async function setup() {
  const win = installDom();
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const container = win.document.createElement('div');
  win.document.body.appendChild(container);
  const root = createRoot(container);
  const render = (node: React.ReactElement) => act(async () => { root.render(node); });
  return { win, act, root, container, render };
}

const shell = (props: Partial<React.ComponentProps<typeof DrawerShell>> = {}) =>
  React.createElement(DrawerShell, {
    titleId: 't-1', title: 'Rig', description: 'Governed connections.',
    onClose: () => {}, closeLabel: 'Close Rig',
    children: React.createElement('div', { id: 'body' }, 'content'),
    ...props,
  });

describe('the drawer shell renders a consistent, accessible header', () => {
  it('labels the region by its h6 title and names Close, omitting Refresh by default', () => mounted(async (c) => {
    await c.render(shell());
    const html = c.container.innerHTML;
    assert.ok(/<section[^>]*aria-labelledby="t-1"/.test(html), 'the region is labelled by the title');
    assert.ok(/<h6[^>]*id="t-1"[^>]*>Rig<\/h6>/.test(html), 'the title is an h6 with the referenced id');
    assert.ok(html.includes('Governed connections.'), 'the description renders');
    assert.ok(c.container.querySelector('button[aria-label="Close Rig"]'), 'Close is named');
    assert.ok(!c.container.querySelector('button[aria-label^="Refresh"]'), 'no Refresh unless requested');
  }));

  it('renders Refresh with its own accessible name and disables it while refreshing', () => mounted(async (c) => {
    await c.render(shell({ onRefresh: () => {}, refreshLabel: 'Refresh Rig connections', refreshing: true }));
    const refresh = c.container.querySelector('button[aria-label="Refresh Rig connections"]') as HTMLButtonElement;
    assert.ok(refresh, 'Refresh is named');
    assert.ok(c.container.textContent?.includes('Refreshing…'), 'the in-flight state is disclosed');
    assert.strictEqual(refresh.disabled, true, 'Refresh is disabled while refreshing');
  }));
});

describe('the shell is keyboard-reachable in visual order', () => {
  it('renders Refresh and Close as native buttons before the body content', () => mounted(async (c) => {
    await c.render(shell({
      onRefresh: () => {}, refreshLabel: 'Refresh Rig connections',
      children: React.createElement('button', { id: 'body-action' }, 'Body action'),
    }));
    const buttons = [...c.container.querySelectorAll('button')] as HTMLButtonElement[];
    const refreshIdx = buttons.findIndex((b) => b.getAttribute('aria-label') === 'Refresh Rig connections');
    const closeIdx = buttons.findIndex((b) => b.getAttribute('aria-label') === 'Close Rig');
    const bodyIdx = buttons.findIndex((b) => b.id === 'body-action');
    assert.ok(refreshIdx >= 0 && closeIdx >= 0 && bodyIdx >= 0, 'all controls present');
    assert.ok(refreshIdx < bodyIdx && closeIdx < bodyIdx, 'header actions precede body controls in tab order');
    assert.ok(buttons.every((b) => b.tagName === 'BUTTON'), 'controls are native buttons');
    assert.strictEqual(buttons[closeIdx].disabled, false, 'Close is focusable');
  }));
});

describe('only the body scrolls; the header is a fixed sibling', () => {
  it('puts the header and the scroll body as separate section children, and Close invokes its handler', () => mounted(async (c) => {
    let closed = 0;
    await c.render(shell({ onClose: () => { closed += 1; } }));
    const section = c.container.querySelector('section')!;
    const header = section.querySelector('header')!;
    const body = c.container.querySelector('#body')!;
    assert.ok(!header.contains(body), 'the body is not inside the fixed header');
    const scrollBox = [...section.children].find((el) => el !== header && el.contains(body));
    assert.ok(scrollBox && !scrollBox.contains(header), 'a distinct scroll region wraps the body, not the header');
    const close = c.container.querySelector('button[aria-label="Close Rig"]') as HTMLButtonElement;
    assert.ok(header.contains(close), 'Close lives in the fixed header');
    await c.act(async () => { close.dispatchEvent(new c.win.MouseEvent('click', { bubbles: true })); });
    assert.strictEqual(closed, 1, 'clicking Close invokes the handler');
  }));
});

const governance: GovernanceSummary = {
  gatewayConnected: true, activeWorkspaceName: 'Test', policyActive: true, portalAuthValid: true,
  workspaceCatalogCount: 1, localAdapterActive: true, liveAppUrlReachable: true, liveAppManifestAvailable: true,
};

describe('the Rig drawer opens from its trigger and closes on Escape', () => {
  // What jsdom can prove: the toggle opens the Rig drawer as a labelled Modal region,
  // and Escape routes through the Modal's onClose to close it (drop that wiring and
  // this test fails). The focus half of the journey — autofocus/trap into the open
  // drawer and restore to the trigger on close — is layout- and browser-dependent
  // (MUI's FocusTrap needs real element geometry and its focus restore is inert under
  // jsdom, confirmed by probes), so it is verified in real Chrome, where the
  // disableRestoreFocus mutation is also shown to break focus-return.
  it('opens as a labelled region from the trigger and Escape closes it', () => mounted(async (c) => {
    await c.render(React.createElement(WorkstationShell, {
      conversation: React.createElement('div', null, 'conversation'),
      canvas: React.createElement('div', null, 'canvas'),
      renderActivity: () => React.createElement('div', null, 'activity'),
      renderWorkspaceSelector: () => React.createElement('div', null, 'workspace'),
      renderHeadroom: () => React.createElement('div', null, 'headroom'),
      renderRig: () => React.createElement('div', { id: 'rig-body' }, React.createElement('button', { id: 'rig-first' }, 'A Rig action')),
      governanceStatus: governance,
      onOpenAudit: () => {},
    }));
    const trigger = c.container.querySelector('button[aria-label="Toggle Rig drawer"]') as HTMLButtonElement;
    assert.ok(trigger, 'the Rig trigger exists with an accessible name');

    await c.act(async () => { trigger.dispatchEvent(new c.win.MouseEvent('click', { bubbles: true })); });
    const drawer = c.win.document.querySelector('[aria-label="Rig drawer"]');
    assert.ok(drawer, 'the Rig drawer opened as a labelled region');
    assert.strictEqual(drawer!.getAttribute('role'), 'region', 'the drawer is a named region');

    await c.act(async () => { drawer!.dispatchEvent(new c.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    assert.ok(!c.win.document.querySelector('[aria-label="Rig drawer"]'), 'Escape closed the drawer');
  }));
});

describe('the Rig and Headroom drawers route through the shared shell', () => {
  for (const file of ['src/components/rig/RigPanel.tsx', 'src/components/headroom/HeadroomPanel.tsx']) {
    it(`${file} uses DrawerShell`, () => {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      assert.ok(source.includes("from '../workstation/DrawerShell'"), 'imports the shell');
      assert.ok(source.includes('<DrawerShell'), 'renders the shell');
    });
  }
});
