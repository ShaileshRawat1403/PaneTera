// src/surfaces/reaperSurface.ts
//
// Pure projection function that transforms existing REAPER source state
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

export interface ReaperFxState {
  id: string;
  index: number;
  name: string;
  isEnabled: boolean;
  presetName?: string;
  parameters?: Record<string, number>;
}

export interface ReaperSendState {
  targetTrackGuid: string;
  targetTrackName: string;
  volumeDb: number;
  isMuted: boolean;
}

export interface ReaperTrackState {
  guid: string;
  index: number;
  name: string;
  volumeDb: number;
  pan: number; // -1.0 (left) to 1.0 (right)
  isMuted: boolean;
  isSoloed: boolean;
  isArmed: boolean;
  fxList: ReaperFxState[];
  sends: ReaperSendState[];
  peakLeftDb?: number;
  peakRightDb?: number;
  stateDigest?: string;
}

export interface ReaperMarkerState {
  id: number;
  name: string;
  positionSeconds: number;
  isRegion: boolean;
  endSeconds?: number;
}

export interface ReaperMasterTrackState {
  volumeDb: number;
  peakLeftDb?: number;
  peakRightDb?: number;
  lufsMomentary?: number;
  lufsIntegrated?: number;
}

export interface ReaperRuntimeState {
  reaperVersion: string;
  apiVersion?: string;
  sampleRate: number;
  tempoBpm: number;
  timeSignature: string;
  isPlaying: boolean;
  isRecording: boolean;
  playheadSeconds: number;
  isConnected: boolean;
}

export interface ReaperSourceState {
  runtime: ReaperRuntimeState;
  projectName?: string;
  projectPath?: string;
  tracks: ReaperTrackState[];
  selectedTrackGuid?: string;
  markers: ReaperMarkerState[];
  masterTrack?: ReaperMasterTrackState;
  stateDigest?: string;
}

// ─── Projection ───────────────────────────────────────────────────

function deriveReaperPresence(runtime: ReaperRuntimeState): SurfacePresence {
  if (runtime.isConnected) return 'live';
  return 'unavailable';
}

function deriveReaperActions(isConnected: boolean): SurfaceAction[] {
  if (!isConnected) return [];

  return [
    {
      id: 'read-peaks',
      label: 'Read Peaks',
      icon: 'volume',
      behavior: 'observe',
    },
    {
      id: 'check-lufs',
      label: 'Check LUFS',
      icon: 'speedometer',
      behavior: 'observe',
    },
    {
      id: 'set-track-gain',
      label: 'Adjust Gain',
      icon: 'sliders',
      behavior: 'propose',
      capabilityRef: {
        connectionId: 'reaper',
        capabilityId: 'reaper.set_track_gain',
      },
    },
    {
      id: 'add-fx',
      label: 'Insert FX',
      icon: 'plus',
      behavior: 'propose',
      capabilityRef: {
        connectionId: 'reaper',
        capabilityId: 'reaper.add_fx',
      },
    },
  ];
}

/**
 * Projects existing REAPER source state into a SurfaceDescriptor.
 *
 * This is a pure function. It does not:
 *   - mutate the input
 *   - access REAPER APIs, sockets, or stores
 *   - execute any commands
 *   - return React components
 */
