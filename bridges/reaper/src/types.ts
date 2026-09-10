// bridges/reaper/src/types.ts
//
// Typed domain definitions, effect classifications, and handshake contracts
// for the PaneTera REAPER MCP Bridge.

import type { RigEffectType, RigPermission } from '../../blender/src/types';

export interface ReaperHandshakeInfo {
  reaperVersion: string; // e.g. "7.79"
  apiVersion: string;
  os: string;
  groundingPackVersion: string;
  groundingPackDigest: string;
}

export interface ReaperCapabilityDeclaration {
  id: string;
  name: string;
  description: string;
  effect: RigEffectType;
  permission: RigPermission;
  inputSchema: Record<string, unknown>;
}

// ─── Domain Operation Inputs ──────────────────────────────────────

export interface ReaperGetProjectSummaryInput {
  includeFxParameters?: boolean;
}

export interface ReaperGetTrackPeaksInput {
  trackGuids?: string[];
}

export interface ReaperSetTrackGainInput {
  trackGuid: string;
  gainDb: number;
  relative?: boolean; // If true, adds gainDb to existing gain; if false, sets absolute gain
  expectedStateDigest: string; // Precondition state digest binding
}

export interface ReaperSetTrackPanInput {
  trackGuid: string;
  pan: number; // -1.0 (left) to 1.0 (right)
  expectedStateDigest: string;
}

export interface ReaperAddFxInput {
  trackGuid: string;
  fxName: string; // e.g. "ReaEQ", "ReaComp", "ReaDelay"
  presetName?: string;
  initialParameters?: Record<string, number>;
  expectedStateDigest: string;
}

export interface ReaperSetFxParameterInput {
  trackGuid: string;
  fxIndex: number;
  paramIndex: number;
  value: number; // 0.0 to 1.0 normalized or raw value
  paramName?: string;
  expectedStateDigest: string;
}

export interface ReaperCreateSendInput {
  sourceTrackGuid: string;
  targetTrackGuid: string;
  volumeDb?: number;
  isSidechain?: boolean; // If true, routes source 1/2 to target 3/4
  expectedStateDigest: string;
}

export interface ReaperRenderStemsInput {
  trackGuids: string[];
  outputDirectory: string;
  format?: 'WAV_24BIT' | 'WAV_32FLOAT' | 'FLAC';
  sampleRate?: number;
  renderTimeRange?: 'ENTIRE_PROJECT' | 'TIME_SELECTION' | 'REGIONS';
  expectedStateDigest: string;
}

export interface ReaperExecuteReascriptInput {
  scriptLua: string;
  description: string;
  expectedStateDigest?: string;
}
