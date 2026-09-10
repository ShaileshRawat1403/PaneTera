// test/blenderSurface.test.ts
//
// Focused unit tests for Blender SurfaceDescriptor projection.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyBlenderObservation, parseBlenderScene, projectBlenderSurface } from '../src/surfaces/blenderSurface';
import type { BlenderSceneState, BlenderSourceState } from '../src/surfaces/blenderSurface';
import type { AppConnectionState } from '../src/surfaces/appConnection';
import type { SurfaceDescriptor } from '../src/surfaces/types';

const OBSERVED_AT = '2026-09-10T08:00:00.000Z';

function makeBlenderSource(overrides?: Partial<BlenderSceneState>, connection: AppConnectionState = 'connected'): BlenderSourceState {
  return { connection, observedAt: OBSERVED_AT, scene: makeBlenderScene(overrides) };
}

function makeBlenderScene(overrides?: Partial<BlenderSceneState>): BlenderSceneState {
  return {
    runtime: {
      blenderVersion: '5.2.1',
      pythonVersion: '3.11.8',
      buildHash: 'a1b2c3d',
      groundingPackVersion: '5.2-v1',
      activeEngine: 'CYCLES',
    },
    fileName: 'canister_mech.blend',
    filePath: '/projects/scifi/canister_mech.blend',
    collections: [
      { name: 'Props', objectIds: ['obj-canister-1', 'obj-lid-1'] },
      { name: 'Lights', objectIds: ['light-key-1'] },
    ],
    objects: [
      {
        id: 'obj-canister-1',
        name: 'CanisterBody',
        type: 'MESH',
        location: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        vertexCount: 512,
        faceCount: 480,
        modifiers: [
          { name: 'Bevel', type: 'BEVEL', parameters: { width: 0.05, segments: 3 } },
        ],
        materials: [
          { name: 'DarkBrushedMetal', nodeType: 'PrincipledBSDF', metallic: 0.9, roughness: 0.2 },
        ],
        selected: true,
        stateDigest: 'sha256:canister-v1',
      },
      {
        id: 'obj-lid-1',
        name: 'CanisterLid',
        type: 'MESH',
        location: [0, 0, 1.2],
        rotation: [0, 0, 0],
        scale: [0.95, 0.95, 0.2],
        vertexCount: 256,
        faceCount: 240,
        modifiers: [],
        materials: [],
        stateDigest: 'sha256:lid-v1',
      },
    ],
    selectedObjectId: 'obj-canister-1',
    activeCamera: 'CameraMain',
    viewportSnapshotUrl: 'data:image/jpeg;base64,/9j/fakeblenderpreview==',
    capturedAt: '2026-08-30T12:00:00.000Z',
    stateDigest: 'sha256:scene-full-v1',
    ...overrides,
  };
}

function assertNoCallbacks(descriptor: SurfaceDescriptor): void {
  for (const action of descriptor.actions) {
    for (const [key, value] of Object.entries(action)) {
      assert.notStrictEqual(
        typeof value,
        'function',
        `SurfaceAction.${key} must not be a function on action "${action.id}"`,
      );
    }
  }
}

function assertNoReactNodes(descriptor: SurfaceDescriptor): void {
  const serialized = JSON.stringify(descriptor);
  assert.ok(!serialized.includes('$$typeof'), 'Descriptor must not contain React markers');
  if (descriptor.identity.icon !== undefined) {
    assert.strictEqual(typeof descriptor.identity.icon, 'string');
  }
  for (const action of descriptor.actions) {
    if (action.icon !== undefined) {
      assert.strictEqual(typeof action.icon, 'string');
    }
  }
  assert.ok(JSON.stringify(descriptor.renderer.payload) !== undefined);
}

