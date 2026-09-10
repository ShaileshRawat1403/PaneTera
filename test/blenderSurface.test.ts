// test/blenderSurface.test.ts
//
// Focused unit tests for Blender SurfaceDescriptor projection.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { projectBlenderSurface } from '../src/surfaces/blenderSurface';
import type { BlenderSourceState } from '../src/surfaces/blenderSurface';
import type { SurfaceDescriptor } from '../src/surfaces/types';

function makeBlenderSource(overrides?: Partial<BlenderSourceState>): BlenderSourceState {
  return {
    runtime: {
      blenderVersion: '5.2.1',
      pythonVersion: '3.11.8',
      buildHash: 'a1b2c3d',
      groundingPackVersion: '5.2-v1',
      activeEngine: 'CYCLES',
      isConnected: true,
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
    assert.strictEqual(d.kind, 'blender');
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

  it('derives presence=unavailable when disconnected', () => {
    const source = makeBlenderSource({
      runtime: {
        blenderVersion: '5.2.1',
        activeEngine: 'CYCLES',
        isConnected: false,
      },
    });
    const d = projectBlenderSurface(source);
    assert.strictEqual(d.state.presence, 'unavailable');
    assert.strictEqual(d.actions.length, 0, 'No actions when disconnected');
  });

  it('offers observe and propose actions with capabilityRefs', () => {
    const source = makeBlenderSource();
    const d = projectBlenderSurface(source);
    assert.ok(d.actions.length >= 3);

    const snapshot = d.actions.find((a) => a.id === 'capture-viewport');
    assert.ok(snapshot);
    assert.strictEqual(snapshot.behavior, 'observe');

    const addMod = d.actions.find((a) => a.id === 'add-modifier');
    assert.ok(addMod);
    assert.strictEqual(addMod.behavior, 'propose');
    assert.deepStrictEqual(addMod.capabilityRef, {
      connectionId: 'blender',
      capabilityId: 'blender.add_modifier',
    });
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
});
