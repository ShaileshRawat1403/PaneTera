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

import type { SurfaceDescriptor } from './types';
import {
  describeAppConnection,
  isRecord,
  optionalString,
  presenceForAppConnection,
  type AppConnectionState,
  type AppObservation,
} from './appConnection';

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
}

/** One successfully observed REAPER project, as reported by the bridge. */
export interface ReaperProjectState {
  runtime: ReaperRuntimeState;
  projectName?: string;
  projectPath?: string;
  tracks: ReaperTrackState[];
  selectedTrackGuid?: string;
  markers: ReaperMarkerState[];
  masterTrack?: ReaperMasterTrackState;
  stateDigest?: string;
}

/**
 * What the workstation knows about REAPER (ADR-004).
 *
 * `project` and `observedAt` exist only after a bridge observation succeeds.
 * A later failure changes `connection` but keeps the last project, which then
 * projects as a snapshot rather than as live state.
 */
export interface ReaperSourceState {
  connection: AppConnectionState;
  /** Time of the last successful observation. */
  observedAt?: string;
  /** Detail of the most recent failed observation. */
  connectionError?: string;
  /** The last successfully observed project. */
  project?: ReaperProjectState;
}

// ─── Projection ───────────────────────────────────────────────────

/**
 * Projects REAPER source state into a SurfaceDescriptor.
 *
 * This is a pure function. It does not:
 *   - mutate the input
 *   - access REAPER APIs, sockets, or stores
 *   - execute any commands
 *   - return React components
 *
 * Presence is 'live' only while connected with an observed project; a
 * project retained from an earlier observation is a 'snapshot'.
 */
export function projectReaperSurface(source: ReaperSourceState): SurfaceDescriptor {
  const { project } = source;
  const live = source.connection === 'connected' && project !== undefined;

  const title = project?.projectName ? `REAPER · ${project.projectName}` : 'REAPER Project';
  let subtitle = describeAppConnection(source.connection, source.observedAt);
  let viewMode: string | undefined;
  if (project) {
    const { runtime } = project;
    if (live) {
      subtitle = `${runtime.tempoBpm} BPM · ${runtime.timeSignature} · ${runtime.sampleRate / 1000}kHz (v${runtime.reaperVersion})`;
    }
    const transportStatus = runtime.isRecording ? 'REC' : runtime.isPlaying ? 'PLAY' : 'STOP';
    viewMode = `${project.tracks.length} tracks · ${transportStatus}`;
  }

  return {
    id: `reaper:${project?.projectName || 'project'}`,
    kind: 'local-app',
    appId: 'reaper',

    identity: {
      title,
      subtitle,
      icon: 'wave',
    },

    state: {
      presence: presenceForAppConnection(source.connection, project !== undefined),
    },

    // No actions yet. Every governed REAPER operation needs arguments this
    // surface cannot collect, and a proposal without them is invalid (ADR-005).
    // Observe actions were removed earlier because nothing performed them.
    actions: [],

    view: {
      mode: viewMode,
      canSplit: true,
      canClose: true,
    },

    renderer: {
      type: 'reaper-project-state',
      payload: {
        connection: source.connection,
        observedAt: source.observedAt ?? null,
        connectionError: source.connectionError ?? null,
        runtime: project
          ? {
              reaperVersion: project.runtime.reaperVersion,
              apiVersion: project.runtime.apiVersion ?? null,
              sampleRate: project.runtime.sampleRate,
              tempoBpm: project.runtime.tempoBpm,
              timeSignature: project.runtime.timeSignature,
              isPlaying: project.runtime.isPlaying,
              isRecording: project.runtime.isRecording,
              playheadSeconds: project.runtime.playheadSeconds,
            }
          : null,
        projectName: project?.projectName ?? null,
        projectPath: project?.projectPath ?? null,
        tracks: project?.tracks ?? [],
        selectedTrackGuid: project?.selectedTrackGuid ?? null,
        markers: project?.markers ?? [],
        masterTrack: project?.masterTrack ?? null,
        stateDigest: project?.stateDigest ?? null,
      },
    },
  };
}

// ─── Observation ──────────────────────────────────────────────────

/**
 * Reads a bridge project payload, or returns null when required fields are
 * missing. The bridge's own connectivity field is deliberately not carried
 * over: an application reporting itself connected is not evidence.
 */
export function parseReaperProject(data: unknown): ReaperProjectState | null {
  if (!isRecord(data)) return null;
  const runtime = data.runtime;
  if (!isRecord(runtime) || !Array.isArray(data.tracks) || !Array.isArray(data.markers)) return null;
  if (
    typeof runtime.reaperVersion !== 'string'
    || typeof runtime.sampleRate !== 'number'
    || typeof runtime.tempoBpm !== 'number'
    || typeof runtime.timeSignature !== 'string'
    || typeof runtime.isPlaying !== 'boolean'
    || typeof runtime.isRecording !== 'boolean'
    || typeof runtime.playheadSeconds !== 'number'
  ) {
    return null;
  }

  return {
    runtime: {
      reaperVersion: runtime.reaperVersion,
      apiVersion: optionalString(runtime.apiVersion),
      sampleRate: runtime.sampleRate,
      tempoBpm: runtime.tempoBpm,
      timeSignature: runtime.timeSignature,
      isPlaying: runtime.isPlaying,
      isRecording: runtime.isRecording,
      playheadSeconds: runtime.playheadSeconds,
    },
    projectName: optionalString(data.projectName),
    projectPath: optionalString(data.projectPath),
    tracks: data.tracks as ReaperTrackState[],
    selectedTrackGuid: optionalString(data.selectedTrackGuid),
    markers: data.markers as ReaperMarkerState[],
    masterTrack: isRecord(data.masterTrack) ? (data.masterTrack as unknown as ReaperMasterTrackState) : undefined,
    stateDigest: optionalString(data.stateDigest),
  };
}

/**
 * Folds one observation into source state. Success replaces the project and
 * observedAt; failure changes only the connection, so the last observed
 * project stays visible as a snapshot.
 */
export function applyReaperObservation(previous: ReaperSourceState, observation: AppObservation): ReaperSourceState {
  if (observation.connection === 'connected') {
    const project = parseReaperProject(observation.data);
    if (project && observation.observedAt) {
      return { connection: 'connected', observedAt: observation.observedAt, project };
    }
    return { ...previous, connection: 'error', connectionError: 'The REAPER bridge returned a project PaneTera could not read.' };
  }
  return { ...previous, connection: observation.connection, connectionError: observation.error };
}