describe('projectBlenderSurface', () => {
  it('projects a connected Blender scene deterministically', () => {
    const source = makeBlenderSource();
    const d1 = projectBlenderSurface(source);
    const d2 = projectBlenderSurface(source);
    assert.deepStrictEqual(d1, d2, 'Same input must produce identical output');
  });

  it('derives identity with filename and version', () => {
    const source = makeBlenderSource();
    const d = projectBlenderSurface(source);
    assert.strictEqual(d.kind, 'local-app');
    assert.strictEqual(d.identity.title, 'Blender · canister_mech.blend');
    assert.strictEqual(d.identity.subtitle, '/projects/scifi/canister_mech.blend (v5.2.1)');
    assert.strictEqual(d.identity.icon, 'cube');
  });

  it('falls back to default title when no filename provided', () => {
    const source = makeBlenderSource({ fileName: undefined, filePath: undefined });
    const d = projectBlenderSurface(source);
    assert.strictEqual(d.identity.title, 'Blender Scene');
    assert.strictEqual(d.identity.subtitle, 'Blender 5.2.1 · 2 objects');
  });

  it('derives presence=live when connected', () => {
    const source = makeBlenderSource();
    const d = projectBlenderSurface(source);
    assert.strictEqual(d.state.presence, 'live');
  });

  it('keeps the last observed scene as a snapshot when the bridge stops responding', () => {
    const d = projectBlenderSurface(makeBlenderSource(undefined, 'disconnected'));
    assert.strictEqual(d.state.presence, 'snapshot');
    assert.strictEqual(d.identity.subtitle, `Not connected · last observed ${OBSERVED_AT}`);
    assert.strictEqual(d.actions.length, 0, 'No actions without a live connection');
  });

  it('never claims liveness before an observation succeeds (ADR-004)', () => {
    const cases: Array<[AppConnectionState, string]> = [
      ['unknown', 'unavailable'],
      ['connecting', 'unavailable'],
      ['disconnected', 'disconnected'],
      ['error', 'unavailable'],
      ['connected', 'unavailable'],
    ];
    for (const [connection, presence] of cases) {
      const d = projectBlenderSurface({ connection });
      const payload = d.renderer.payload as Record<string, unknown>;
      assert.strictEqual(d.state.presence, presence, connection);
      assert.strictEqual(d.actions.length, 0, connection);
      assert.strictEqual(payload.runtime, null, connection);
      assert.strictEqual(payload.observedAt, null, connection);
      assert.deepStrictEqual(payload.objects, [], connection);
    }
  });

  it('offers no actions while connected: none can supply valid arguments yet (ADR-005)', () => {
    const d = projectBlenderSurface(makeBlenderSource());
    assert.strictEqual(d.state.presence, 'live');
    assert.deepStrictEqual(d.actions, []);
  });

  it("applies a successful observation and discards the bridge's own connectivity claim", () => {
    const scene = makeBlenderScene();
    const data = { ...scene, runtime: { ...scene.runtime, isConnected: true } };
    const next = applyBlenderObservation({ connection: 'connecting' }, { connection: 'connected', observedAt: OBSERVED_AT, data });
    assert.strictEqual(next.connection, 'connected');
    assert.strictEqual(next.observedAt, OBSERVED_AT);
    assert.ok(next.scene);
    assert.ok(!('isConnected' in next.scene.runtime));
  });

  it('keeps the previous scene and observation time when an observation fails', () => {
    const previous = makeBlenderSource();
    const next = applyBlenderObservation(previous, { connection: 'disconnected', error: 'Could not connect to Blender' });
    assert.strictEqual(next.connection, 'disconnected');
    assert.strictEqual(next.observedAt, OBSERVED_AT);
    assert.strictEqual(next.scene, previous.scene);
    assert.strictEqual(next.connectionError, 'Could not connect to Blender');
  });

  it('treats an unreadable or undated scene as an error, never a connection', () => {
    const unreadable = applyBlenderObservation({ connection: 'connecting' }, { connection: 'connected', observedAt: OBSERVED_AT, data: { objects: 'nope' } });
    assert.strictEqual(unreadable.connection, 'error');
    assert.strictEqual(unreadable.scene, undefined);
    assert.strictEqual(unreadable.observedAt, undefined);

    const undated = applyBlenderObservation({ connection: 'connecting' }, { connection: 'connected', data: makeBlenderScene() });
    assert.strictEqual(undated.connection, 'error');
    assert.strictEqual(undated.observedAt, undefined);
    assert.strictEqual(parseBlenderScene(null), null);
  });

  it('does not mutate source state', () => {
    const source = makeBlenderSource();
    const copy = JSON.parse(JSON.stringify(source));
    projectBlenderSurface(source);
    assert.deepStrictEqual(source, copy);
  });

  it('contains no callbacks or React elements in descriptor', () => {
    const source = makeBlenderSource();
    const d = projectBlenderSurface(source);
    assertNoCallbacks(d);
    assertNoReactNodes(d);
  });

  it('renderer payload contains complete scene data', () => {
    const source = makeBlenderSource();
    const d = projectBlenderSurface(source);
    assert.strictEqual(d.renderer.type, 'blender-scene-state');
    const payload = d.renderer.payload as Record<string, unknown>;
    assert.strictEqual(payload.fileName, 'canister_mech.blend');
    assert.strictEqual(payload.selectedObjectId, 'obj-canister-1');
    assert.strictEqual(payload.viewportSnapshotUrl, 'data:image/jpeg;base64,/9j/fakeblenderpreview==');
    assert.ok(Array.isArray(payload.objects));
    assert.strictEqual((payload.objects as unknown[]).length, 2);
  });

  it('classifies Blender as a local-app identified by appId (ADR-003)', () => {
    const d = projectBlenderSurface(makeBlenderSource());
    assert.strictEqual(d.kind, 'local-app');
    assert.strictEqual(d.appId, 'blender');
    assert.strictEqual(d.renderer.type, 'blender-scene-state');
  });
});
