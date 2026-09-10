// server/mcp/reaperMcpServer.ts
//
// PaneTera REAPER MCP Server — wraps the live REAPER bridge
// via TCP socket and exposes it as a Model Context Protocol server.
//
// Launch with: tsx server/mcp/reaperMcpServer.ts

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { sendReaperCommand } from '../creative/reaperClient.js';

const server = new McpServer({
  name: 'PaneTera REAPER',
  version: '1.0.0',
});

// ── Tool: get_project_summary ──────────────────────────────────
server.tool(
  'reaper.get_project_summary',
  'Returns tempo, sample rate, tracks, active FX, routing sends, and markers from the live REAPER project.',
  {
    includeFxParameters: z.boolean().optional().default(false).describe('Include FX parameters'),
  },
  async (args) => {
    try {
      const result = await sendReaperCommand<{
        runtime: { reaperVersion: string; sampleRate: number; tempoBpm: number; isConnected: boolean };
        projectName: string; projectPath: string;
        tracks: Array<{
          guid: string; index: number; name: string;
          volumeDb: number; pan: number;
          isMuted: boolean; isSoloed: boolean; isArmed: boolean;
          fxList: Array<{ id: string; index: number; name: string; isEnabled: boolean }>;
          sends: Array<{ targetTrackGuid: string; targetTrackName: string; volumeDb: number; isMuted: boolean }>;
          peakLeftDb?: number; peakRightDb?: number; stateDigest: string;
        }>;
        markers: Array<{ id: number; name: string; positionSeconds: number; isRegion: boolean }>;
        masterTrack?: { volumeDb: number; peakLeftDb: number; peakRightDb: number; lufsIntegrated: number };
      }>('reaper.get_project_summary', { includeFxParameters: args.includeFxParameters });

      if (result.success && result.data) {
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }, null, 2) }], isError: true };
    } catch (err: any) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }, null, 2) }], isError: true };
    }
  }
);

// ── Tool: get_track_peaks ──────────────────────────────────────
server.tool(
  'reaper.get_track_peaks',
  'Returns real-time peak dB levels for specified tracks.',
  {
    trackGuids: z.array(z.string()).optional().describe('Track GUIDs to read peaks for'),
  },
  async (args) => {
    try {
      const result = await sendReaperCommand<Array<{
        guid: string; peakLeftDb: number; peakRightDb: number;
      }>>('reaper.get_track_peaks', { trackGuids: args.trackGuids || [] });

      if (result.success && result.data) {
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }, null, 2) }], isError: true };
    } catch (err: any) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }, null, 2) }], isError: true };
    }
  }
);

// ── Tool: set_track_gain ───────────────────────────────────────
server.tool(
  'reaper.set_track_gain',
  'Sets or adjusts the fader volume (in dB) on a specific track. Propose mode requires approval.',
  {
    trackGuid: z.string().describe('Track GUID'),
    gainDb: z.number().describe('Volume adjustment or absolute fader level in dB'),
    relative: z.boolean().optional().default(false).describe('If true, adds to current gain'),
    expectedStateDigest: z.string().optional().describe('Precondition state digest hash for approval'),
  },
  async (args) => {
    try {
      const result = await sendReaperCommand<{ trackGuid: string; newGain: number }>(
        'reaper.set_track_gain',
        { trackGuid: args.trackGuid, gainDb: args.gainDb }
      );

      if (result.success && result.data) {
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }, null, 2) }], isError: true };
    } catch (err: any) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }, null, 2) }], isError: true };
    }
  }
);

// ── Tool: set_track_pan ────────────────────────────────────────
server.tool(
  'reaper.set_track_pan',
  'Adjusts the stereo pan (-1.0 Left to +1.0 Right) for a specific track.',
  {
    trackGuid: z.string().describe('Track GUID'),
    pan: z.number().min(-1).max(1).describe('Pan value (-1.0 to 1.0)'),
    expectedStateDigest: z.string().optional().describe('Precondition state digest hash'),
  },
  async (args) => {
    try {
      const result = await sendReaperCommand<{ trackGuid: string; newPan: number }>(
        'reaper.set_track_pan', { trackGuid: args.trackGuid, pan: args.pan }
      );

      if (result.success && result.data) {
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }, null, 2) }], isError: true };
    } catch (err: any) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }, null, 2) }], isError: true };
    }
  }
);

// ── Tool: add_fx ───────────────────────────────────────────────
server.tool(
  'reaper.add_fx',
  'Inserts a plugin/VST effect into a track FX chain. Propose mode requires approval.',
  {
    trackGuid: z.string().describe('Track GUID'),
    fxName: z.string().describe('Plugin name, e.g. ReaEQ, ReaComp, ReaDelay'),
    presetName: z.string().optional().describe('Optional preset name'),
    initialParameters: z.record(z.string(), z.number()).optional().default({}).describe('Initial FX parameters'),
    expectedStateDigest: z.string().optional().describe('Precondition state digest hash'),
  },
  async (args) => {
    try {
      const result = await sendReaperCommand<{ trackGuid: string; fxName: string }>(
        'reaper.add_fx', { trackGuid: args.trackGuid, fxName: args.fxName, presetName: args.presetName }
      );

      if (result.success && result.data) {
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }, null, 2) }], isError: true };
    } catch (err: any) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }, null, 2) }], isError: true };
    }
  }
);

