// test/surfaceDescriptor.test.ts
//
// Focused unit tests for the SurfaceDescriptor contract and pure projections.
//
// Proves:
//   1. Browser source state projects deterministically.
//   2. Local app source state projects deterministically.
//   3. No projection mutates source input.
//   4. Connected/live does not imply verified integrity.
//   5. Actions contain metadata only, no execution callbacks.
//   6. Descriptor does not contain ReactNode/render functions.
//   7. Unavailable local app maps truthfully to unavailable/disconnected.
//   8. Transport details are not leaked into the descriptor.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  projectBrowserSurface,
  projectLocalAppSurface,
} from '../src/surfaces/projectSurface';
import type {
  BrowserSourceState,
  LocalAppSourceState,
} from '../src/surfaces/projectSurface';
import type {
  SurfaceDescriptor,
  SurfaceAction,
} from '../src/surfaces/types';

// ─── Fixtures ─────────────────────────────────────────────────────

function makeBrowserSource(overrides?: Partial<BrowserSourceState>): BrowserSourceState {
  return {
    pairing: { paired: true, extensionAvailable: true },
    request: { url: 'https://example.com/pricing', name: 'Example Pricing' },
    frame: {
      sessionId: 'session-abc',
      title: 'Example Pricing Page',
      url: 'https://example.com/pricing',
      screenshotDataUrl: 'data:image/jpeg;base64,/9j/fakedata==',
      viewport: { width: 1280, height: 800 },
      capturedAt: '2026-08-27T12:00:00.000Z',
    },
    inspectedComponent: {
      tagName: 'section',
      id: 'pricing-plans',
      classNames: ['py-16', 'bg-slate-950'],
      role: 'region',
      text: 'Plans that scale with your work',
      path: 'html > body > main > section#pricing-plans',
      rect: { x: 0, y: 400, width: 1280, height: 642 },
      attributes: { 'data-testid': 'pricing' },
    },
    inspectionKind: 'live',
    ...overrides,
  };
}

function makeLocalAppSource(overrides?: Partial<LocalAppSourceState>): LocalAppSourceState {
  return {
    app: {
      appId: 'openpencil-001',
      name: 'OpenPencil',
      url: 'http://127.0.0.1:4000',
      description: 'Open-source vector drawing',
      enabled: true,
    },
    status: 'reachable',
    ...overrides,
  };
}

// ─── Helper: assert no execution callbacks in descriptor ──────────

function assertNoCallbacks(descriptor: SurfaceDescriptor): void {
  // Walk every action and verify no function-valued properties.
  for (const action of descriptor.actions) {
    for (const [key, value] of Object.entries(action)) {
      assert.notStrictEqual(
        typeof value,
        'function',
        `SurfaceAction.${key} must not be a function; found one on action "${action.id}"`,
      );
    }
  }
}

function assertNoReactNodes(descriptor: SurfaceDescriptor): void {
  // A ReactNode would appear as an object with $$typeof or as a function.
  const serialized = JSON.stringify(descriptor);
  assert.ok(
    !serialized.includes('$$typeof'),
    'Descriptor must not contain React element markers ($$typeof)',
  );

  // Check identity.icon is a string or undefined, never a component.
  if (descriptor.identity.icon !== undefined) {
    assert.strictEqual(typeof descriptor.identity.icon, 'string', 'identity.icon must be a string identifier, not a React component');
  }

  // Check each action.icon is a string or undefined.
  for (const action of descriptor.actions) {
    if (action.icon !== undefined) {
      assert.strictEqual(typeof action.icon, 'string', `action "${action.id}" icon must be a string identifier`);
    }
  }

  // Check renderer.payload does not contain functions.
  const payloadStr = JSON.stringify(descriptor.renderer.payload);
  assert.ok(payloadStr !== undefined, 'renderer.payload must be serializable');
}

// ─── Browser Projection Tests ─────────────────────────────────────

