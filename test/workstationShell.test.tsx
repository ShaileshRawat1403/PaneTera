import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { WorkstationShell } from '../src/components/workstation/WorkstationShell';
import type { GovernanceSummary } from '../src/components/workstation/WorkstationShell';
import { extractWebPreviewRequest, isPublicWebPreviewUrl, resolvePublicWebPreviewSandbox, resolveWebPreviewIntent } from '../src/utils/webPreviewIntent';
import { resolveConversationRoute } from '../src/utils/paneteraIntent';
import { status as statusTokens } from '../src/theme/tokens';

describe('Website preview intent', () => {
  it('normalizes explicit website requests without requiring a workspace', () => {
    assert.deepStrictEqual(extractWebPreviewRequest('show me the website pruningmypothos.com'), {
      url: 'https://pruningmypothos.com/',
      name: 'pruningmypothos.com',
    });
    assert.deepStrictEqual(extractWebPreviewRequest('open https://example.com/docs'), {
      url: 'https://example.com/docs',
      name: 'example.com',
    });
  });

  it('does not hijack ordinary conversation that merely mentions a domain', () => {
    assert.strictEqual(extractWebPreviewRequest('what is the architecture of example.com?'), null);
    assert.strictEqual(extractWebPreviewRequest('explain this repository'), null);
  });

  it('rejects credential-bearing and unsupported URLs', () => {
    assert.strictEqual(extractWebPreviewRequest('open https://user:pass@example.com'), null);
    assert.strictEqual(extractWebPreviewRequest('open file:///etc/passwd'), null);
  });

  it('asks for the missing URL instead of requesting a workspace', () => {
    assert.deepStrictEqual(resolveWebPreviewIntent('can you open a webpage'), { kind: 'clarify' });
    assert.deepStrictEqual(resolveWebPreviewIntent('close the website preview'), { kind: 'close' });
    assert.deepStrictEqual(resolveWebPreviewIntent('reload it', true), { kind: 'reload' });
    assert.strictEqual(resolveWebPreviewIntent('reload it', false), null);
  });

  it('permits public cross-origin identity but rejects local and private targets', () => {
    assert.strictEqual(isPublicWebPreviewUrl('https://pruningmypothos.com/'), true);
    assert.strictEqual(isPublicWebPreviewUrl('http://localhost:4173/'), false);
    assert.strictEqual(isPublicWebPreviewUrl('http://127.0.0.1:4173/'), false);
    assert.strictEqual(isPublicWebPreviewUrl('http://192.168.1.20/'), false);
    assert.ok(resolvePublicWebPreviewSandbox('https://pruningmypothos.com/', 'http://localhost:5173')?.includes('allow-same-origin'));
    assert.strictEqual(resolvePublicWebPreviewSandbox('http://localhost:5173/', 'http://localhost:5173'), null);
  });
});

describe('Conversation intent routing', () => {
  it('keeps general conversation out of repository inspection', () => {
    assert.strictEqual(resolveConversationRoute('What can you help me with?', { hasWorkspace: false, hasSelectedFile: false }), 'general');
    assert.strictEqual(resolveConversationRoute('Explain the philosophy of language', { hasWorkspace: true, hasSelectedFile: false }), 'general');
  });

  it('routes explicit project work to the governed workspace orchestrator', () => {
    assert.strictEqual(resolveConversationRoute('show git status', { hasWorkspace: true, hasSelectedFile: false }), 'workspace');
    assert.strictEqual(resolveConversationRoute('explain this file', { hasWorkspace: true, hasSelectedFile: true }), 'workspace');
  });
});

describe('WorkstationShell Structural Markup', () => {
  const dummyGovernance: GovernanceSummary = {
    gatewayConnected: true,
    activeWorkspaceName: 'Test Workspace',
    policyActive: true,
    portalAuthValid: true,
    workspaceCatalogCount: 1,
    localAdapterActive: true,
    liveAppUrlReachable: true,
    liveAppManifestAvailable: true,
  };

  const renderShell = (canvasContent: React.ReactNode) => {
    const html = ReactDOMServer.renderToString(
      <WorkstationShell
        conversation={<div id="test-conversation-stub">Conversation</div>}
        canvas={canvasContent}
        renderActivity={() => <div id="test-activity-stub">Activity</div>}
        renderWorkspaceSelector={() => <div id="test-workspace-stub">Workspace</div>}
        governanceStatus={dummyGovernance}
        onOpenAudit={() => {}}
      />
    );
    return html;
  };

  it('renders correctly with native stub', () => {
    const html = renderShell(<div id="native-stub">Native Surface</div>);

    // Labelled aside for PaneTera conversation
    assert.ok(html.includes('aria-label="PaneTera conversation"'), 'labelled aside exists');

    // Exactly one labelled main canvas
    const mainMatches = html.match(/<main[^>]*>/g);
    assert.strictEqual(mainMatches?.length, 1, 'exactly one main element exists');
    assert.ok(mainMatches[0].includes('aria-label="PaneTera main canvas"'), 'main has correct label');
    assert.ok(mainMatches[0].includes('data-testid="workstation-canvas"'), 'main has correct testid');

    // Activity toggle closed initially
    assert.ok(html.includes('aria-expanded="false"'), 'activity reports aria-expanded=false');
    assert.ok(html.includes('aria-controls="activity-drawer"'), 'activity reports aria-controls');

    // Drawer is not visibly open (MUI Drawer hides contents when open={false} or uses a hidden modal)
    // We check that the stub content inside main is correctly placed.

    // Native stub inside main
    const mainContentRegex = /<main[^>]*>.*?<div id="native-stub".*?<\/main>/;
    assert.ok(mainContentRegex.test(html), 'native stub renders inside main canvas');

    // No stub in conversation or activity (outside main)
    const outsideMainMatches = html.replace(mainContentRegex, '<main></main>');
    assert.ok(!outsideMainMatches.includes('native-stub'), 'native stub does not leak outside main');
  });

  it('renders correctly with live stub', () => {
    const html = renderShell(<iframe id="live-stub" src="http://localhost:3001"></iframe>);

    const mainMatches = html.match(/<main[^>]*>/g);
    assert.strictEqual(mainMatches?.length, 1, 'exactly one main element exists');

    const mainContentRegex = /<main[^>]*>.*?<iframe id="live-stub".*?<\/main>/;
    assert.ok(mainContentRegex.test(html), 'live stub renders inside main canvas');

    const outsideMainMatches = html.replace(mainContentRegex, '<main></main>');
    assert.ok(!outsideMainMatches.includes('live-stub'), 'live stub does not leak outside main');
  });
});

