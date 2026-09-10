// bridges/blender/src/schemas.ts
//
// Capabilities, schemas, and state digest utilities for Blender MCP Bridge.

import { createHash } from 'node:crypto';
import type {
  BlenderCapabilityDeclaration,
  BlenderAddModifierInput,
  BlenderAssignMaterialInput,
  BlenderCreatePrimitiveInput,
} from './types';
import type { BlenderObjectState, BlenderSourceState } from '../../../src/surfaces/blenderSurface';

// ─── Capability Declarations ──────────────────────────────────────

export const BLENDER_CAPABILITIES: Record<string, BlenderCapabilityDeclaration> = {
  'blender.get_scene_summary': {
    id: 'blender.get_scene_summary',
    name: 'Get Scene Summary',
    description: 'Returns collections, objects, active camera, render settings, and polycounts.',
    effect: 'observe',
    permission: 'auto-invocable',
    inputSchema: {
      type: 'object',
      properties: {
        includeMeshesOnly: { type: 'boolean' },
      },
    },
  },
  'blender.inspect_object': {
    id: 'blender.inspect_object',
    name: 'Inspect Object',
    description: 'Returns transforms, modifiers, materials, vertex counts, and state digest for an object.',
    effect: 'observe',
    permission: 'auto-invocable',
    inputSchema: {
      type: 'object',
      required: ['objectId'],
      properties: {
        objectId: { type: 'string' },
      },
    },
  },
  'blender.create_primitive': {
    id: 'blender.create_primitive',
    name: 'Create Primitive',
    description: 'Creates a basic 3D mesh primitive (Cube, Cylinder, Sphere, Plane, Torus).',
    effect: 'mutate',
    permission: 'proposable',
    inputSchema: {
      type: 'object',
      required: ['type'],
      properties: {
        type: { type: 'string', enum: ['CUBE', 'CYLINDER', 'SPHERE', 'PLANE', 'TORUS'] },
        name: { type: 'string' },
        location: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 },
        rotation: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 },
        scale: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 },
        radius: { type: 'number' },
        depth: { type: 'number' },
        expectedStateDigest: { type: 'string' },
      },
    },
  },
  'blender.add_modifier': {
    id: 'blender.add_modifier',
    name: 'Add Modifier',
    description: 'Adds and configures a modifier (Bevel, Subdivision Surface, Boolean, Solidify, Mirror) on an object.',
    effect: 'mutate',
    permission: 'proposable',
    inputSchema: {
      type: 'object',
      required: ['objectId', 'modifierType', 'parameters', 'expectedStateDigest'],
      properties: {
        objectId: { type: 'string' },
        modifierType: { type: 'string', enum: ['BEVEL', 'SUBSURF', 'BOOLEAN', 'SOLIDIFY', 'MIRROR'] },
        name: { type: 'string' },
        parameters: { type: 'object' },
        expectedStateDigest: { type: 'string', description: 'Precondition state digest hash' },
      },
    },
  },
  'blender.assign_material': {
    id: 'blender.assign_material',
    name: 'Assign Material',
    description: 'Creates and assigns a shader material to a target object.',
    effect: 'mutate',
    permission: 'proposable',
    inputSchema: {
      type: 'object',
      required: ['objectId', 'materialName', 'expectedStateDigest'],
      properties: {
        objectId: { type: 'string' },
        materialName: { type: 'string' },
        shaderType: { type: 'string', enum: ['PrincipledBSDF', 'Emission', 'Glass'] },
        parameters: { type: 'object' },
        expectedStateDigest: { type: 'string' },
      },
    },
  },
  'blender.capture_viewport': {
    id: 'blender.capture_viewport',
    name: 'Capture Viewport',
    description: 'Captures a snapshot image of the current 3D viewport.',
    effect: 'observe',
    permission: 'auto-invocable',
    inputSchema: {
      type: 'object',
      properties: {
        width: { type: 'number' },
        height: { type: 'number' },
        shadingMode: { type: 'string', enum: ['WIREFRAME', 'SOLID', 'MATERIAL', 'RENDERED'] },
      },
    },
  },
  'blender.execute_python': {
    id: 'blender.execute_python',
    name: 'Execute Python Script',
    description: 'Developer escape hatch: executes arbitrary Python code in Blender runtime.',
    effect: 'raw-execution',
    permission: 'denied',
    inputSchema: {
      type: 'object',
      required: ['script', 'description'],
      properties: {
        script: { type: 'string' },
        description: { type: 'string' },
        expectedStateDigest: { type: 'string' },
      },
    },
  },
};

// ─── State Digest Utilities ───────────────────────────────────────

/**
 * Computes a deterministic SHA-256 state digest for a specific Blender object.
 */
export function computeBlenderObjectDigest(obj: BlenderObjectState): string {
  const norm = {
    id: obj.id,
    name: obj.name,
    type: obj.type,
    location: obj.location,
    rotation: obj.rotation,
    scale: obj.scale,
    vertexCount: obj.vertexCount ?? 0,
    faceCount: obj.faceCount ?? 0,
    modifiers: (obj.modifiers || []).map((m) => ({
      name: m.name,
      type: m.type,
      parameters: m.parameters,
    })),
    materials: (obj.materials || []).map((mat) => ({
      name: mat.name,
      nodeType: mat.nodeType,
      baseColor: mat.baseColor,
      metallic: mat.metallic,
      roughness: mat.roughness,
    })),
  };

  return `sha256:${createHash('sha256').update(JSON.stringify(norm)).digest('hex')}`;
}

/**
 * Computes a deterministic SHA-256 state digest for the entire scene.
 */
export function computeBlenderSceneDigest(scene: BlenderSourceState): string {
  const objectDigests = (scene.objects || [])
    .map((o) => `${o.id}:${computeBlenderObjectDigest(o)}`)
    .sort()
    .join(';');

  return `sha256:${createHash('sha256').update(objectDigests).digest('hex')}`;
}

/**
 * Validates whether an expected precondition state digest matches the live state digest.
 */
export function validatePreconditionDigest(
  expectedDigest: string | undefined,
  liveDigest: string,
): { valid: boolean; reason?: string } {
  if (!expectedDigest) {
    return { valid: false, reason: 'Mutation requires an expectedStateDigest precondition.' };
  }
  if (expectedDigest !== liveDigest) {
    return {
      valid: false,
      reason: `Stale state detected: expected digest "${expectedDigest}" does not match live digest "${liveDigest}".`,
    };
  }
  return { valid: true };
}

// ─── Version & Compatibility Checker ──────────────────────────────

export interface VersionCompatibilityResult {
  supported: boolean;
  tier: 'preferred' | 'compatibility' | 'unsupported';
  message: string;
}

export function evaluateBlenderCompatibility(versionString: string): VersionCompatibilityResult {
  const match = versionString.match(/^(\d+)\.(\d+)/);
  if (!match) {
    return {
      supported: false,
      tier: 'unsupported',
      message: `Invalid Blender version string "${versionString}".`,
    };
  }

  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);

  if (major === 5 && minor >= 2) {
    return {
      supported: true,
      tier: 'preferred',
      message: `Blender ${versionString} (Preferred LTS tier).`,
    };
  }

  if (major === 4 && minor === 5) {
    return {
      supported: true,
      tier: 'compatibility',
      message: `Blender ${versionString} (Supported compatibility LTS tier).`,
    };
  }

  return {
    supported: false,
    tier: 'unsupported',
    message: `Blender ${versionString} detected, but unsupported until verified. Preferred: 5.2 LTS, Compatibility: 4.5 LTS.`,
  };
}