describe('projectBrowserSurface', () => {

  it('projects a live paired browser deterministically', () => {
    const source = makeBrowserSource();
    const d1 = projectBrowserSurface(source);
    const d2 = projectBrowserSurface(source);
    assert.deepStrictEqual(d1, d2, 'Same input must produce identical output');
  });

  it('derives correct identity from live frame', () => {
    const source = makeBrowserSource();
    const d = projectBrowserSurface(source);
    assert.strictEqual(d.kind, 'browser');
    assert.strictEqual(d.identity.title, 'Example Pricing Page');
    assert.strictEqual(d.identity.subtitle, 'https://example.com/pricing');
    assert.strictEqual(d.identity.icon, 'globe');
  });

  it('falls back to request name/url when no frame', () => {
    const source = makeBrowserSource({ frame: undefined, inspectionKind: 'idle' });
    const d = projectBrowserSurface(source);
    assert.strictEqual(d.identity.title, 'Example Pricing');
    assert.strictEqual(d.identity.subtitle, 'https://example.com/pricing');
  });

  it('falls back to "Browser" when no frame and no request', () => {
    const source = makeBrowserSource({ frame: undefined, request: undefined, inspectionKind: 'idle' });
    const d = projectBrowserSurface(source);
    assert.strictEqual(d.identity.title, 'Browser');
    assert.strictEqual(d.identity.subtitle, undefined);
  });

  it('derives presence=live when paired with live frame', () => {
    const source = makeBrowserSource();
    const d = projectBrowserSurface(source);
    assert.strictEqual(d.state.presence, 'live');
  });

  it('derives presence=snapshot for evidence inspection', () => {
    const source = makeBrowserSource({ inspectionKind: 'evidence', frame: undefined });
    const d = projectBrowserSurface(source);
    assert.strictEqual(d.state.presence, 'snapshot');
  });

  it('derives presence=snapshot when idle with a request but no frame', () => {
    const source = makeBrowserSource({ inspectionKind: 'idle', frame: undefined });
    const d = projectBrowserSurface(source);
    assert.strictEqual(d.state.presence, 'snapshot');
  });

  it('derives presence=unavailable while requesting with no frame yet', () => {
    // A pending request is not proof of a usable live surface.
    const source = makeBrowserSource({ inspectionKind: 'requesting', frame: undefined });
    const d = projectBrowserSurface(source);
    assert.strictEqual(d.state.presence, 'unavailable');
  });

  it('derives presence=snapshot while requesting over a stale frame', () => {
    // The prior frame is still on screen but is no longer proven live.
    const source = makeBrowserSource({ inspectionKind: 'requesting' });
    const d = projectBrowserSurface(source);
    assert.strictEqual(d.state.presence, 'snapshot');
  });

  it('never derives presence=live without an actual captured frame', () => {
    const kinds = ['idle', 'requesting', 'live', 'evidence', 'error'] as const;
    for (const inspectionKind of kinds) {
      const d = projectBrowserSurface(makeBrowserSource({ inspectionKind, frame: undefined }));
      assert.notStrictEqual(
        d.state.presence,
        'live',
        `inspectionKind "${inspectionKind}" must not claim live without a frame`,
      );
    }
  });

  it('derives presence=disconnected when paired but no frame and no request', () => {
    const source = makeBrowserSource({ frame: undefined, request: undefined, inspectionKind: 'idle' });
    const d = projectBrowserSurface(source);
    assert.strictEqual(d.state.presence, 'disconnected');
  });

  it('derives presence=disconnected when not paired', () => {
    const source = makeBrowserSource({
      pairing: { paired: false, extensionAvailable: true },
    });
    const d = projectBrowserSurface(source);
    assert.strictEqual(d.state.presence, 'disconnected');
  });

  it('derives presence=unavailable when extension not available', () => {
    const source = makeBrowserSource({
      pairing: { paired: false, extensionAvailable: false },
    });
    const d = projectBrowserSurface(source);
    assert.strictEqual(d.state.presence, 'unavailable');
  });

  it('live/paired does NOT imply verified integrity', () => {
    const source = makeBrowserSource();
    const d = projectBrowserSurface(source);
    assert.strictEqual(d.state.integrity, undefined, 'Browser surface must not claim verified integrity');
  });

  it('includes snapshot and inspect actions when paired with frame', () => {
    const source = makeBrowserSource();
    const d = projectBrowserSurface(source);
    assert.strictEqual(d.actions.length, 2);
    const ids = d.actions.map((a: SurfaceAction) => a.id);
    assert.ok(ids.includes('snapshot'), 'Must include snapshot action');
    assert.ok(ids.includes('inspect'), 'Must include inspect action');
  });

  it('snapshot and inspect actions use "observe" behavior', () => {
    const source = makeBrowserSource();
    const d = projectBrowserSurface(source);
    for (const action of d.actions) {
      assert.strictEqual(action.behavior, 'observe', `Browser action "${action.id}" must be observe, not propose`);
    }
  });

  it('has no actions when not paired', () => {
    const source = makeBrowserSource({
      pairing: { paired: false, extensionAvailable: true },
    });
    const d = projectBrowserSurface(source);
    assert.strictEqual(d.actions.length, 0);
  });

  it('uses browser-observation renderer type', () => {
    const source = makeBrowserSource();
    const d = projectBrowserSurface(source);
    assert.strictEqual(d.renderer.type, 'browser-observation');
  });

  it('includes viewport dimensions in view mode', () => {
    const source = makeBrowserSource();
    const d = projectBrowserSurface(source);
    assert.strictEqual(d.view?.mode, '1280×800');
  });

  it('does not mutate the source input', () => {
    const source = makeBrowserSource();
    const sourceCopy = JSON.parse(JSON.stringify(source));
    projectBrowserSurface(source);
    assert.deepStrictEqual(source, sourceCopy, 'Source must not be mutated');
  });

  it('actions contain metadata only, no execution callbacks', () => {
    const source = makeBrowserSource();
    const d = projectBrowserSurface(source);
    assertNoCallbacks(d);
  });

  it('descriptor does not contain ReactNode or render functions', () => {
    const source = makeBrowserSource();
    const d = projectBrowserSurface(source);
    assertNoReactNodes(d);
  });

  it('renderer payload includes screenshotDataUrl for self-contained rendering', () => {
    const source = makeBrowserSource();
    const d = projectBrowserSurface(source);
    const payload = d.renderer.payload as Record<string, unknown>;
    assert.strictEqual(
      payload.screenshotDataUrl,
      'data:image/jpeg;base64,/9j/fakedata==',
      'Renderer payload must include screenshotDataUrl for self-contained rendering',
    );
  });

  it('renderer payload includes inspected component metadata', () => {
    const source = makeBrowserSource();
    const d = projectBrowserSurface(source);
    const payload = d.renderer.payload as Record<string, unknown>;
    const comp = payload.inspectedComponent as Record<string, unknown>;
    assert.ok(comp, 'Renderer payload must include inspectedComponent');
    assert.strictEqual(comp.tagName, 'section');
    assert.strictEqual(comp.id, 'pricing-plans');
    assert.strictEqual(comp.path, 'html > body > main > section#pricing-plans');
  });

  it('renderer payload is null for screenshotDataUrl when no frame', () => {
    const source = makeBrowserSource({ frame: undefined, inspectionKind: 'idle' });
    const d = projectBrowserSurface(source);
    const payload = d.renderer.payload as Record<string, unknown>;
    assert.strictEqual(payload.screenshotDataUrl, null);
  });

  it('renderer payload is null for inspectedComponent when none present', () => {
    const source = makeBrowserSource({ inspectedComponent: undefined });
    const d = projectBrowserSurface(source);
    const payload = d.renderer.payload as Record<string, unknown>;
    assert.strictEqual(payload.inspectedComponent, null);
  });

  it('renderer payload is sufficient to render without sideways App state access', () => {
    const source = makeBrowserSource();
    const d = projectBrowserSurface(source);
    const payload = d.renderer.payload as Record<string, unknown>;
    // All fields a browser-observation renderer would need:
    assert.ok('sessionId' in payload, 'must have sessionId');
    assert.ok('url' in payload, 'must have url');
    assert.ok('title' in payload, 'must have title');
    assert.ok('screenshotDataUrl' in payload, 'must have screenshotDataUrl');
    assert.ok('viewport' in payload, 'must have viewport');
    assert.ok('capturedAt' in payload, 'must have capturedAt');
    assert.ok('inspectionKind' in payload, 'must have inspectionKind');
    assert.ok('inspectedComponent' in payload, 'must have inspectedComponent');
  });
});

