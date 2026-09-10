// src/components/workbench/ReaperStateCanvas.tsx
//
// Studio Console Mixer Canvas for REAPER DAW in PaneTera.
// Combines hardware-style channel strips with vertical dB faders,
// true peak meters, LUFS loudness indicators, and FX slot chains.

import React, { useState } from 'react';
import { Box, Typography, Chip, Slider, Tooltip } from '@mui/material';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import SpeedIcon from '@mui/icons-material/Speed';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ExtensionIcon from '@mui/icons-material/Extension';
import { surface, ink, accent, status, radius, typography } from '../../theme/cssTokens';
import type { ReaperProjectState, ReaperTrackState } from '../../surfaces/reaperSurface';

export interface ReaperStateCanvasProps {
  /** An observed project. Never sample content (ADR-004). */
  state: ReaperProjectState;
  onSelectTrack?: (trackIndex: number) => void;
  onSetTrackGain?: (trackIndex: number, gainDb: number) => void;
}

export function ReaperStateCanvas({
  state,
  onSelectTrack,
  onSetTrackGain,
}: ReaperStateCanvasProps): React.ReactElement {
  const [selectedTrackIndex, setSelectedTrackIndex] = useState<number>(0);

  const handleTrackClick = (idx: number) => {
    setSelectedTrackIndex(idx);
    onSelectTrack?.(idx);
  };

  const getMeterColor = (db: number) => {
    if (db > 0) return '#ef4444'; // Clip red
    if (db > -6) return '#f59e0b'; // Warm amber
    if (db > -18) return '#22c55e'; // Healthy green
    return '#3b82f6'; // Quiet blue
  };

  const dbToPercent = (db: number) => {
    // Map -60 dB .. +12 dB to 0% .. 100%
    const clamped = Math.max(-60, Math.min(12, db));
    return ((clamped + 60) / 72) * 100;
  };

  return (
    <Box
      data-testid="reaper-state-canvas"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        backgroundColor: '#0c0e12',
        color: ink.primary,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* ── Top Master Console Bar ──────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          py: 1.5,
          backgroundColor: '#11141a',
          borderBottom: `1px solid ${surface.border}`,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GraphicEqIcon sx={{ color: accent.violet, fontSize: 22 }} />
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: 0.2 }}>
                {state.projectName || 'Unsaved project'}
              </Typography>
              <Typography variant="caption" sx={{ color: ink.muted, fontSize: '0.7rem', fontFamily: typography.mono }}>
                REAPER {state.runtime.reaperVersion} · {state.tracks.length} Channels · {state.runtime.sampleRate / 1000} kHz
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              icon={<SpeedIcon sx={{ fontSize: '13px !important' }} />}
              label={`${state.runtime.tempoBpm} BPM`}
              size="small"
              sx={{ backgroundColor: '#181c24', color: '#38bdf8', fontFamily: typography.mono, fontWeight: 700, fontSize: '0.72rem', border: '1px solid #272c36' }}
            />
            <Chip
              label={state.runtime.timeSignature}
              size="small"
              sx={{ backgroundColor: '#181c24', color: ink.secondary, fontFamily: typography.mono, fontSize: '0.72rem', border: '1px solid #272c36' }}
            />
          </Box>
        </Box>

        {/* Master Bus Loudness Meter (LUFS + Peak) */}
        {state.masterTrack && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <Typography variant="caption" sx={{ color: ink.muted, fontSize: '0.65rem', fontWeight: 700 }}>
                TRUE PEAK
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: typography.mono,
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  color: (state.masterTrack.peakLeftDb || 0) > 0 ? '#ef4444' : '#22c55e',
                }}
              >
                {(state.masterTrack.peakLeftDb || -12).toFixed(1)} dBTP
              </Typography>
            </Box>

            {state.masterTrack.lufsIntegrated !== undefined && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <Typography variant="caption" sx={{ color: ink.muted, fontSize: '0.65rem', fontWeight: 700 }}>
                  INTEGRATED LUFS
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: typography.mono,
                    fontWeight: 800,
                    fontSize: '0.86rem',
                    color: state.masterTrack.lufsIntegrated >= -14.5 && state.masterTrack.lufsIntegrated <= -13.5 ? '#22c55e' : '#f59e0b',
                  }}
                >
                  {state.masterTrack.lufsIntegrated.toFixed(1)} LUFS
                </Typography>
              </Box>
            )}

            {/* Master Stereo Peak LED Bars */}
            <Box sx={{ display: 'flex', gap: 0.5, height: 32, width: 24, backgroundColor: '#090b0e', p: 0.5, borderRadius: `${radius.sm}px`, border: '1px solid #272c36' }}>
              <Box sx={{ flex: 1, backgroundColor: '#181c24', display: 'flex', flexDirection: 'column-reverse', borderRadius: '2px', overflow: 'hidden' }}>
                <Box
                  sx={{
                    height: `${dbToPercent(state.masterTrack.peakLeftDb || -24)}%`,
                    backgroundColor: getMeterColor(state.masterTrack.peakLeftDb || -24),
                    transition: 'height 0.1s ease',
                  }}
                />
              </Box>
              <Box sx={{ flex: 1, backgroundColor: '#181c24', display: 'flex', flexDirection: 'column-reverse', borderRadius: '2px', overflow: 'hidden' }}>
                <Box
                  sx={{
                    height: `${dbToPercent(state.masterTrack.peakRightDb || -24)}%`,
                    backgroundColor: getMeterColor(state.masterTrack.peakRightDb || -24),
                    transition: 'height 0.1s ease',
                  }}
                />
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      {/* ── Channel Strip Matrix ────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          gap: 1.5,
          p: 2,
          overflowX: 'auto',
          overflowY: 'hidden',
          backgroundColor: '#090b0e',
          minHeight: 0,
        }}
      >
        {state.tracks.map((track: ReaperTrackState) => {
          const isSelected = track.index === selectedTrackIndex;
          const peakL = track.peakLeftDb ?? -40;
          const peakR = track.peakRightDb ?? -40;

          return (
            <Box
              key={track.index}
              onClick={() => handleTrackClick(track.index)}
              sx={{
                width: 145,
                minWidth: 145,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: isSelected ? '#151922' : '#11141a',
                borderRadius: `${radius.md}px`,
                border: `1px solid ${isSelected ? accent.violet : surface.border}`,
                p: 1.5,
                transition: 'all 0.15s ease',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: isSelected ? '#171d27' : '#141820',
                  borderColor: isSelected ? accent.violet : '#334155',
                },
              }}
            >
              {/* Strip Header */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box sx={{ overflow: 'hidden' }}>
                  <Typography variant="caption" sx={{ color: ink.muted, fontSize: '0.68rem', fontFamily: typography.mono }}>
                    CH {String(track.index + 1).padStart(2, '0')}
                  </Typography>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 700, fontSize: '0.84rem', color: isSelected ? accent.violet : ink.primary }}>
                    {track.name}
                  </Typography>
                </Box>
                {track.stateDigest && (
                  <Chip
                    size="small"
                    label={track.stateDigest.slice(0, 10) + '…'}
                    sx={{ height: 14, fontSize: '0.58rem', fontFamily: typography.mono, backgroundColor: '#0e1117', color: status.brass }}
                  />
                )}
              </Box>

              {/* Fader & Dual Stereo Meter Area */}
              <Box sx={{ flex: 1, display: 'flex', gap: 1, my: 1, minHeight: 120 }}>
                {/* Stereo LED Meters */}
                <Box sx={{ display: 'flex', gap: 0.25, width: 14, height: '100%', backgroundColor: '#090b0e', p: 0.25, borderRadius: '3px', border: '1px solid #1e293b' }}>
                  <Box sx={{ flex: 1, backgroundColor: '#141820', display: 'flex', flexDirection: 'column-reverse', borderRadius: '1px', overflow: 'hidden' }}>
                    <Box sx={{ height: `${dbToPercent(peakL)}%`, backgroundColor: getMeterColor(peakL), transition: 'height 0.1s ease' }} />
                  </Box>
                  <Box sx={{ flex: 1, backgroundColor: '#141820', display: 'flex', flexDirection: 'column-reverse', borderRadius: '1px', overflow: 'hidden' }}>
                    <Box sx={{ height: `${dbToPercent(peakR)}%`, backgroundColor: getMeterColor(peakR), transition: 'height 0.1s ease' }} />
                  </Box>
                </Box>

                {/* Vertical Gain Slider & Gain Value */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: ink.muted, fontSize: '0.68rem' }}>Gain</Typography>
                    <Typography variant="caption" sx={{ color: track.volumeDb === 0 ? ink.primary : '#38bdf8', fontWeight: 800, fontFamily: typography.mono, fontSize: '0.74rem' }}>
                      {track.volumeDb > 0 ? '+' : ''}{track.volumeDb.toFixed(1)} dB
                    </Typography>
                  </Box>

                  <Slider
                    orientation="vertical"
                    size="small"
                    min={-40}
                    max={12}
                    step={0.5}
                    value={track.volumeDb}
                    onChange={(_, val) => typeof val === 'number' && onSetTrackGain?.(track.index, val)}
                    sx={{
                      height: 80,
                      my: 0.5,
                      alignSelf: 'center',
                      color: isSelected ? accent.violet : '#64748b',
                      '& .MuiSlider-thumb': {
                        width: 14,
                        height: 14,
                        borderRadius: `${radius.sm}px`,
                      },
                    }}
                  />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: ink.muted, fontSize: '0.68rem' }}>Pan</Typography>
                    <Typography variant="caption" sx={{ color: ink.secondary, fontFamily: typography.mono, fontSize: '0.72rem' }}>
                      {track.pan === 0 ? 'C' : track.pan < 0 ? `L${Math.round(Math.abs(track.pan) * 100)}` : `R${Math.round(track.pan * 100)}`}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Mute / Solo / Arm Control Buttons */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.5, my: 0.75 }}>
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 0.3,
                    borderRadius: `${radius.sm}px`,
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    backgroundColor: track.isMuted ? '#ef4444' : '#1e293b',
                    color: track.isMuted ? '#ffffff' : ink.muted,
                    cursor: 'pointer',
                  }}
                >
                  M
                </Box>
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 0.3,
                    borderRadius: `${radius.sm}px`,
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    backgroundColor: track.isSoloed ? '#eab308' : '#1e293b',
                    color: track.isSoloed ? '#000000' : ink.muted,
                    cursor: 'pointer',
                  }}
                >
                  S
                </Box>
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 0.3,
                    borderRadius: `${radius.sm}px`,
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    backgroundColor: track.isArmed ? '#ef4444' : '#1e293b',
                    color: track.isArmed ? '#ffffff' : ink.muted,
                    cursor: 'pointer',
                  }}
                >
                  ●
                </Box>
              </Box>

              {/* FX Chain Chips */}
              <Box sx={{ mt: 'auto' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  <ExtensionIcon sx={{ fontSize: 12, color: '#38bdf8' }} />
                  <Typography variant="caption" sx={{ fontSize: '0.66rem', fontWeight: 700, color: ink.muted, textTransform: 'uppercase' }}>
                    FX Slots ({track.fxList.length})
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 65, overflowY: 'auto' }}>
                  {track.fxList.length === 0 ? (
                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: ink.muted, fontStyle: 'italic' }}>
                      (empty)
                    </Typography>
                  ) : (
                    track.fxList.map((fx, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          px: 0.75,
                          py: 0.4,
                          backgroundColor: '#0e1117',
                          borderRadius: `${radius.sm}px`,
                          border: '1px solid #272c36',
                        }}
                      >
                        <Typography noWrap variant="caption" sx={{ fontSize: '0.68rem', fontWeight: 600, color: fx.isEnabled ? '#38bdf8' : ink.muted }}>
                          {fx.name}
                        </Typography>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: fx.isEnabled ? '#22c55e' : '#64748b' }} />
                      </Box>
                    ))
                  )}
                </Box>
              </Box>

              {/* Routing / Sends */}
              {track.sends.length > 0 && (
                <Box sx={{ mt: 0.75, pt: 0.5, borderTop: '1px solid #1e293b' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                    <VolumeUpIcon sx={{ fontSize: 11, color: ink.muted }} />
                    <Typography variant="caption" sx={{ fontSize: '0.62rem', color: ink.muted, textTransform: 'uppercase' }}>
                      Sends ({track.sends.length})
                    </Typography>
                  </Box>
                  {track.sends.map((s, idx) => (
                    <Typography key={idx} noWrap variant="caption" sx={{ display: 'block', fontSize: '0.68rem', color: '#cbd5e1', fontFamily: typography.mono }}>
                      → {s.targetTrackName || 'Send'}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
