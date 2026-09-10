// bridges/reaper/src/schemas.ts
//
// Capabilities, schemas, and state digest utilities for REAPER MCP Bridge.

import { createHash } from 'node:crypto';
import type {
  ReaperCapabilityDeclaration,
} from './types';
import type { ReaperTrackState, ReaperProjectState } from '../../../src/surfaces/reaperSurface';

// ─── Capability Declarations ──────────────────────────────────────

export const REAPER_CAPABILITIES: Record<string, ReaperCapabilityDeclaration> = {
  'reaper.get_project_summary': {
    id: 'reaper.get_project_summary',
    name: 'Get Project Summary',
    description: 'Returns tempo, sample rate, tracks, active FX, routing sends, and markers.',
    effect: 'observe',
    permission: 'auto-invocable',
    inputSchema: {
      type: 'object',
      properties: {
        includeFxParameters: { type: 'boolean' },
      },
    },
  },
  'reaper.get_track_peaks': {
    id: 'reaper.get_track_peaks',
    name: 'Get Track Peaks',
    description: 'Returns real-time or snapshot peak dB levels and loudness metrics.',
    effect: 'observe',
    permission: 'auto-invocable',
    inputSchema: {
      type: 'object',
      properties: {
        trackGuids: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  'reaper.set_track_gain': {
    id: 'reaper.set_track_gain',
    name: 'Set Track Gain',
    description: 'Sets or adjusts the fader volume (in dB) on a specific track.',
    effect: 'mutate',
    permission: 'proposable',
    inputSchema: {
      type: 'object',
      required: ['trackGuid', 'gainDb', 'expectedStateDigest'],
      properties: {
        trackGuid: { type: 'string' },
        gainDb: { type: 'number', description: 'Volume adjustment or absolute fader level in dB' },
        relative: { type: 'boolean', description: 'If true, adds to current gain; if false, sets exact fader' },
        expectedStateDigest: { type: 'string', description: 'Precondition state digest hash' },
      },
    },
  },
  'reaper.set_track_pan': {
    id: 'reaper.set_track_pan',
    name: 'Set Track Pan',
    description: 'Adjusts the stereo pan (-1.0 Left to +1.0 Right) for a specific track.',
    effect: 'mutate',
    permission: 'proposable',
    inputSchema: {
      type: 'object',
      required: ['trackGuid', 'pan', 'expectedStateDigest'],
      properties: {
        trackGuid: { type: 'string' },
        pan: { type: 'number', minimum: -1.0, maximum: 1.0 },
        expectedStateDigest: { type: 'string' },
      },
    },
  },
  'reaper.add_fx': {
    id: 'reaper.add_fx',
    name: 'Add FX Plugin',
    description: 'Inserts a plugin/VST effect (e.g. ReaEQ, ReaComp) into a track FX chain.',
    effect: 'mutate',
    permission: 'proposable',
    inputSchema: {
      type: 'object',
      required: ['trackGuid', 'fxName', 'expectedStateDigest'],
      properties: {
        trackGuid: { type: 'string' },
        fxName: { type: 'string', description: 'Name of the effect, e.g. ReaEQ, ReaComp, ReaDelay' },
        presetName: { type: 'string' },
        initialParameters: { type: 'object' },
        expectedStateDigest: { type: 'string' },
      },
    },
  },
  'reaper.create_send': {
    id: 'reaper.create_send',
    name: 'Create Send Routing',
    description: 'Creates a routing send between two tracks, with optional sidechain channel assignment.',
    effect: 'mutate',
    permission: 'proposable',
    inputSchema: {
      type: 'object',
      required: ['sourceTrackGuid', 'targetTrackGuid', 'expectedStateDigest'],
      properties: {
        sourceTrackGuid: { type: 'string' },
        targetTrackGuid: { type: 'string' },
        volumeDb: { type: 'number' },
        isSidechain: { type: 'boolean', description: 'Routes source channels 1/2 to target auxiliary channels 3/4' },
        expectedStateDigest: { type: 'string' },
      },
    },
  },
  'reaper.render_stems': {
    id: 'reaper.render_stems',
    name: 'Render Audio Stems',
    description: 'Renders selected tracks or stems to disk in high-quality uncompressed audio format.',
    effect: 'external-output',
    permission: 'proposable',
    inputSchema: {
      type: 'object',
      required: ['trackGuids', 'outputDirectory', 'expectedStateDigest'],
      properties: {
        trackGuids: { type: 'array', items: { type: 'string' } },
        outputDirectory: { type: 'string' },
        format: { type: 'string', enum: ['WAV_24BIT', 'WAV_32FLOAT', 'FLAC'] },
        sampleRate: { type: 'number' },
        expectedStateDigest: { type: 'string' },
      },
    },
  },
  'reaper.execute_reascript': {
    id: 'reaper.execute_reascript',
    name: 'Execute ReaScript Lua',
    description: 'Developer escape hatch: executes arbitrary Lua code in REAPER ReaScript runtime.',
    effect: 'raw-execution',
    permission: 'denied',
    inputSchema: {
      type: 'object',
      required: ['scriptLua', 'description'],
      properties: {
        scriptLua: { type: 'string' },
        description: { type: 'string' },
        expectedStateDigest: { type: 'string' },
      },
    },
  },
};

// ─── Gain & dB Conversion Utilities ───────────────────────────────

/**
 * Converts a decibel value to a linear amplitude factor (1.0 = 0 dB).
 */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Converts a linear amplitude factor to decibels (0.0 = -Infinity dB).
 */
export function linearToDb(linear: number): number {
  if (linear <= 0.000001) return -150; // Noise floor floor
  return 20 * Math.log10(linear);
}

// ─── State Digest Utilities ───────────────────────────────────────

/**
 * Computes a deterministic SHA-256 state digest for a specific REAPER track.
 */
export function computeReaperTrackDigest(track: ReaperTrackState): string {
  const norm = {
    guid: track.guid,
    name: track.name,
    volumeDb: Math.round(track.volumeDb * 100) / 100,
    pan: Math.round(track.pan * 100) / 100,
    isMuted: track.isMuted,
    isSoloed: track.isSoloed,
    fxCount: track.fxList.length,
    fxNames: track.fxList.map((f) => f.name),
    sends: track.sends.map((s) => ({
      target: s.targetTrackGuid,
      vol: Math.round(s.volumeDb * 100) / 100,
    })),
  };

  return `sha256:${createHash('sha256').update(JSON.stringify(norm)).digest('hex')}`;
}

/**
 * Computes a deterministic SHA-256 state digest for the entire REAPER project.
 */
export function computeReaperProjectDigest(project: ReaperProjectState): string {
  const trackDigests = (project.tracks || [])
    .map((t) => `${t.guid}:${computeReaperTrackDigest(t)}`)
    .sort()
    .join(';');

  const summary = {
    sampleRate: project.runtime.sampleRate,
    tempoBpm: project.runtime.tempoBpm,
    trackDigests,
  };

  return `sha256:${createHash('sha256').update(JSON.stringify(summary)).digest('hex')}`;
}
