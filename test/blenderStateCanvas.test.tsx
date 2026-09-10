// test/blenderStateCanvas.test.tsx
//
// Tests for BlenderStateCanvas component rendering.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BlenderStateCanvas } from '../src/components/workbench/BlenderStateCanvas';
import type { BlenderSceneState } from '../src/surfaces/blenderSurface';

function makeBlenderSource(): BlenderSceneState {
  return {
    runtime: {
      blenderVersion: '5.2.1',
      activeEngine: 'CYCLES',
    },
    fileName: 'canister_mech.blend',
    filePath: '/projects/scifi/canister_mech.blend',
    collections: [
      { name: 'Props', objectIds: ['obj-canister-1'] },
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
          { name: 'DarkBrushedMetal', nodeType: 'PrincipledBSDF' },
        ],
        selected: true,
        stateDigest: 'sha256:canister-v1-abc',
      },
    ],
    selectedObjectId: 'obj-canister-1',
    viewportSnapshotUrl: 'data:image/jpeg;base64,/9j/preview==',
    stateDigest: 'sha256:scene-digest',
  };
}

describe('BlenderStateCanvas', () => {
  it('renders outliner, object hierarchy, modifiers, and snapshot', () => {
    const state = makeBlenderSource();
    const html = renderToStaticMarkup(<BlenderStateCanvas state={state} />);

    assert.ok(html.includes('data-testid="blender-state-canvas"'));
    assert.ok(html.includes('Scene Outliner'));
    assert.ok(html.includes('CanisterBody'));
    assert.ok(html.includes('480p'));
    assert.ok(html.includes('Bevel'));
    assert.ok(html.includes('DarkBrushedMetal'));
    assert.ok(html.includes('<canvas'));
  });

  it('renders clean fallback when no modifiers or snapshot are present', () => {
    const state: BlenderSceneState = {
      runtime: { blenderVersion: '5.2.1', activeEngine: 'EEVEE' },
      collections: [],
      objects: [
        {
          id: 'obj-empty-1',
          name: 'EmptyCube',
          type: 'MESH',
          location: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          modifiers: [],
          materials: [],
        },
      ],
    };

    const html = renderToStaticMarkup(<BlenderStateCanvas state={state} />);
    assert.ok(html.includes('No active modifiers'));
    assert.ok(html.includes('Default material'));
    assert.ok(!html.includes('img'));
  });
});
