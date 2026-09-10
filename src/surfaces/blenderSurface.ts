// src/surfaces/blenderSurface.ts
//
// Pure projection function that transforms existing Blender source state
// into a SurfaceDescriptor value for PaneTera's workstation canvas.
//
// Invariants:
//   - Accepts existing source-of-truth types as input.
//   - Returns a SurfaceDescriptor (presentation projection only).
//   - Never mutates the input.
//   - Never executes capabilities, makes network calls, or accesses stores.
//   - Never imports React or returns ReactNode values.

import type {
  SurfaceDescriptor,
  SurfaceAction,
  SurfacePresence,
} from './types';

// ─── Source State Types ───────────────────────────────────────────

export interface BlenderModifierState {
  name: string;
  type: string;
  parameters: Record<string, unknown>;
}

export interface BlenderMaterialState {
  name: string;
  nodeType?: string;
  baseColor?: string;
  metallic?: number;
  roughness?: number;
  emission?: string;
}

export interface BlenderObjectState {
  id: string;
  name: string;
  type: 'MESH' | 'CAMERA' | 'LIGHT' | 'CURVE' | 'EMPTY' | string;
  location: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  vertexCount?: number;
  faceCount?: number;
  modifiers: BlenderModifierState[];
  materials: BlenderMaterialState[];
  selected?: boolean;
  stateDigest?: string;
}

export interface BlenderCollectionState {
  name: string;
  objectIds: string[];
}

export interface BlenderRuntimeState {
  blenderVersion: string;
  pythonVersion?: string;
  buildHash?: string;
  groundingPackVersion?: string;
  activeEngine: string;
  isConnected: boolean;
}

export interface BlenderSourceState {
  runtime: BlenderRuntimeState;
  fileName?: string;
  filePath?: string;
  collections: BlenderCollectionState[];
  objects: BlenderObjectState[];
  selectedObjectId?: string;
  activeCamera?: string;
  viewportSnapshotUrl?: string;
  capturedAt?: string;
  stateDigest?: string;
}

// ─── Projection ───────────────────────────────────────────────────

function deriveBlenderPresence(runtime: BlenderRuntimeState): SurfacePresence {
  if (runtime.isConnected) return 'live';
  return 'unavailable';
}

function deriveBlenderActions(isConnected: boolean): SurfaceAction[] {
  if (!isConnected) return [];

  return [
    {
      id: 'capture-viewport',
      label: 'Capture Viewport',
      icon: 'camera',
      behavior: 'observe',
    },
    {
      id: 'audit-geometry',
      label: 'Audit Geometry',
      icon: 'search',
      behavior: 'observe',
    },
    {
      id: 'add-modifier',
      label: 'Add Modifier',
      icon: 'cube',
      behavior: 'propose',
      capabilityRef: {
        connectionId: 'blender',
        capabilityId: 'blender.add_modifier',
      },
    },
    {
      id: 'assign-material',
      label: 'Assign Material',
      icon: 'palette',
      behavior: 'propose',
      capabilityRef: {
        connectionId: 'blender',
        capabilityId: 'blender.assign_material',
      },
    },
  ];
}

/**
 * Projects existing Blender source state into a SurfaceDescriptor.
 *
 * This is a pure function. It does not:
 *   - mutate the input
 *   - access Blender APIs, sockets, or stores
 *   - execute any commands
 *   - return React components
 */
export function projectBlenderSurface(source: BlenderSourceState): SurfaceDescriptor {
  const presence = deriveBlenderPresence(source.runtime);
  const actions = deriveBlenderActions(source.runtime.isConnected);

  const title = source.fileName ? `Blender · ${source.fileName}` : 'Blender Scene';
  const subtitle = source.filePath
    ? `${source.filePath} (v${source.runtime.blenderVersion})`
    : `Blender ${source.runtime.blenderVersion} · ${source.objects.length} objects`;

  const totalFaces = source.objects.reduce((sum, obj) => sum + (obj.faceCount || 0), 0);
  const viewMode = totalFaces > 0
    ? `${source.objects.length} objs · ${totalFaces.toLocaleString()} polys · ${source.runtime.activeEngine}`
    : `${source.objects.length} objs · ${source.runtime.activeEngine}`;

  return {
    id: `blender:${source.fileName || 'scene'}`,
    kind: 'blender',

    identity: {
      title,
      subtitle,
      icon: 'cube',
    },

    state: {
      presence,
    },

    actions,

    view: {
      mode: viewMode,
      canSplit: true,
      canClose: true,
    },

    renderer: {
      type: 'blender-scene-state',
      payload: {
        runtime: {
          blenderVersion: source.runtime.blenderVersion,
          pythonVersion: source.runtime.pythonVersion ?? null,
          buildHash: source.runtime.buildHash ?? null,
          groundingPackVersion: source.runtime.groundingPackVersion ?? null,
          activeEngine: source.runtime.activeEngine,
          isConnected: source.runtime.isConnected,
        },
        fileName: source.fileName ?? null,
        filePath: source.filePath ?? null,
        collections: source.collections,
        objects: source.objects,
        selectedObjectId: source.selectedObjectId ?? null,
        activeCamera: source.activeCamera ?? null,
        viewportSnapshotUrl: source.viewportSnapshotUrl ?? null,
        capturedAt: source.capturedAt ?? null,
        stateDigest: source.stateDigest ?? null,
      },
    },
  };
}

export function createDefaultBlenderState(): BlenderSourceState {
  return {
    runtime: {
      blenderVersion: '4.2 LTS',
      pythonVersion: '3.11.8',
      buildHash: 'c4e81a9',
      groundingPackVersion: '4.2-v1',
      activeEngine: 'CYCLES',
      isConnected: true,
    },
    fileName: 'scifi_outpost_mech.blend',
    filePath: '/projects/3d/scifi_outpost_mech.blend',
    collections: [
      { name: 'Props', objectIds: ['obj-canister-1', 'obj-lid-1', 'obj-core-1'] },
      { name: 'Lighting', objectIds: ['light-key-1'] },
      { name: 'Cameras', objectIds: ['cam-main-1'] },
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
        materials: [
          { name: 'TitaniumAlloy', nodeType: 'PrincipledBSDF', metallic: 0.95, roughness: 0.15 },
        ],
        stateDigest: 'sha256:lid-v1',
      },
      {
        id: 'obj-core-1',
        name: 'PlasmaCore',
        type: 'MESH',
        location: [0, 0, 0.5],
        rotation: [0, 0.45, 0],
        scale: [0.5, 0.5, 0.5],
        vertexCount: 384,
        faceCount: 360,
        modifiers: [],
        materials: [
          { name: 'PlasmaGlow', nodeType: 'Emission' },
        ],
        stateDigest: 'sha256:core-v1',
      },
      {
        id: 'light-key-1',
        name: 'KeyLight_Sun',
        type: 'LIGHT',
        location: [4, -4, 6],
        rotation: [0.78, 0, 0.78],
        scale: [1, 1, 1],
        modifiers: [],
        materials: [],
      },
      {
        id: 'cam-main-1',
        name: 'StudioCamera',
        type: 'CAMERA',
        location: [3, -5, 2.5],
        rotation: [1.1, 0, 0.6],
        scale: [1, 1, 1],
        modifiers: [],
        materials: [],
      },
    ],
    selectedObjectId: 'obj-canister-1',
    activeCamera: 'cam-main-1',
    capturedAt: new Date().toISOString(),
    stateDigest: 'sha256:scene-blender-outpost-v1',
  };
}