export function projectReaperSurface(source: ReaperSourceState): SurfaceDescriptor {
  const presence = deriveReaperPresence(source.runtime);
  const actions = deriveReaperActions(source.runtime.isConnected);

  const title = source.projectName ? `REAPER · ${source.projectName}` : 'REAPER Project';
  const subtitle = `${source.runtime.tempoBpm} BPM · ${source.runtime.timeSignature} · ${source.runtime.sampleRate / 1000}kHz (v${source.runtime.reaperVersion})`;

  const transportStatus = source.runtime.isRecording
    ? 'REC'
    : source.runtime.isPlaying
    ? 'PLAY'
    : 'STOP';
  const viewMode = `${source.tracks.length} tracks · ${transportStatus}`;

  return {
    id: `reaper:${source.projectName || 'project'}`,
    kind: 'reaper',

    identity: {
      title,
      subtitle,
      icon: 'wave',
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
      type: 'reaper-project-state',
      payload: {
        runtime: {
          reaperVersion: source.runtime.reaperVersion,
          apiVersion: source.runtime.apiVersion ?? null,
          sampleRate: source.runtime.sampleRate,
          tempoBpm: source.runtime.tempoBpm,
          timeSignature: source.runtime.timeSignature,
          isPlaying: source.runtime.isPlaying,
          isRecording: source.runtime.isRecording,
          playheadSeconds: source.runtime.playheadSeconds,
          isConnected: source.runtime.isConnected,
        },
        projectName: source.projectName ?? null,
        projectPath: source.projectPath ?? null,
        tracks: source.tracks,
        selectedTrackGuid: source.selectedTrackGuid ?? null,
        markers: source.markers,
        masterTrack: source.masterTrack ?? null,
        stateDigest: source.stateDigest ?? null,
      },
    },
  };
}

export function createDefaultReaperState(): ReaperSourceState {
  return {
    runtime: {
      reaperVersion: '7.79',
      apiVersion: '7.79-reascript',
      sampleRate: 48000,
      tempoBpm: 120,
      timeSignature: '4/4',
      isPlaying: false,
      isRecording: false,
      playheadSeconds: 14.5,
      isConnected: true,
    },
    projectName: 'Cinematic_Cue_01.rpp',
    projectPath: '/projects/audio/Cinematic_Cue_01.rpp',
    tracks: [
      {
        guid: '{TRK-KICK-001}',
        index: 0,
        name: 'Kick Drum',
        volumeDb: -2.5,
        pan: 0.0,
        isMuted: false,
        isSoloed: false,
        isArmed: false,
        fxList: [{ id: 'fx-1', index: 0, name: 'ReaEQ', isEnabled: true }],
        sends: [{ targetTrackGuid: '{TRK-BASS-002}', targetTrackName: 'Bass Synth', volumeDb: 0.0, isMuted: false }],
        peakLeftDb: -6.2,
        peakRightDb: -6.2,
        stateDigest: 'sha256:kick-state-v1',
      },
      {
        guid: '{TRK-BASS-002}',
        index: 1,
        name: 'Bass Synth',
        volumeDb: -4.0,
        pan: 0.0,
        isMuted: false,
        isSoloed: false,
        isArmed: false,
        fxList: [{ id: 'fx-2', index: 0, name: 'ReaComp', isEnabled: true }],
        sends: [],
        peakLeftDb: -8.1,
        peakRightDb: -8.0,
        stateDigest: 'sha256:bass-state-v1',
      },
      {
        guid: '{TRK-LEAD-003}',
        index: 2,
        name: 'Lead Melody',
        volumeDb: -1.0,
        pan: -0.15,
        isMuted: false,
        isSoloed: false,
        isArmed: false,
        fxList: [{ id: 'fx-3', index: 0, name: 'ReaDelay', isEnabled: true }],
        sends: [],
        peakLeftDb: -3.5,
        peakRightDb: -3.2,
        stateDigest: 'sha256:lead-state-v1',
      },
    ],
    selectedTrackGuid: '{TRK-KICK-001}',
    markers: [
      { id: 1, name: 'Intro', positionSeconds: 0, isRegion: false },
      { id: 2, name: 'Drop A', positionSeconds: 16, isRegion: true, endSeconds: 32 },
    ],
    masterTrack: {
      volumeDb: 0.0,
      peakLeftDb: -1.2,
      peakRightDb: -1.2,
      lufsMomentary: -14.2,
      lufsIntegrated: -16.0,
    },
    stateDigest: 'sha256:reaper-project-cue-v1',
  };
}
