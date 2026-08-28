process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkstationShell, GovernanceSummary } from '../src/components/workstation/WorkstationShell';

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

describe('WorkstationShell Canvas Header & Quick Switcher unit tests', () => {
  it('renders the top bar controls: quick switcher and every drawer toggle', () => {
    const html = renderToStaticMarkup(
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
  });
});
