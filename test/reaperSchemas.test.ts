// test/reaperSchemas.test.ts
//
// Tests for REAPER capability definitions, state digests, and gain conversions.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  REAPER_CAPABILITIES,
  computeReaperTrackDigest,
  computeReaperProjectDigest,
  dbToLinear,
  linearToDb,
} from '../bridges/reaper/src/schemas';
import type { ReaperTrackState, ReaperProjectState } from '../src/surfaces/reaperSurface';

describe('REAPER Capabilities & Schemas', () => {
  it('declares orthogonal effects and permissions correctly', () => {
    assert.strictEqual(REAPER_CAPABILITIES['reaper.get_project_summary'].effect, 'observe');
    assert.strictEqual(REAPER_CAPABILITIES['reaper.get_project_summary'].permission, 'auto-invocable');

    assert.strictEqual(REAPER_CAPABILITIES['reaper.set_track_gain'].effect, 'mutate');
    assert.strictEqual(REAPER_CAPABILITIES['reaper.set_track_gain'].permission, 'proposable');

    assert.strictEqual(REAPER_CAPABILITIES['reaper.add_fx'].effect, 'mutate');
    assert.strictEqual(REAPER_CAPABILITIES['reaper.add_fx'].permission, 'proposable');

    assert.strictEqual(REAPER_CAPABILITIES['reaper.render_stems'].effect, 'external-output');
    assert.strictEqual(REAPER_CAPABILITIES['reaper.render_stems'].permission, 'proposable');

    assert.strictEqual(REAPER_CAPABILITIES['reaper.execute_reascript'].effect, 'raw-execution');
    assert.strictEqual(REAPER_CAPABILITIES['reaper.execute_reascript'].permission, 'denied');
  });

  it('converts decibels and linear gain accurately', () => {
    assert.strictEqual(Math.round(dbToLinear(0) * 100) / 100, 1.0);
    assert.strictEqual(Math.round(dbToLinear(6) * 100) / 100, 2.0); // +6dB is ~2x amplitude
    assert.strictEqual(Math.round(dbToLinear(-6) * 100) / 100, 0.5); // -6dB is ~0.5x amplitude

    assert.strictEqual(Math.round(linearToDb(1.0)), 0);
    assert.strictEqual(Math.round(linearToDb(2.0)), 6);
    assert.strictEqual(Math.round(linearToDb(0.5)), -6);
  });

  it('computes deterministic track state digest', () => {
    const track: ReaperTrackState = {
      guid: '{TRK-VOCAL-001}',
      index: 0,
      name: 'Lead Vocal',
      volumeDb: 0.0,
      pan: 0.0,
      isMuted: false,
      isSoloed: false,
      isArmed: false,
      fxList: [{ id: 'fx-1', index: 0, name: 'ReaEQ', isEnabled: true }],
      sends: [],
    };

    const d1 = computeReaperTrackDigest(track);
    const d2 = computeReaperTrackDigest(track);
    assert.strictEqual(d1, d2);
    assert.ok(d1.startsWith('sha256:'));

    // Changing volume changes the digest
    const modifiedTrack = { ...track, volumeDb: 2.0 };
    const d3 = computeReaperTrackDigest(modifiedTrack);
    assert.notStrictEqual(d1, d3);
  });

  it('computes deterministic project digest', () => {
    const project: ReaperProjectState = {
      runtime: {
        reaperVersion: '7.79',
        sampleRate: 48000,
        tempoBpm: 120,
        timeSignature: '4/4',
        isPlaying: false,
        isRecording: false,
        playheadSeconds: 0,
      },
      tracks: [
        {
          guid: '{TRK-1}',
          index: 0,
          name: 'Kick',
          volumeDb: -3.0,
          pan: 0,
          isMuted: false,
          isSoloed: false,
          isArmed: false,
          fxList: [],
          sends: [],
        },
      ],
      markers: [],
    };

    const d1 = computeReaperProjectDigest(project);
    const d2 = computeReaperProjectDigest(project);
    assert.strictEqual(d1, d2);
    assert.ok(d1.startsWith('sha256:'));
  });
});