// ─── Local App Projection Tests ───────────────────────────────────

describe('projectLocalAppSurface', () => {

  it('projects a reachable local app deterministically', () => {
    const source = makeLocalAppSource();
    const d1 = projectLocalAppSurface(source);
    const d2 = projectLocalAppSurface(source);
    assert.deepStrictEqual(d1, d2, 'Same input must produce identical output');
  });

  it('derives correct identity from app definition', () => {
    const source = makeLocalAppSource();
    const d = projectLocalAppSurface(source);
    assert.strictEqual(d.kind, 'local-app');
    assert.strictEqual(d.identity.title, 'OpenPencil');
    assert.strictEqual(d.identity.subtitle, 'http://127.0.0.1:4000');
    assert.strictEqual(d.identity.icon, 'app');
  });

  it('derives presence=live for reachable status', () => {
    const source = makeLocalAppSource({ status: 'reachable' });
    const d = projectLocalAppSurface(source);
    assert.strictEqual(d.state.presence, 'live');
  });

  it('derives presence=unavailable for checking status (liveness not yet proven)', () => {
    const source = makeLocalAppSource({ status: 'checking' });
    const d = projectLocalAppSurface(source);
    assert.strictEqual(d.state.presence, 'unavailable');
  });

  it('derives presence=unavailable for framing-likely-blocked (embedding failure, not disconnection)', () => {
    const source = makeLocalAppSource({ status: 'framing-likely-blocked' });
    const d = projectLocalAppSurface(source);
    assert.strictEqual(d.state.presence, 'unavailable');
  });

  it('derives presence=unavailable for invalid-configuration', () => {
    const source = makeLocalAppSource({ status: 'invalid-configuration' });
    const d = projectLocalAppSurface(source);
    assert.strictEqual(d.state.presence, 'unavailable');
  });

  it('derives presence=unavailable for unknown status strings', () => {
    const source = makeLocalAppSource({ status: 'some-unknown-future-status' });
    const d = projectLocalAppSurface(source);
    assert.strictEqual(d.state.presence, 'unavailable');
  });

  it('reachable/connected does NOT imply verified integrity', () => {
    const source = makeLocalAppSource({ status: 'reachable' });
    const d = projectLocalAppSurface(source);
    assert.strictEqual(d.state.integrity, undefined, 'Local app must not claim verified integrity');
  });

  it('offers reload and open-in-browser as local-ui tools', () => {
    // These were originally called Zone 3 view controls, which did not survive
    // contact with the header: Zone 3 carries the view mode, split and close,
    // and has no slot for a reframe or an external hand-off. Both are
    // 'local-ui' by the frozen definition -- entirely inside PaneTera's own
    // interface, touching the application not at all.
    const d = projectLocalAppSurface(makeLocalAppSource());

    assert.deepStrictEqual(
      d.actions.map((action) => action.id).sort(),
      ['open-external', 'reload'],
    );
    for (const action of d.actions) {
      assert.strictEqual(action.behavior, 'local-ui', `${action.id} runs inside PaneTera only`);
      assert.strictEqual(action.capabilityRef, undefined, 'no capability is referenced');
    }
  });

  it('offers nothing governed, which is what guide mode means', () => {
    // The whole claim of the local app surface: PaneTera observes the
    // application and cannot act inside it. In the header that is not a label,
    // it is the absence of any 'propose' action.
    const d = projectLocalAppSurface(makeLocalAppSource());
    assert.ok(
      d.actions.every((action) => action.behavior !== 'propose'),
      'a local app surface can never offer a governed action',
    );
  });

  it('offers no tools on an application that is not reachable', () => {
    // A reload control on a surface that never loaded is a control that cannot
    // work, and offering it invites a person to keep pressing it.
    for (const status of ['checking', 'framing-likely-blocked', 'invalid-configuration', 'anything']) {
      const d = projectLocalAppSurface(makeLocalAppSource({ status }));
      assert.strictEqual(d.actions.length, 0, `${status} offers no tools`);
    }
  });

  it('uses local-app-frame renderer type', () => {
    const source = makeLocalAppSource();
    const d = projectLocalAppSurface(source);
    assert.strictEqual(d.renderer.type, 'local-app-frame');
  });

  it('does not mutate the source input', () => {
    const source = makeLocalAppSource();
    const sourceCopy = JSON.parse(JSON.stringify(source));
    projectLocalAppSurface(source);
    assert.deepStrictEqual(source, sourceCopy, 'Source must not be mutated');
  });

  it('actions contain metadata only, no execution callbacks', () => {
    const source = makeLocalAppSource();
    const d = projectLocalAppSurface(source);
    assertNoCallbacks(d);
  });

  it('descriptor does not contain ReactNode or render functions', () => {
    const source = makeLocalAppSource();
    const d = projectLocalAppSurface(source);
    assertNoReactNodes(d);
  });

  it('does not leak sandbox profile into descriptor', () => {
    const source = makeLocalAppSource();
    const d = projectLocalAppSurface(source);
    const serialized = JSON.stringify(d);
    assert.ok(
      !serialized.includes('sandboxProfile'),
      'Descriptor must not contain sandboxProfile (transport plumbing)',
    );
    assert.ok(
      !serialized.includes('allow-scripts'),
      'Descriptor must not contain iframe sandbox flags',
    );
    assert.ok(
      !serialized.includes('allow-same-origin'),
      'Descriptor must not contain iframe sandbox flags',
    );
  });

  it('does not leak sandbox profile even when present in source app', () => {
    // The actual LocalAppDefinitionClient has sandboxProfile.
    // Our projection type intentionally excludes it.
    // Verify the projection output never contains it.
    const source = makeLocalAppSource();
    // Even if someone casts in extra fields, the projection should not copy them.
    (source.app as unknown as Record<string, unknown>).sandboxProfile = 'strict';
    const d = projectLocalAppSurface(source);
    const payload = d.renderer.payload as Record<string, unknown>;
    assert.strictEqual(
      'sandboxProfile' in payload,
      false,
      'Renderer payload must not contain sandboxProfile',
    );
  });

  it('renderer payload preserves sourceStatus for human-readable display', () => {
    for (const status of ['checking', 'reachable', 'framing-likely-blocked', 'invalid-configuration']) {
      const source = makeLocalAppSource({ status });
      const d = projectLocalAppSurface(source);
      const payload = d.renderer.payload as Record<string, unknown>;
      assert.strictEqual(
        payload.sourceStatus,
        status,
        `Renderer payload must preserve sourceStatus="${status}" for the renderer`,
      );
    }
  });

  it('only "reachable" produces live — all other statuses produce unavailable', () => {
    const liveStatuses = ['checking', 'framing-likely-blocked', 'invalid-configuration', 'unknown-future', ''];
    for (const status of liveStatuses) {
      const d = projectLocalAppSurface(makeLocalAppSource({ status }));
      assert.strictEqual(
        d.state.presence,
        'unavailable',
        `Status "${status}" must project to unavailable, not ${d.state.presence}`,
      );
    }
    // Only reachable proves liveness
    const reachable = projectLocalAppSurface(makeLocalAppSource({ status: 'reachable' }));
    assert.strictEqual(reachable.state.presence, 'live');
  });

  it('local-app projector never emits disconnected (no trustworthy disconnected condition)', () => {
    const allStatuses = ['checking', 'reachable', 'framing-likely-blocked', 'invalid-configuration', 'unknown', ''];
    for (const status of allStatuses) {
      const d = projectLocalAppSurface(makeLocalAppSource({ status }));
      assert.notStrictEqual(
        d.state.presence,
        'disconnected',
        `Status "${status}" must not project to disconnected — source has no trustworthy disconnected state`,
      );
    }
  });

  it('id is prefixed with local-app: for namespace clarity', () => {
    const source = makeLocalAppSource();
    const d = projectLocalAppSurface(source);
    assert.ok(d.id.startsWith('local-app:'), `id should be namespaced: ${d.id}`);
    assert.ok(d.id.includes(source.app.appId));
  });
});

