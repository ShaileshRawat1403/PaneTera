// test/blenderSchemas.test.ts
//
// Tests for Blender capability definitions, state digests, and version compatibility.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLENDER_CAPABILITIES,
  computeBlenderObjectDigest,
  computeBlenderSceneDigest,
  evaluateBlenderCompatibility,
} from '../bridges/blender/src/schemas';
import type { BlenderObjectState, BlenderSourceState } from '../src/surfaces/blenderSurface';

describe('Blender Capabilities & Schemas', () => {
  it('declares orthogonal effects and permissions correctly', () => {
    assert.strictEqual(BLENDER_CAPABILITIES['blender.get_scene_summary'].effect, 'observe');
    assert.strictEqual(BLENDER_CAPABILITIES['blender.get_scene_summary'].permission, 'auto-invocable');

    assert.strictEqual(BLENDER_CAPABILITIES['blender.add_modifier'].effect, 'mutate');
    assert.strictEqual(BLENDER_CAPABILITIES['blender.add_modifier'].permission, 'proposable');

    assert.strictEqual(BLENDER_CAPABILITIES['blender.assign_material'].effect, 'mutate');
    assert.strictEqual(BLENDER_CAPABILITIES['blender.assign_material'].permission, 'proposable');

    assert.strictEqual(BLENDER_CAPABILITIES['blender.capture_viewport'].effect, 'observe');
    assert.strictEqual(BLENDER_CAPABILITIES['blender.capture_viewport'].permission, 'auto-invocable');

    assert.strictEqual(BLENDER_CAPABILITIES['blender.execute_python'].effect, 'raw-execution');
    assert.strictEqual(BLENDER_CAPABILITIES['blender.execute_python'].permission, 'denied');
  });

  it('computes deterministic object state digest', () => {
    const obj: BlenderObjectState = {
      id: 'obj-mesh-1',
      name: 'CanisterBody',
      type: 'MESH',
      location: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      vertexCount: 100,
      faceCount: 90,
      modifiers: [{ name: 'Bevel', type: 'BEVEL', parameters: { width: 0.05, segments: 3 } }],
      materials: [{ name: 'Metal', nodeType: 'PrincipledBSDF', metallic: 0.9 }],
    };

    const d1 = computeBlenderObjectDigest(obj);
    const d2 = computeBlenderObjectDigest(obj);
    assert.strictEqual(d1, d2);
    assert.ok(d1.startsWith('sha256:'));

    // Changing a modifier parameter changes the digest
    const modifiedObj = {
      ...obj,
      modifiers: [{ name: 'Bevel', type: 'BEVEL', parameters: { width: 0.1, segments: 3 } }],
    };
    const d3 = computeBlenderObjectDigest(modifiedObj);
    assert.notStrictEqual(d1, d3);
  });

  it('computes deterministic scene digest', () => {
    const scene: BlenderSourceState = {
      runtime: { blenderVersion: '5.2.1', activeEngine: 'CYCLES', isConnected: true },
      collections: [],
      objects: [
        {
          id: 'obj-1',
          name: 'Cube',
          type: 'MESH',
          location: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          modifiers: [],
          materials: [],
        },
      ],
    };

    const d1 = computeBlenderSceneDigest(scene);
    const d2 = computeBlenderSceneDigest(scene);
    assert.strictEqual(d1, d2);
    assert.ok(d1.startsWith('sha256:'));
  });

  it('evaluates Blender version compatibility tiers correctly', () => {
    const v52 = evaluateBlenderCompatibility('5.2.1');
    assert.strictEqual(v52.supported, true);
    assert.strictEqual(v52.tier, 'preferred');

    const v45 = evaluateBlenderCompatibility('4.5.13');
    assert.strictEqual(v45.supported, true);
    assert.strictEqual(v45.tier, 'compatibility');

    const v33 = evaluateBlenderCompatibility('3.3.0');
    assert.strictEqual(v33.supported, false);
    assert.strictEqual(v33.tier, 'unsupported');
  });
});
