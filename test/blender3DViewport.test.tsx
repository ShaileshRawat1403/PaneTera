// test/blender3DViewport.test.tsx
//
// Unit tests for Blender3DViewport component rendering and projection math.

import React from 'react';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { renderToStaticMarkup } from 'react-dom/server';
import { Blender3DViewport } from '../src/components/workbench/Blender3DViewport';
import type { BlenderObjectState } from '../src/surfaces/blenderSurface';

describe('Blender3DViewport', () => {
  const sampleObjects: BlenderObjectState[] = [
    {
      id: 'Cube',
      name: 'Cube',
      type: 'MESH',
      location: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      vertexCount: 8,
      faceCount: 6,
      modifiers: [],
      materials: [{ name: 'Material', nodeType: 'PrincipledBSDF' }],
      selected: true,
      stateDigest: 'sha256:cube-digest',
    },
    {
      id: 'Camera',
      name: 'Camera',
      type: 'CAMERA',
      location: [0, -5, 3],
      rotation: [60, 0, 0],
      scale: [1, 1, 1],
      modifiers: [],
      materials: [],
      stateDigest: 'sha256:cam-digest',
    },
    {
      id: 'Light',
      name: 'Light',
      type: 'LIGHT',
      location: [4, 1, 5],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      modifiers: [],
      materials: [],
      stateDigest: 'sha256:light-digest',
    },
  ];

  it('renders hardware-accelerated 3D canvas and viewport toolbar', () => {
    const html = renderToStaticMarkup(
      <Blender3DViewport
        objects={sampleObjects}
        selectedObjectId="Cube"
        activeEngine="CYCLES"
      />
    );

    assert.ok(html.includes('<canvas'), 'renders canvas element');
    assert.ok(html.includes('Solid 3D'), 'renders Solid 3D shading toggle');
    assert.ok(html.includes('Wireframe'), 'renders Wireframe shading toggle');
    assert.ok(html.includes('CYCLES'), 'displays active render engine');
    assert.ok(html.includes('Orbit'), 'displays navigation hint');
  });

  it('renders snapshot mode when snapshot URL is provided', () => {
    const html = renderToStaticMarkup(
      <Blender3DViewport
        objects={sampleObjects}
        viewportSnapshotUrl="data:image/jpeg;base64,/9j/4AAQSkZJRg=="
        activeEngine="EEVEE"
      />
    );

    assert.ok(html.includes('Render'), 'renders Snapshot/Render toggle');
    assert.ok(html.includes('EEVEE'), 'displays EEVEE engine');
  });
});