// ─── Cross-cutting Contract Tests ─────────────────────────────────

describe('SurfaceDescriptor contract invariants', () => {

  it('browser descriptor is fully JSON-serializable', () => {
    const source = makeBrowserSource();
    const d = projectBrowserSurface(source);
    const roundTripped = JSON.parse(JSON.stringify(d));
    assert.deepStrictEqual(d, roundTripped, 'Descriptor must survive JSON round-trip');
  });

  it('local app descriptor is fully JSON-serializable', () => {
    const source = makeLocalAppSource();
    const d = projectLocalAppSurface(source);
    const roundTripped = JSON.parse(JSON.stringify(d));
    assert.deepStrictEqual(d, roundTripped, 'Descriptor must survive JSON round-trip');
  });

  it('neither projection returns a kind outside the allowed set', () => {
    const allowedKinds = new Set(['browser', 'local-app', 'mcp', 'artifact', 'workspace']);
    const bd = projectBrowserSurface(makeBrowserSource());
    const ld = projectLocalAppSurface(makeLocalAppSource());
    assert.ok(allowedKinds.has(bd.kind), `Unexpected browser kind: ${bd.kind}`);
    assert.ok(allowedKinds.has(ld.kind), `Unexpected local-app kind: ${ld.kind}`);
  });

  it('no projection returns an action with behavior "propose" without capabilityRef', () => {
    const bd = projectBrowserSurface(makeBrowserSource());
    const ld = projectLocalAppSurface(makeLocalAppSource());
    for (const d of [bd, ld]) {
      for (const action of d.actions) {
        if (action.behavior === 'propose') {
          assert.ok(
            action.capabilityRef,
            `Action "${action.id}" with behavior "propose" must have a capabilityRef`,
          );
        }
      }
    }
  });
});
