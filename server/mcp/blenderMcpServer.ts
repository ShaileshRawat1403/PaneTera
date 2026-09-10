// server/mcp/blenderMcpServer.ts
//
// PaneTera Blender MCP Server — wraps the live Blender Python bridge
// via TCP socket and exposes it as a Model Context Protocol server.
//
// Launch with: tsx server/mcp/blenderMcpServer.ts
// Or register as a stdio MCP connection in the PaneTera Rig.

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { sendBlenderCommand } from '../creative/blenderClient.js';

const server = new McpServer({
  name: 'PaneTera Blender',
  version: '1.0.0',
});

// ── Tool: get_scene_summary ────────────────────────────────────
server.tool(
  'blender.get_scene_summary',
  'Returns collections, objects, active camera, render engine, and polycounts from the live Blender scene.',
  {
    includeMeshesOnly: z.boolean().optional().default(false).describe('Filter to mesh objects only'),
  },
  async (args) => {
    try {
      const result = await sendBlenderCommand<{
        runtime: { blenderVersion: string; activeEngine: string; isConnected: boolean };
        fileName: string; filePath: string;
        collections: Array<{ name: string; objectIds: string[] }>;
        objects: Array<{
          id: string; name: string; type: string;
          location: number[]; rotation: number[]; scale: number[];
          vertexCount?: number; faceCount?: number;
          modifiers: Array<{ name: string; type: string }>;
          materials: Array<{ name: string; nodeType: string }>;
          selected?: boolean; stateDigest?: string;
        }>;
        selectedObjectId?: string; activeCamera?: string;
      }>('blender.get_scene_summary', { includeMeshesOnly: args.includeMeshesOnly });

      if (result.success && result.data) {
        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: result.error }, null, 2) }],
        isError: true,
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }, null, 2) }],
        isError: true,
      };
    }
  }
);

// ── Tool: inspect_object ───────────────────────────────────────
server.tool(
  'blender.inspect_object',
  'Returns transforms, modifiers, materials, vertex counts, and state digest for a specific Blender object.',
  {
    objectId: z.string().describe('The name of the Blender object to inspect'),
  },
  async (args) => {
    try {
      const result = await sendBlenderCommand<{
        object: {
          id: string; name: string; type: string;
          location: number[]; rotation: number[]; scale: number[];
          vertexCount?: number; faceCount?: number;
          modifiers: Array<{ name: string; type: string; parameters: Record<string, unknown> }>;
          materials: Array<{ name: string; nodeType: string; baseColor?: string; metallic?: number; roughness?: number }>;
          selected: boolean; stateDigest: string;
        };
      }>('blender.inspect_object', { objectId: args.objectId });

      if (result.success && result.data) {
        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: result.error }, null, 2) }],
        isError: true,
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }, null, 2) }],
        isError: true,
      };
    }
  }
);

// ── Tool: create_primitive ─────────────────────────────────────
server.tool(
  'blender.create_primitive',
  'Creates a basic 3D mesh primitive (Cube, Cylinder, Sphere, Plane, Torus) in the live Blender scene.',
  {
    type: z.enum(['CUBE', 'CYLINDER', 'SPHERE', 'PLANE', 'TORUS']).describe('Primitive type'),
    name: z.string().optional().describe('Optional name for the new object'),
    location: z.array(z.number()).min(3).max(3).optional().default([0, 0, 0]).describe('X, Y, Z location'),
    rotation: z.array(z.number()).min(3).max(3).optional().default([0, 0, 0]).describe('X, Y, Z rotation in radians'),
    scale: z.array(z.number()).min(3).max(3).optional().default([1, 1, 1]).describe('X, Y, Z scale'),
    expectedStateDigest: z.string().optional().describe('Precondition state digest for governed approval'),
  },
  async (args) => {
    try {
      const result = await sendBlenderCommand<{
        objectId: string; digest: string;
      }>('blender.create_primitive', {
        type: args.type,
        name: args.name,
        location: args.location,
        rotation: args.rotation,
        scale: args.scale,
      });

      if (result.success && result.data) {
        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: result.error }, null, 2) }],
        isError: true,
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }, null, 2) }],
        isError: true,
      };
    }
  }
);

// ── Tool: add_modifier ─────────────────────────────────────────
server.tool(
  'blender.add_modifier',
  'Adds and configures a modifier (Bevel, Subdivision Surface, Boolean, Solidify, Mirror) on a Blender object. Requires approval if expectedStateDigest is provided.',
  {
    objectId: z.string().describe('Target object name'),
    modifierType: z.enum(['BEVEL', 'SUBSURF', 'BOOLEAN', 'SOLIDIFY', 'MIRROR']).describe('Modifier type'),
    name: z.string().optional().describe('Modifier name'),
    parameters: z.record(z.string(), z.unknown()).optional().default({}).describe('Modifier parameters'),
    expectedStateDigest: z.string().optional().describe('Precondition state digest hash for governed approval'),
  },
  async (args) => {
    try {
      const result = await sendBlenderCommand<{
        objectId: string; modifierName: string; newDigest: string;
      }>('blender.add_modifier', {
        objectId: args.objectId,
        modifierType: args.modifierType,
        name: args.name,
        parameters: args.parameters,
      });

      if (result.success && result.data) {
        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: result.error }, null, 2) }],
        isError: true,
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }, null, 2) }],
        isError: true,
      };
    }
  }
);