describe('App workstation slot integration contract', () => {
  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const shellStart = appSource.indexOf('const governanceSummary =');
  const shellEnd = appSource.indexOf('})()}', shellStart);
  const shellSource = appSource.slice(shellStart, shellEnd);

  it('contains only the canonical workstation shell', () => {
    assert.ok(shellStart > -1 && shellEnd > shellStart, 'workstation application branch is present');
    assert.ok(appSource.includes('renderChatTranscript()'), 'workstation reuses the compact transcript');
    assert.ok(!appSource.includes('mainWorkbenchContent'), 'legacy workstation has been removed');
    assert.ok(!shellSource.includes('component="main"'), 'workstation does not create a nested main landmark');
  });

  it('routes existing native, active-card, and local-app renderers into one canvas slot', () => {
    assert.ok(shellSource.includes('<WebPreviewSurface'), 'website requests use the canvas preview');
    assert.ok(shellSource.includes('renderActiveCard()'), 'active cards use the existing renderer');
    assert.ok(shellSource.includes('renderActiveWorkspaceWorkbench()'), 'workspaces use the existing renderer');
    assert.ok(shellSource.includes('<WorkbenchEmptyState'), 'local-app empty state remains wired');
    assert.ok(shellSource.includes('<WorkbenchFailureState'), 'local-app failure state remains wired');
    assert.ok(shellSource.includes('<LiveWorkbenchSurface'), 'reachable local-app surface remains wired');
    assert.ok(shellSource.includes('canvas={canvasNode}'), 'selected content targets the shell canvas slot');
  });
});

describe('Workstation frame follows the contract palette', () => {
  const baseStatus: GovernanceSummary = {
    gatewayConnected: true,
    activeWorkspaceName: 'PaneTera',
    policyActive: true,
    portalAuthValid: true,
    workspaceCatalogCount: 3,
    localAdapterActive: true,
    liveAppUrlReachable: true,
    liveAppManifestAvailable: true,
  };

  function renderShell(status: GovernanceSummary): string {
    return ReactDOMServer.renderToStaticMarkup(
      React.createElement(WorkstationShell, {
        conversation: React.createElement('div', null, 'conversation'),
        canvas: React.createElement('div', null, 'canvas'),
        renderActivity: () => React.createElement('div', null, 'activity'),
        renderWorkspaceSelector: () => React.createElement('div', null, 'workspaces'),
        governanceStatus: status,
        onOpenAudit: () => {},
      }),
    );
  }

  it('shows a healthy gateway as neutral, never green', () => {
    // The contract reserves green for meaningful success. A connection that is
    // merely working is the absence of a problem, not an achievement.
    const html = renderShell(baseStatus);
    assert.ok(html.includes(statusTokens.neutral), 'connected state should use the neutral token');
    assert.ok(!html.includes(statusTokens.success), 'connected state must not use the success token');
  });

  it('shows an unreachable gateway as a failure', () => {
    const html = renderShell({ ...baseStatus, gatewayConnected: false });
    assert.ok(html.includes(statusTokens.danger));
  });

  it('labels the gateway indicator for assistive technology', () => {
    const html = renderShell(baseStatus);
    assert.ok(html.includes('aria-label="Gateway connected"'));
  });

  it('keeps the canvas free of decorative texture', () => {
    // A grid and a violet bloom behind the authoritative surface competed with
    // its contents and carried no information.
    //
    // Asserted against any gradient function and any non-none background-image,
    // not just the two forms that were removed. The earlier version matched
    // `radial-gradient` and `linear-gradient(rgba` specifically, so a conic
    // gradient, a `repeating-linear-gradient`, a hex-valued linear gradient, or
    // a background image URL would all have reintroduced texture unnoticed.
    const html = renderShell(baseStatus);

    const gradients = html.match(/[a-z-]*gradient\(/gi) ?? [];
    assert.deepStrictEqual(gradients, [], `unexpected gradients: ${gradients.join(', ')}`);

    const backgroundImages = (html.match(/background-image\s*:\s*([^;"]+)/gi) ?? []).filter(
      (declaration) => !/:\s*none\s*$/i.test(declaration),
    );
    assert.deepStrictEqual(
      backgroundImages,
      [],
      `background-image must be none: ${backgroundImages.join(', ')}`,
    );

    assert.ok(!/url\(/i.test(html), 'no image assets behind the canvas');
  });

  it('marks the canvas and conversation as landmarks', () => {
    const html = renderShell(baseStatus);
    assert.ok(html.includes('aria-label="PaneTera main canvas"'));
    assert.ok(html.includes('aria-label="PaneTera conversation"'));
  });
});