// ── Tool: create_send ──────────────────────────────────────────
server.tool(
  'reaper.create_send',
  'Creates a routing send between two tracks.',
  {
    sourceTrackGuid: z.string().describe('Source track GUID'),
    targetTrackGuid: z.string().describe('Target track GUID'),
    volumeDb: z.number().optional().default(0).describe('Send volume'),
    isSidechain: z.boolean().optional().default(false).describe('If true, routes source 1/2 to target 3/4'),
    expectedStateDigest: z.string().optional().describe('Precondition state digest hash'),
  },
  async (args) => {
    try {
      const result = await sendReaperCommand<{ sourceTrackGuid: string; targetTrackGuid: string }>(
        'reaper.create_send', {
          sourceTrackGuid: args.sourceTrackGuid,
          targetTrackGuid: args.targetTrackGuid,
          volumeDb: args.volumeDb,
          isSidechain: args.isSidechain,
        }
      );

      if (result.success && result.data) {
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }, null, 2) }], isError: true };
    } catch (err: any) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }, null, 2) }], isError: true };
    }
  }
);

// ── Tool: get_object_details (all tracks) ──────────────────────
server.tool(
  'reaper.get_project_details',
  'Returns detailed information about all tracks in the REAPER project.',
  {},
  async () => {
    try {
      const result = await sendReaperCommand<{
        tracks: Array<{
          guid: string; name: string; volumeDb: number; pan: number;
          isMuted: boolean; isSoloed: boolean; isArmed: boolean;
          fxList: Array<{ name: string; isEnabled: boolean }>;
          sends: Array<{ targetTrackName: string }>;
          peakLeftDb: number; peakRightDb: number; stateDigest: string;
        }>;
        masterTrack?: { volumeDb: number; peakLeftDb: number; peakRightDb: number };
      }>('reaper.get_project_summary', {});

      if (result.success && result.data) {
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }, null, 2) }], isError: true };
    } catch (err: any) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }, null, 2) }], isError: true };
    }
  }
);

// ── Resource: reaper://project/{id} ────────────────────────────
server.resource(
  'reaper-project',
  'reaper://project/current',
  async () => {
    try {
      const result = await sendReaperCommand('reaper.get_project_summary', {});
      if (result.success && result.data) {
        return { contents: [{ uri: 'reaper://project/current', text: JSON.stringify(result.data, null, 2) }] };
      }
      return { contents: [{ uri: 'reaper://project/current', text: JSON.stringify({ error: result.error }) }] };
    } catch (err: any) {
      return { contents: [{ uri: 'reaper://project/current', text: JSON.stringify({ error: err.message }) }] };
    }
  }
);

// ── Resource: reaper://track/{guid} ────────────────────────────
server.resource(
  'reaper-track',
  new ResourceTemplate('reaper://track/{guid}', { list: undefined }),
  async (uri) => {
    const guid = uri.pathname.split('/').pop() || '';
    try {
      const result = await sendReaperCommand('reaper.get_project_summary', {});
      if (result.success && result.data) {
        const track = (result.data as any).tracks?.find((t: any) => t.guid === guid);
        return { contents: [{ uri: `reaper://track/${guid}`, text: JSON.stringify(track || { error: 'Track not found' }, null, 2) }] };
      }
      return { contents: [{ uri: `reaper://track/${guid}`, text: JSON.stringify({ error: result.error }) }] };
    } catch (err: any) {
      return { contents: [{ uri: `reaper://track/${guid}`, text: JSON.stringify({ error: err.message }) }] };
    }
  }
);

// ── Prompt: mix_review ─────────────────────────────────────────
server.prompt(
  'reaper_mix_review',
  'Review the current REAPER mix including track volumes, pan positions, and FX chain health.',
  {},
  async () => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text:
            'Review the current REAPER mix. Provide: ' +
            '1. Track count and names with volumes and pan ' +
            '2. Peak levels for each track (identify clipping) ' +
            '3. LUFS loudness measurement ' +
            '4. FX chain summary per track ' +
            '5. Send routing summary ' +
            'Do not modify any track settings.',
        },
      },
    ],
  })
);

// ── Prompt: mastering_checklist ────────────────────────────────
server.prompt(
  'reaper_mastering_checklist',
  'Generate a mastering checklist for the current REAPER project.',
  {},
  async () => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text:
            'Generate a mastering checklist for this REAPER project: ' +
            '1. Verify integrated LUFS is between -14 and -16 ' +
            '2. Check true peak is below -1 dBTP ' +
            '3. Verify stereo field width ' +
            '4. Check for any clipping tracks ' +
            '5. Review FX chain quality ' +
            'Do not execute any commands — this is a read-only checklist.',
        },
      },
    ],
  })
);

// ── Start stdio transport ──────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[PaneTera REAPER MCP] Server started on stdio');
}

main().catch((err) => {
  console.error('[PaneTera REAPER MCP] Failed to start:', err);
  process.exit(1);
});

export { server as reaperMcpServer };