// ── Tool: assign_material ──────────────────────────────────────
server.tool(
  'blender.assign_material',
  'Creates and assigns a shader material to a target Blender object. Requires approval if expectedStateDigest is provided.',
  {
    objectId: z.string().describe('Target object name'),
    materialName: z.string().describe('Material name'),
    shaderType: z.enum(['PrincipledBSDF', 'Emission', 'Glass']).optional().default('PrincipledBSDF').describe('Shader type'),
    parameters: z.record(z.string(), z.unknown()).optional().default({}).describe('Material parameters (baseColor, metallic, roughness, etc.)'),
    expectedStateDigest: z.string().optional().describe('Precondition state digest hash for governed approval'),
  },
  async (args) => {
    try {
      const result = await sendBlenderCommand<{
        objectId: string; materialName: string; newDigest: string;
      }>('blender.assign_material', {
        objectId: args.objectId,
        materialName: args.materialName,
        shaderType: args.shaderType,
        parameters: args.parameters,
      });

      if (result.success && result.data) {
        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: result.error }, null, 2) }],
        isError: true,
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }, null, 2) }],
        isError: true,
      };
    }
  }
);

// ── Tool: capture_viewport ─────────────────────────────────────
server.tool(
  'blender.capture_viewport',
  'Captures a snapshot image of the current Blender 3D viewport.',
  {
    width: z.number().optional().default(800).describe('Viewport width'),
    height: z.number().optional().default(600).describe('Viewport height'),
    shadingMode: z.enum(['WIREFRAME', 'SOLID', 'MATERIAL', 'RENDERED']).optional().default('SOLID').describe('Shading mode'),
  },
  async (args) => {
    try {
      const result = await sendBlenderCommand<{
        snapshotUrl: string; width: number; height: number;
      }>('blender.capture_viewport', {
        width: args.width,
        height: args.height,
        shadingMode: args.shadingMode,
      });

      if (result.success && result.data) {
        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: result.error }, null, 2) }],
        isError: true,
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }, null, 2) }],
        isError: true,
      };
    }
  }
);

// ── Tool: get_object_details ───────────────────────────────────
server.tool(
  'blender.get_object_details',
  'Returns detailed information about all objects in the scene including geometry stats and material properties.',
  {},
  async () => {
    try {
      const result = await sendBlenderCommand<{
        objects: Array<{
          id: string; name: string; type: string;
          location: number[]; rotation: number[]; scale: number[];
          vertexCount?: number; faceCount?: number;
          modifiers: Array<{ name: string; type: string }>;
          materials: Array<{ name: string; nodeType: string }>;
          stateDigest: string;
        }>;
        collections: Array<{ name: string; objectIds: string[] }>;
      }>('blender.get_scene_summary', {});

      if (result.success && result.data) {
        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: result.error }, null, 2) }],
        isError: true,
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }, null, 2) }],
        isError: true,
      };
    }
  }
);

// ── Resource: blender://scene/{id} ─────────────────────────────
server.resource(
  'blender-scene',
  'blender://scene/current',
  async () => {
    try {
      const result = await sendBlenderCommand('blender.get_scene_summary', {});
      if (result.success && result.data) {
        return {
          contents: [{ uri: 'blender://scene/current', text: JSON.stringify(result.data, null, 2) }],
        };
      }
      return { contents: [{ uri: 'blender://scene/current', text: JSON.stringify({ error: result.error }) }] };
    } catch (err: any) {
      return { contents: [{ uri: 'blender://scene/current', text: JSON.stringify({ error: err.message }) }] };
    }
  }
);

// ── Resource: blender://object/{id} ────────────────────────────
server.resource(
  'blender-object',
  new ResourceTemplate('blender://object/{objectId}', { list: undefined }),
  async (uri) => {
    const objectId = uri.pathname.split('/').pop() || '';
    try {
      const result = await sendBlenderCommand('blender.inspect_object', { objectId });
      if (result.success && result.data) {
        return {
          contents: [{ uri: `blender://object/${objectId}`, text: JSON.stringify(result.data, null, 2) }],
        };
      }
      return { contents: [{ uri: `blender://object/${objectId}`, text: JSON.stringify({ error: result.error }) }] };
    } catch (err: any) {
      return { contents: [{ uri: `blender://object/${objectId}`, text: JSON.stringify({ error: err.message }) }] };
    }
  }
);

// ── Prompt: scene_audit ────────────────────────────────────────
server.prompt(
  'blender_scene_audit',
  'Generate a structured audit of the current Blender scene including object count, polygon count, material usage, and modifier stack summary.',
  {},
  async () => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text:
            'Audit the current Blender scene. Provide: ' +
            '1. Total object count by type (MESH, LIGHT, CAMERA, etc.) ' +
            '2. Total polygon count ' +
            '3. Material count and names ' +
            '4. Modifier summary per object ' +
            '5. Active render engine and version. ' +
            'Do not execute any Blender commands — this is a read-only audit.',
        },
      },
    ],
  })
);

// ── Prompt: material_review ────────────────────────────────────
server.prompt(
  'blender_material_review',
  'Review all materials assigned in the scene and provide suggestions for optimization or consistency.',
  {},
  async () => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text:
            'Review the materials in this Blender scene. For each material, report: ' +
            'name, node type, metallic value, roughness value. ' +
            'Suggest optimizations like reducing unnecessary texture lookups or standardizing roughness values. ' +
            'Do not modify any materials.',
        },
      },
    ],
  })
);

// ── Start stdio transport ──────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[PaneTera Blender MCP] Server started on stdio');
}

main().catch((err) => {
  console.error('[PaneTera Blender MCP] Failed to start:', err);
  process.exit(1);
});

export { server as blenderMcpServer };
