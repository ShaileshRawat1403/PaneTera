// test/reaperSurface.test.ts
//
// Focused unit tests for REAPER SurfaceDescriptor projection.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyReaperObservation, parseReaperProject, projectReaperSurface } from '../src/surfaces/reaperSurface';
import type { ReaperProjectState, ReaperSourceState } from '../src/surfaces/reaperSurface';
import type { AppConnectionState } from '../src/surfaces/appConnection';
import type { SurfaceDescriptor } from '../src/surfaces/types';

const OBSERVED_AT = '2026-09-10T08:00:00.000Z';

function makeReaperSource(overrides?: Partial<ReaperProjectState>, connection: AppConnectionState = 'connected'): ReaperSourceState {
  return { connection, observedAt: OBSERVED_AT, project: makeReaperProject(overrides) };
}

function makeReaperProject(overrides?: Partial<ReaperProjectState>): ReaperProjectState {
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
        fxList: [
          { id: 'fx-1', index: 0, name: 'ReaEQ', isEnabled: true },
        ],
        sends: [
          { targetTrackGuid: '{TRK-BASS-002}', targetTrackName: 'Bass Synth', volumeDb: 0.0, isMuted: false },
        ],
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
        fxList: [
          { id: 'fx-2', index: 0, name: 'ReaComp', isEnabled: true },
        ],
        sends: [],
        peakLeftDb: -8.1,
        peakRightDb: -8.0,
        stateDigest: 'sha256:bass-state-v1',
      },
      {
        guid: '{TRK-VOCAL-003}',
        index: 2,
        name: 'Lead Vocal',
        volumeDb: 0.0,
        pan: 0.0,
        isMuted: false,
        isSoloed: false,
        isArmed: false,
        fxList: [],
        sends: [],
        peakLeftDb: -12.0,
        peakRightDb: -12.0,
        stateDigest: 'sha256:vocal-state-0db',
      },
    ],
    selectedTrackGuid: '{TRK-VOCAL-003}',
    markers: [
      { id: 1, name: 'Intro', positionSeconds: 0.0, isRegion: false },
      { id: 2, name: 'Verse 1', positionSeconds: 8.0, isRegion: false },
      { id: 3, name: 'Chorus', positionSeconds: 24.0, isRegion: true, endSeconds: 40.0 },
    ],
    masterTrack: {
      volumeDb: 0.0,
      peakLeftDb: -3.1,
      peakRightDb: -3.0,
      lufsMomentary: -14.2,
      lufsIntegrated: -14.0,
    },
    stateDigest: 'sha256:reaper-full-project-v1',
    ...overrides,
  };
}

function assertNoCallbacks(descriptor: SurfaceDescriptor): void {
  for (const action of descriptor.actions) {
    for (const [key, value] of Object.entries(action)) {
      assert.notStrictEqual(
        typeof value,
        'function',
        `SurfaceAction.${key} must not be a function on action "${action.id}"`,
      );
    }
  }
}

function assertNoReactNodes(descriptor: SurfaceDescriptor): void {
  const serialized = JSON.stringify(descriptor);
  assert.ok(!serialized.includes('$$typeof'), 'Descriptor must not contain React markers');
  if (descriptor.identity.icon !== undefined) {
    assert.strictEqual(typeof descriptor.identity.icon, 'string');
  }
  for (const action of descriptor.actions) {
    if (action.icon !== undefined) {
      assert.strictEqual(typeof action.icon, 'string');
    }
  }
  assert.ok(JSON.stringify(descriptor.renderer.payload) !== undefined);
}

