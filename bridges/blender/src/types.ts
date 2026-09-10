// bridges/blender/src/types.ts
//
// Typed domain definitions, effect classifications, and handshake contracts
// for the PaneTera Blender MCP Bridge.

export type RigEffectType = 'observe' | 'mutate' | 'external-output' | 'raw-execution';
export type RigPermission = 'auto-invocable' | 'proposable' | 'denied';

export interface BlenderHandshakeInfo {
  blenderVersion: string; // e.g. "5.2.1"
  blenderFileVersion: number;
  pythonVersion: string;
  buildHash: string;
  enabledExtensions?: string[];
  groundingPackVersion: string;
  groundingPackDigest: string;
}

export interface BlenderCapabilityDeclaration {
  id: string;
  name: string;
  description: string;
  effect: RigEffectType;
  permission: RigPermission;
  inputSchema: Record<string, unknown>;
}

// ─── Domain Operation Inputs ──────────────────────────────────────

export interface BlenderGetSceneSummaryInput {
  includeMeshesOnly?: boolean;
}

export interface BlenderInspectObjectInput {
  objectId: string;
}

export interface BlenderCreatePrimitiveInput {
  type: 'CUBE' | 'CYLINDER' | 'SPHERE' | 'PLANE' | 'TORUS';
  name?: string;
  location?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  radius?: number;
  depth?: number;
  expectedStateDigest?: string;
}

export interface BlenderAddModifierInput {
  objectId: string;
  modifierType: 'BEVEL' | 'SUBSURF' | 'BOOLEAN' | 'SOLIDIFY' | 'MIRROR';
  name?: string;
  parameters: {
    width?: number;
    segments?: number;
    levels?: number;
    renderLevels?: number;
    thickness?: number;
    operation?: 'DIFFERENCE' | 'UNION' | 'INTERSECT';
    targetObjectId?: string;
    clampOverlap?: boolean;
    [key: string]: unknown;
  };
  expectedStateDigest: string; // Precondition state digest binding
}

export interface BlenderAssignMaterialInput {
  objectId: string;
  materialName: string;
  shaderType?: 'PrincipledBSDF' | 'Emission' | 'Glass';
  parameters?: {
    baseColor?: string; // hex #rrggbb or rgba
    metallic?: number;
    roughness?: number;
    emissionColor?: string;
    emissionStrength?: number;
    ior?: number;
    transmission?: number;
  };
  expectedStateDigest: string;
}

export interface BlenderCaptureViewportInput {
  width?: number;
  height?: number;
  shadingMode?: 'WIREFRAME' | 'SOLID' | 'MATERIAL' | 'RENDERED';
}

export interface BlenderExecutePythonInput {
  script: string;
  description: string;
  expectedStateDigest?: string;
}
