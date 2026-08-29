// test/surfaceHost.test.tsx
//
// SurfaceHost, and the adapter that feeds the browser branch.
//
// Two things are under test:
//   1. The host composes one header with a body, owns nothing, and executes
//      nothing.
//   2. App state reaches the descriptor without losing or inventing anything --
//      the last unproven hop between the browser's source of truth and what a
//      person is shown about it.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SurfaceHost } from '../src/components/surfaces/SurfaceHost';
import { WebPreviewSurface } from '../src/components/workbench/WebPreviewSurface';
import { browserSourceState } from '../src/surfaces/browserSource';
import { projectBrowserSurface, projectLocalAppSurface } from '../src/surfaces/projectSurface';
import type { BrowserFrameState } from '../src/surfaces/projectSurface';
import type { SurfaceDescriptor } from '../src/surfaces/types';

function makeDescriptor(overrides?: Partial<SurfaceDescriptor>): SurfaceDescriptor {
  return {
    id: 'surface-1',
    kind: 'browser',
    identity: { title: 'Example Pricing', subtitle: 'https://example.com/pricing' },
    state: { presence: 'live' },
    actions: [],
    view: { canSplit: true, canClose: true },
    renderer: { type: 'browser-observation', payload: {} },
    ...overrides,
  };
}

const frame: BrowserFrameState = {
  sessionId: 'session-abc',
  title: 'Example Pricing Page',
  url: 'https://example.com/pricing',
  screenshotDataUrl: 'data:image/jpeg;base64,/9j/fake==',
  viewport: { width: 1280, height: 800 },
  capturedAt: '2026-08-29T10:00:00.000Z',
};

describe('SurfaceHost — composition', () => {
  it('renders exactly one header above the body', () => {
    // The failure this guards against is additive migration: a surface keeping
    // its bespoke chrome and gaining the shared header, so identity is stated
    // twice and the canvas loses height instead of gaining it.
    const html = renderToStaticMarkup(
      <SurfaceHost descriptor={makeDescriptor()}>
        <div>body content</div>
      </SurfaceHost>,
    );

    const headers = html.split('surface header').length - 1;
    assert.strictEqual(headers, 1, 'one header, not two');
    assert.ok(html.includes('body content'), 'the body is rendered');
    assert.ok(html.includes('data-testid="surface-host"'));
  });

  it('carries the descriptor identity into the frame', () => {
    const html = renderToStaticMarkup(
      <SurfaceHost descriptor={makeDescriptor({ kind: 'mcp', id: 'reaper-1' })}>
        <div />
      </SurfaceHost>,
    );
    assert.ok(html.includes('data-surface-kind="mcp"'));
    assert.ok(html.includes('data-surface-id="reaper-1"'));
  });

  it('states presence from the descriptor, not from the body', () => {
    const html = renderToStaticMarkup(
      <SurfaceHost descriptor={makeDescriptor({ state: { presence: 'snapshot' } })}>
        <div>body</div>
      </SurfaceHost>,
    );
    assert.ok(html.includes('Snapshot'));
    assert.ok(!html.includes('Live'));
  });

  it('holds no state and reaches for nothing', () => {
    // Enforced against source: the host is a composition point, and the moment
    // it can fetch or remember it stops being one.
    const source = readFileSync(
      new URL('../src/components/surfaces/SurfaceHost.tsx', import.meta.url),
      'utf8',
    );
    for (const forbidden of ['fetch(', 'useState', 'useEffect', 'useReducer', 'localStorage']) {
      assert.ok(!source.includes(forbidden), `SurfaceHost must not use ${forbidden}`);
    }
  });

  it('is deterministic for a given descriptor', () => {
    const descriptor = makeDescriptor();
    const body = <div>same</div>;
    assert.strictEqual(
      renderToStaticMarkup(<SurfaceHost descriptor={descriptor}>{body}</SurfaceHost>),
      renderToStaticMarkup(<SurfaceHost descriptor={descriptor}>{body}</SurfaceHost>),
    );
  });
});

