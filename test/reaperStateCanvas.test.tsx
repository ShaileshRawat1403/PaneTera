// test/reaperStateCanvas.test.tsx
//
// Tests for ReaperStateCanvas component rendering.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReaperStateCanvas } from '../src/components/workbench/ReaperStateCanvas';
import type { ReaperSourceState } from '../src/surfaces/reaperSurface';

function makeReaperSource(): ReaperSourceState {
  return {
    runtime: {
      reaperVersion: '7.79',
      sampleRate: 48000,
      tempoBpm: 120,
      timeSignature: '4/4',
      isPlaying: false,
      isRecording: false,
      playheadSeconds: 0,
      isConnected: true,
    },
    projectName: 'Soundtrack_Cue.rpp',
    tracks: [
      {
        guid: '{TRK-KICK}',
        index: 0,
        name: 'Kick Drum',
        volumeDb: -3.0,
        pan: 0.0,
        isMuted: false,
        isSoloed: false,
        isArmed: false,
        fxList: [{ id: 'fx-1', index: 0, name: 'ReaEQ', isEnabled: true }],
        sends: [{ targetTrackGuid: '{TRK-BASS}', targetTrackName: 'Bass', volumeDb: 0, isMuted: false }],
        peakLeftDb: -6.0,
        peakRightDb: -6.0,
        stateDigest: 'sha256:kick-dig',
      },
      {
        guid: '{TRK-VOCAL}',
        index: 1,
        name: 'Lead Vocal',
        volumeDb: 2.0,
        pan: 0.0,
        isMuted: false,
        isSoloed: false,
        isArmed: false,
        fxList: [{ id: 'fx-2', index: 0, name: 'ReaComp', isEnabled: true }],
        sends: [],
        peakLeftDb: -10.0,
        peakRightDb: -10.0,
        stateDigest: 'sha256:vocal-dig',
      },
    ],
    markers: [],
    masterTrack: {
      volumeDb: 0.0,
      peakLeftDb: -2.5,
      lufsIntegrated: -14.1,
    },
  };
}

describe('ReaperStateCanvas', () => {
  it('renders transport, master loudness, and track table with FX and sends', () => {
    const state = makeReaperSource();
    const html = renderToStaticMarkup(<ReaperStateCanvas state={state} />);

    assert.ok(html.includes('data-testid="reaper-state-canvas"'));
    assert.ok(html.includes('Soundtrack_Cue.rpp'));
    assert.ok(html.includes('120 BPM'));
    assert.ok(html.includes('-14.1 LUFS'));
    assert.ok(html.includes('Kick Drum'));
    assert.ok(html.includes('Lead Vocal'));
    assert.ok(html.includes('+2.0 dB'));
    assert.ok(html.includes('ReaEQ'));
    assert.ok(html.includes('ReaComp'));
    assert.ok(html.includes('→ Bass'));
  });
});