describe('projectReaperSurface', () => {
  it('projects a connected REAPER project deterministically', () => {
    const source = makeReaperSource();
    const d1 = projectReaperSurface(source);
    const d2 = projectReaperSurface(source);
    assert.deepStrictEqual(d1, d2, 'Same input must produce identical output');
  });

  it('derives identity with project name and tempo/samplerate in subtitle', () => {
    const source = makeReaperSource();
    const d = projectReaperSurface(source);
    assert.strictEqual(d.kind, 'local-app');
    assert.strictEqual(d.identity.title, 'REAPER · Cinematic_Cue_01.rpp');
    assert.strictEqual(d.identity.subtitle, '120 BPM · 4/4 · 48kHz (v7.79)');
    assert.strictEqual(d.identity.icon, 'wave');
  });

  it('falls back to default title when no project name provided', () => {
    const source = makeReaperSource({ projectName: undefined });
    const d = projectReaperSurface(source);
    assert.strictEqual(d.identity.title, 'REAPER Project');
  });

  it('derives presence=live when connected', () => {
    const source = makeReaperSource();
    const d = projectReaperSurface(source);
    assert.strictEqual(d.state.presence, 'live');
  });

  it('keeps the last observed project as a snapshot when the bridge stops responding', () => {
    const d = projectReaperSurface(makeReaperSource(undefined, 'disconnected'));
    assert.strictEqual(d.state.presence, 'snapshot');
    assert.strictEqual(d.identity.subtitle, `Not connected · last observed ${OBSERVED_AT}`);
    assert.strictEqual(d.actions.length, 0, 'No actions without a live connection');
  });

  it('never claims liveness before an observation succeeds (ADR-004)', () => {
    const cases: Array<[AppConnectionState, string]> = [
      ['unknown', 'unavailable'],
      ['connecting', 'unavailable'],
      ['disconnected', 'disconnected'],
      ['error', 'unavailable'],
      ['connected', 'unavailable'],
    ];
    for (const [connection, presence] of cases) {
      const d = projectReaperSurface({ connection });
      const payload = d.renderer.payload as Record<string, unknown>;
      assert.strictEqual(d.state.presence, presence, connection);
      assert.strictEqual(d.actions.length, 0, connection);
      assert.strictEqual(payload.runtime, null, connection);
      assert.strictEqual(payload.observedAt, null, connection);
      assert.deepStrictEqual(payload.tracks, [], connection);
    }
  });

  it('offers no actions while connected: none can supply valid arguments yet (ADR-005)', () => {
    const d = projectReaperSurface(makeReaperSource());
    assert.strictEqual(d.state.presence, 'live');
    assert.deepStrictEqual(d.actions, []);
  });

  it("applies a successful observation and discards the bridge's own connectivity claim", () => {
    const project = makeReaperProject();
    const data = { ...project, runtime: { ...project.runtime, isConnected: true } };
    const next = applyReaperObservation({ connection: 'connecting' }, { connection: 'connected', observedAt: OBSERVED_AT, data });
    assert.strictEqual(next.connection, 'connected');
    assert.strictEqual(next.observedAt, OBSERVED_AT);
    assert.ok(next.project);
    assert.ok(!('isConnected' in next.project.runtime));
  });

  it('keeps the previous project on failure and rejects unreadable data', () => {
    const previous = makeReaperSource();
    const failed = applyReaperObservation(previous, { connection: 'error', error: 'timed out' });
    assert.strictEqual(failed.connection, 'error');
    assert.strictEqual(failed.project, previous.project);
    assert.strictEqual(failed.observedAt, OBSERVED_AT);

    const unreadable = applyReaperObservation({ connection: 'connecting' }, { connection: 'connected', observedAt: OBSERVED_AT, data: { tracks: [] } });
    assert.strictEqual(unreadable.connection, 'error');
    assert.strictEqual(unreadable.project, undefined);
    assert.strictEqual(parseReaperProject({ ...makeReaperProject(), tracks: {} }), null);
  });

  it('does not mutate source state', () => {
    const source = makeReaperSource();
    const copy = JSON.parse(JSON.stringify(source));
    projectReaperSurface(source);
    assert.deepStrictEqual(source, copy);
  });

  it('contains no callbacks or React elements in descriptor', () => {
    const source = makeReaperSource();
    const d = projectReaperSurface(source);
    assertNoCallbacks(d);
    assertNoReactNodes(d);
  });

  it('renderer payload contains complete track, marker, and master data', () => {
    const source = makeReaperSource();
    const d = projectReaperSurface(source);
    assert.strictEqual(d.renderer.type, 'reaper-project-state');
    const payload = d.renderer.payload as Record<string, unknown>;
    assert.strictEqual(payload.projectName, 'Cinematic_Cue_01.rpp');
    assert.strictEqual(payload.selectedTrackGuid, '{TRK-VOCAL-003}');
    assert.ok(Array.isArray(payload.tracks));
    assert.strictEqual((payload.tracks as unknown[]).length, 3);
    assert.ok(Array.isArray(payload.markers));
    assert.strictEqual((payload.markers as unknown[]).length, 3);
  });

  it('classifies REAPER as a local-app identified by appId (ADR-003)', () => {
    const d = projectReaperSurface(makeReaperSource());
    assert.strictEqual(d.kind, 'local-app');
    assert.strictEqual(d.appId, 'reaper');
    assert.strictEqual(d.renderer.type, 'reaper-project-state');
  });
});