describe('browserSourceState — App state to projection input', () => {
  const paired = { paired: true, extensionAvailable: true };

  it('carries the frame only from the live case', () => {
    // The one that matters. A frame read from any other case would present a
    // stale capture as the current page.
    assert.strictEqual(
      browserSourceState({ request: null, inspection: { kind: 'live', frame }, pairing: paired }).frame,
      frame,
    );

    for (const inspection of [
      { kind: 'idle' as const },
      { kind: 'requesting' as const },
      { kind: 'evidence' as const },
      { kind: 'error' as const, detail: 'boom' },
    ]) {
      assert.strictEqual(
        browserSourceState({ request: null, inspection, pairing: paired }).frame,
        undefined,
        `${inspection.kind} carries no frame`,
      );
    }
  });

  it('passes the inspection kind through unchanged', () => {
    for (const kind of ['idle', 'requesting', 'live', 'evidence', 'error'] as const) {
      const inspection = kind === 'live' ? { kind, frame } : { kind };
      const state = browserSourceState({ request: null, inspection, pairing: paired });
      assert.strictEqual(state.inspectionKind, kind);
    }
  });

  it('keeps both halves of the pairing state distinct', () => {
    // An unavailable extension and an available-but-unpaired one are different
    // surfaces. Collapsing them makes a missing extension look like a refusal.
    const noExtension = browserSourceState({
      request: null,
      inspection: { kind: 'idle' },
      pairing: { paired: false, extensionAvailable: false },
    });
    const notPaired = browserSourceState({
      request: null,
      inspection: { kind: 'idle' },
      pairing: { paired: false, extensionAvailable: true },
    });

    assert.strictEqual(projectBrowserSurface(noExtension).state.presence, 'unavailable');
    assert.strictEqual(projectBrowserSurface(notPaired).state.presence, 'disconnected');
  });

  it('treats a missing request as absent rather than empty', () => {
    for (const request of [null, undefined]) {
      assert.strictEqual(
        browserSourceState({ request, inspection: { kind: 'idle' }, pairing: paired }).request,
        undefined,
      );
    }
  });

  it('copies only url and name from the request', () => {
    const state = browserSourceState({
      request: { url: 'https://example.com', name: 'Example', extra: 'ignored' } as never,
      inspection: { kind: 'idle' },
      pairing: paired,
    });
    assert.deepStrictEqual(state.request, { url: 'https://example.com', name: 'Example' });
  });
});

describe('the browser branch, end to end through the projection', () => {
  it('presents a live page as live, and says so in words', () => {
    const descriptor = projectBrowserSurface(
      browserSourceState({
        request: { url: 'https://example.com/pricing', name: 'Example Pricing' },
        inspection: { kind: 'live', frame },
        pairing: { paired: true, extensionAvailable: true },
      }),
    );

    assert.strictEqual(descriptor.state.presence, 'live');
    assert.strictEqual(descriptor.kind, 'browser');

    const html = renderToStaticMarkup(
      <SurfaceHost descriptor={descriptor}>
        <div>page</div>
      </SurfaceHost>,
    );
    assert.ok(html.includes('Live'));
    assert.ok(html.includes('Example Pricing Page'), 'the frame title wins over the request name');
  });

  it('never claims the page is verified just because it loaded', () => {
    const descriptor = projectBrowserSurface(
      browserSourceState({
        request: { url: 'https://example.com', name: 'Example' },
        inspection: { kind: 'live', frame },
        pairing: { paired: true, extensionAvailable: true },
      }),
    );
    assert.strictEqual(descriptor.state.integrity, undefined);

    const html = renderToStaticMarkup(
      <SurfaceHost descriptor={descriptor}>
        <div />
      </SurfaceHost>,
    );
    assert.ok(!html.includes('Verified'), 'a rendered page is not evidence');
  });

  it('offers only observe actions for a browser surface', () => {
    // Snapshot and inspect read the page. Nothing in this header can mutate
    // anything, so nothing here needs the governed path.
    const descriptor = projectBrowserSurface(
      browserSourceState({
        request: { url: 'https://example.com', name: 'Example' },
        inspection: { kind: 'live', frame },
        pairing: { paired: true, extensionAvailable: true },
      }),
    );

    assert.ok(descriptor.actions.length > 0, 'the surface offers tools');
    for (const action of descriptor.actions) {
      assert.strictEqual(action.behavior, 'observe', `${action.id} only reads`);
      assert.strictEqual(action.capabilityRef, undefined, 'no capability is referenced');
    }
  });
});

