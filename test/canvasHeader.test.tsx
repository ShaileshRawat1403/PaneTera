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
  it('renders top bar with glassmorphic backdrop-filter and Quick Switcher trigger', () => {
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

    // 1. Header backdrop filter
    assert.ok(html.includes('backdrop-filter:blur(12px)'), 'Should contain backdrop-filter blur(12px)');

    // 2. Quick Switcher trigger button with ⌘K badge
    assert.ok(html.includes('aria-label="Open quick switcher"'), 'Should contain Quick Switcher trigger aria-label');
    assert.ok(html.includes('⌘K'), 'Should display ⌘K shortcut badge');

    // 3. Contextual drawer toggle buttons
    assert.ok(html.includes('aria-label="Toggle Headroom drawer"'), 'Should contain Headroom toggle button');
    assert.ok(html.includes('aria-label="Toggle Rig drawer"'), 'Should contain Rig toggle button');
    assert.ok(html.includes('aria-label="Toggle activity drawer"'), 'Should contain Activity toggle button');
  });
});
