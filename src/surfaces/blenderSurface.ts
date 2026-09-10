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
} from './types';
import {
  describeAppConnection,
  isRecord,
  optionalString,
  presenceForAppConnection,
  type AppConnectionState,
  type AppObservation,
} from './appConnection';

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
}

/** One successfully observed Blender scene, as reported by the bridge. */
export interface BlenderSceneState {
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

/**
 * What the workstation knows about Blender (ADR-004).
 *
 * `scene` and `observedAt` exist only after a bridge observation succeeds.
 * A later failure changes `connection` but keeps the last scene, which then
 * projects as a snapshot rather than as live state.
 */
export interface BlenderSourceState {
  connection: AppConnectionState;
  /** Time of the last successful observation. */
  observedAt?: string;
  /** Detail of the most recent failed observation. */
  connectionError?: string;
  /** The last successfully observed scene. */
  scene?: BlenderSceneState;
}

// ─── Projection ───────────────────────────────────────────────────

function deriveBlenderActions(live: boolean): SurfaceAction[] {
  if (!live) return [];

  // Observe actions (capture viewport, audit geometry) were removed: nothing
  // performed them, and an affordance without an implementation implies a
  // capability PaneTera does not have.
  return [
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
 * Projects Blender source state into a SurfaceDescriptor.
 *
 * This is a pure function. It does not:
 *   - mutate the input
 *   - access Blender APIs, sockets, or stores
 *   - execute any commands
 *   - return React components
 *
 * Presence is 'live' only while connected with an observed scene; a scene
 * retained from an earlier observation is a 'snapshot'.
 */
export function projectBlenderSurface(source: BlenderSourceState): SurfaceDescriptor {
  const { scene } = source;
  const live = source.connection === 'connected' && scene !== undefined;

  const title = scene?.fileName ? `Blender · ${scene.fileName}` : 'Blender Scene';
  let subtitle = describeAppConnection(source.connection, source.observedAt);
  let viewMode: string | undefined;
  if (scene) {
    if (live) {
      subtitle = scene.filePath
        ? `${scene.filePath} (v${scene.runtime.blenderVersion})`
        : `Blender ${scene.runtime.blenderVersion} · ${scene.objects.length} objects`;
    }
    const totalFaces = scene.objects.reduce((sum, obj) => sum + (obj.faceCount || 0), 0);
    viewMode = totalFaces > 0
      ? `${scene.objects.length} objs · ${totalFaces.toLocaleString()} polys · ${scene.runtime.activeEngine}`
      : `${scene.objects.length} objs · ${scene.runtime.activeEngine}`;
  }

  return {
    id: `blender:${scene?.fileName || 'scene'}`,
    kind: 'local-app',
    appId: 'blender',

    identity: {
      title,
      subtitle,
      icon: 'cube',
    },

    state: {
      presence: presenceForAppConnection(source.connection, scene !== undefined),
    },

    actions: deriveBlenderActions(live),

    view: {
      mode: viewMode,
      canSplit: true,
      canClose: true,
    },

    renderer: {
      type: 'blender-scene-state',
      payload: {
        connection: source.connection,
        observedAt: source.observedAt ?? null,
        connectionError: source.connectionError ?? null,
        runtime: scene
          ? {
              blenderVersion: scene.runtime.blenderVersion,
              pythonVersion: scene.runtime.pythonVersion ?? null,
              buildHash: scene.runtime.buildHash ?? null,
              groundingPackVersion: scene.runtime.groundingPackVersion ?? null,
              activeEngine: scene.runtime.activeEngine,
            }
          : null,
        fileName: scene?.fileName ?? null,
        filePath: scene?.filePath ?? null,
        collections: scene?.collections ?? [],
        objects: scene?.objects ?? [],
        selectedObjectId: scene?.selectedObjectId ?? null,
        activeCamera: scene?.activeCamera ?? null,
        viewportSnapshotUrl: scene?.viewportSnapshotUrl ?? null,
        capturedAt: scene?.capturedAt ?? null,
        stateDigest: scene?.stateDigest ?? null,
      },
    },
  };
}

// ─── Observation ──────────────────────────────────────────────────

/**
 * Reads a bridge scene payload, or returns null when required fields are
 * missing. The bridge's own connectivity field is deliberately not carried
 * over: an application reporting itself connected is not evidence.
 */
export function parseBlenderScene(data: unknown): BlenderSceneState | null {
  if (!isRecord(data)) return null;
  const runtime = data.runtime;
  if (!isRecord(runtime) || !Array.isArray(data.objects) || !Array.isArray(data.collections)) return null;
  if (typeof runtime.blenderVersion !== 'string' || typeof runtime.activeEngine !== 'string') return null;

  return {
    runtime: {
      blenderVersion: runtime.blenderVersion,
      pythonVersion: optionalString(runtime.pythonVersion),
      buildHash: optionalString(runtime.buildHash),
      groundingPackVersion: optionalString(runtime.groundingPackVersion),
      activeEngine: runtime.activeEngine,
    },
    fileName: optionalString(data.fileName),
    filePath: optionalString(data.filePath),
    collections: data.collections as BlenderCollectionState[],
    objects: data.objects as BlenderObjectState[],
    selectedObjectId: optionalString(data.selectedObjectId),
    activeCamera: optionalString(data.activeCamera),
    viewportSnapshotUrl: optionalString(data.viewportSnapshotUrl),
    capturedAt: optionalString(data.capturedAt),
    stateDigest: optionalString(data.stateDigest),
  };
}

/**
 * Folds one observation into source state. Success replaces the scene and
 * observedAt; failure changes only the connection, so the last observed
 * scene stays visible as a snapshot.
 */
export function applyBlenderObservation(previous: BlenderSourceState, observation: AppObservation): BlenderSourceState {
  if (observation.connection === 'connected') {
    const scene = parseBlenderScene(observation.data);
    if (scene && observation.observedAt) {
      return { connection: 'connected', observedAt: observation.observedAt, scene };
    }
    return { ...previous, connection: 'error', connectionError: 'The Blender bridge returned a scene PaneTera could not read.' };
  }
  return { ...previous, connection: observation.connection, connectionError: observation.error };
}