describe('WebPreviewSurface chrome seam', () => {
  it('draws its own header by default, and drops it when hosted', () => {
    // The seam that makes the migration safe. A caller that has not moved keeps
    // exactly what it had; the migrated branch gets the shared header instead
    // of in addition to its own.
    const own = renderToStaticMarkup(
      <WebPreviewSurface name="Example" url="https://example.com" onClose={() => {}} />,
    );
    assert.ok(own.includes('aria-label="Reload website preview"'), 'own chrome keeps its controls');
    assert.ok(own.includes('aria-label="Close website preview"'));
    assert.ok(own.includes('External · untrusted'));

    const hosted = renderToStaticMarkup(
      <WebPreviewSurface name="Example" url="https://example.com" onClose={() => {}} chrome="hosted" />,
    );
    assert.ok(!hosted.includes('aria-label="Reload website preview"'), 'hosted drops its own bar');
    assert.ok(!hosted.includes('aria-label="Close website preview"'));
  });

  it('states the page identity exactly once when hosted', () => {
    // Identity belongs to the descriptor now. Two copies would mean the
    // migration added a header rather than replacing one.
    const descriptor = projectBrowserSurface(
      browserSourceState({
        request: { url: 'https://example.com/pricing', name: 'Example Pricing' },
        inspection: { kind: 'idle' },
        pairing: { paired: true, extensionAvailable: true },
      }),
    );

    const html = renderToStaticMarkup(
      <SurfaceHost descriptor={descriptor} onClose={() => {}}>
        <WebPreviewSurface
          name="Example Pricing"
          url="https://example.com/pricing"
          onClose={() => {}}
          chrome="hosted"
        />
      </SurfaceHost>,
    );

    // Counting the name would be the wrong test: it legitimately appears in the
    // header's aria-label and in the probe's own status sentence ("Finding out
    // whether Example Pricing can be shown here"), neither of which is chrome.
    // What must be singular is the header itself and its controls.
    assert.strictEqual(
      html.split('data-testid="surface-presence"').length - 1,
      1,
      'exactly one header states the surface',
    );
    assert.ok(!html.includes('aria-label="Close website preview"'), 'no second close control');
    assert.ok(!html.includes('External · untrusted'), 'no second identity block');
    assert.ok(html.includes('Snapshot'), 'presence comes from the descriptor');
  });
});

describe('the local app branch, through the same host', () => {
  it('states the application and its address in one header', () => {
    const descriptor = projectLocalAppSurface({
      app: {
        appId: 'openpencil',
        name: 'OpenPencil',
        url: 'http://localhost:7001',
        enabled: true,
      },
      status: 'reachable',
    });

    const html = renderToStaticMarkup(
      <SurfaceHost descriptor={descriptor} onClose={() => {}}>
        <div>frame</div>
      </SurfaceHost>,
    );

    assert.ok(html.includes('OpenPencil'));
    assert.ok(html.includes('http://localhost:7001'));
    assert.ok(html.includes('Live'), 'a reachable app is live');
    assert.strictEqual(
      html.split('data-testid="surface-presence"').length - 1,
      1,
      'one header, as with the browser',
    );
  });

  it('offers its tools without offering anything governed', () => {
    const descriptor = projectLocalAppSurface({
      app: { appId: 'a', name: 'App', url: 'http://localhost:1', enabled: true },
      status: 'reachable',
    });

    const html = renderToStaticMarkup(
      <SurfaceHost descriptor={descriptor} onClose={() => {}}>
        <div />
      </SurfaceHost>,
    );

    assert.ok(html.includes('data-behavior="local-ui"'));
    assert.ok(!html.includes('data-behavior="propose"'), 'guide mode: nothing reaches the app');
    assert.ok(!html.includes('needs your approval'));
  });

  it('never claims a reachable application is verified', () => {
    // The distinction the whole colour contract rests on, restated for the
    // surface that most invites confusing the two.
    const descriptor = projectLocalAppSurface({
      app: { appId: 'a', name: 'App', url: 'http://localhost:1', enabled: true },
      status: 'reachable',
    });
    assert.strictEqual(descriptor.state.integrity, undefined);

    const html = renderToStaticMarkup(
      <SurfaceHost descriptor={descriptor}><div /></SurfaceHost>,
    );
    assert.ok(!html.includes('Verified'), 'reachable is not verified');
  });
});

describe('the migration is one branch, not a rewrite', () => {
  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  it('routes the browser branch through the host', () => {
    assert.ok(appSource.includes('<SurfaceHost'), 'the browser canvas is hosted');
    assert.ok(appSource.includes('projectBrowserSurface('), 'its header comes from the projection');
    assert.ok(appSource.includes('chrome="hosted"'), 'the bespoke browser header is suppressed');
  });

  it('leaves the remaining canvas branches alone', () => {
    // The handoff is explicit that this chain moves one branch at a time. The
    // others must still be reachable exactly as they were.
    for (const branch of [
      'WorkbenchEmptyState',
      'LiveWorkbenchSurface',
      'BrowserEvidenceCanvas',
      'renderActiveCard()',
      'renderActiveWorkspaceWorkbench()',
      'emptyCanvasNode',
    ]) {
      assert.ok(appSource.includes(branch), `${branch} still routes as before`);
    }

    const hosts = appSource.split('<SurfaceHost').length - 1;
    assert.strictEqual(hosts, 2, 'browser and local app have migrated; the rest have not');
    assert.ok(
      !appSource.includes('LiveWorkbenchToolbar'),
      'the local app bespoke toolbar is gone, replaced rather than stacked',
    );
  });
});
