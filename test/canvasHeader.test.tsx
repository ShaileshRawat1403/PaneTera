process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkstationShell, GovernanceSummary } from '../src/components/workstation/WorkstationShell';
import { density } from '../src/theme/tokens';

const dummyGovernanceStatus: GovernanceSummary = {
  gatewayConnected: true,
  activeWorkspaceName: 'PaneTera Workstation',
  policyActive: true,
  portalAuthValid: true,
  workspaceCatalogCount: 1,
  localAdapterActive: true,
  liveAppUrlReachable: true,
  liveAppManifestAvailable: true,
  currentObjective: 'UI/UX Elevation',
};

function renderShell(): string {
  return renderToStaticMarkup(
    <WorkstationShell
      conversation={<div>Conversation</div>}
      canvas={<div>Canvas</div>}
      renderActivity={() => <div>Activity</div>}
      renderWorkspaceSelector={() => <div>Workspace Selector</div>}
      renderRig={() => <div>Rig</div>}
      renderHeadroom={() => <div>Headroom</div>}
      governanceStatus={dummyGovernanceStatus}
      onOpenAudit={() => {}}
    />
  );
}

describe('WorkstationShell Canvas Header & Quick Switcher unit tests', () => {
  it('renders the top bar controls: quick switcher and every drawer toggle', () => {
    const html = renderShell();

    // Deliberately asserts no specific blur radius. The previous version
    // pinned `backdrop-filter:blur(12px)`; the shell now sets 24px, so the
    // test failed on a value it had no reason to own. A decorative constant
    // is not a contract -- it only obstructs the theme work that is meant to
    // revisit it. What the header owes its user is the controls below.

    // 1. Quick Switcher trigger button with ⌘K badge
    assert.ok(html.includes('aria-label="Open quick switcher"'), 'Should contain Quick Switcher trigger aria-label');
    assert.ok(html.includes('⌘K'), 'Should display ⌘K shortcut badge');

    // 2. Contextual drawer toggle buttons
    assert.ok(html.includes('aria-label="Toggle Headroom drawer"'), 'Should contain Headroom toggle button');
    assert.ok(html.includes('aria-label="Toggle Rig drawer"'), 'Should contain Rig toggle button');
    assert.ok(html.includes('aria-label="Toggle activity drawer"'), 'Should contain Activity toggle button');
    assert.ok(html.includes('aria-label="Open audit log"'), 'Should contain the audit log control');
  });

  it('spends one tier of chrome, not two', () => {
    // The shell used to render a 56px top bar above a 30px cockpit strip: 87px
    // before any work was visible. They carried one idea between them, so they
    // are one bar now. This asserts the count rather than the pixels, because
    // the height belongs to the density token and the token is free to change.
    const html = renderShell();
    // The pair is the bar's signature. A bare `min-height:44px` also appears on
    // controls under `@media (pointer: coarse)`, where it is the touch token
    // doing its job, so matching the loose value would count those too.
    const bars = html.split(`height:${density.bar}px;min-height:${density.bar}px`).length - 1;
    assert.strictEqual(bars, 1, 'exactly one chrome bar at the bar density');
    assert.ok(!html.includes('height:56px'), 'the old 56px top bar is gone');
    assert.ok(!html.includes('height:30px'), 'the old 30px cockpit strip is gone');
  });

  it('does not blur the canvas through its own chrome', () => {
    // The bar ran `blur(24px) saturate(180%)`, reading the canvas through the
    // chrome and tinting it -- exactly what the cool palette exists to stop.
    // The evidence ledger and drawer header were blurring behind opaque fills,
    // which cost a compositing layer and bought nothing.
    //
    // Not a blanket ban. A modal scrim legitimately blurs what is behind it,
    // because there the blur is the point. The line drawn here is that no
    // persistent chrome may, so the bound is on the heavy-glass signature
    // rather than on the property.
    const html = renderShell();
    assert.ok(!/saturate\(/i.test(html), 'no chrome fakes depth with saturation');
    assert.ok(
      !/backdrop-filter:\s*blur\((?:[1-9]\d)px\)/i.test(html),
      'no chrome blurs at 10px or more; only a modal scrim may blur at all',
    );
  });

  it('puts the drawers on a rail that is always reachable', () => {
    // The rail is what lets the bar be one tier, and it renders at every width
    // -- a drawer that disappears because the window got small is worse than
    // 44px of chrome.
    const html = renderShell();
    assert.ok(html.includes('aria-label="Workstation drawers"'), 'the rail is present');
    assert.ok(html.includes(`width:${density.rail}px`), 'the rail uses the rail density token');
  });

  it('keeps every bar height on the 4px grid', () => {
    // "Compact, minimal, quiet" is a claim about rhythm, and independent
    // literals are what destroy rhythm. paneSizing.ts already makes this
    // argument about widths.
    for (const [name, value] of Object.entries(density)) {
      assert.strictEqual(value % 4, 0, `density.${name} (${value}) is off the 4px grid`);
    }
  });
});
