// src/components/workstation/CockpitStatusBar.tsx
//
// The cockpit: an always-on strip beneath the top bar that answers, at a glance,
// "what is happening right now" without opening a drawer. It carries the session,
// the current run status, any approvals waiting, and Headroom as an ambient gauge.
//
// It is a quiet instrument, not a dashboard. Warm palette only, colour reserved
// for meaning: neutral when idle, violet while working, brass when something is
// waiting on the person, green when a run has just succeeded. No emojis.

import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { accent, ink, radius, status, surface, typography } from '../../theme/cssTokens';

export type CockpitRunStatus = 'idle' | 'working' | 'awaiting-approval' | 'succeeded' | 'failed';

export interface CockpitSummary {
  /** Short, human-facing session label, e.g. "Session a1b2c3". */
  sessionLabel: string;
  /** The current run's coarse status. */
  runStatus: CockpitRunStatus;
  /** How many governed actions are waiting on the person. */
  approvalsWaiting: number;
  /** Whether a Headroom capsule is currently in play. */
  headroomActive: boolean;
  /** Ambient fill for the Headroom gauge, 0..1. */
  headroomLevel: number;
}

// Label and colour for a run status. Pure, so the mapping is unit-tested without
// rendering. Colour follows the contract: idle is neutral (absence of a problem,
// not a success), working is violet, waiting is brass, success earns green.
export function cockpitStatusMeta(runStatus: CockpitRunStatus): { label: string; color: string } {
  switch (runStatus) {
    case 'working': return { label: 'Working', color: accent.violet };
    case 'awaiting-approval': return { label: 'Awaiting approval', color: status.brass };
    case 'succeeded': return { label: 'Done', color: status.success };
    case 'failed': return { label: 'Failed', color: status.danger };
    case 'idle':
    default: return { label: 'Idle', color: status.neutral };
  }
}

// Clamp an ambient level (0..1) to a gauge width percentage. Pure and defended
// against NaN or out-of-range input.
export function gaugeWidthPercent(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.round(Math.max(0, Math.min(1, level)) * 100);
}

export function CockpitStatusBar({ summary }: { summary: CockpitSummary }): React.ReactElement {
  const meta = cockpitStatusMeta(summary.runStatus);
  const gauge = gaugeWidthPercent(summary.headroomLevel);
  const pulsing = summary.runStatus === 'working';

  return (
    <Box
      role="status"
      aria-label="Cockpit status"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: { xs: 1.5, md: 2.5 },
        height: 30,
        minHeight: 30,
        borderBottom: `1px solid ${surface.border}`,
        backgroundColor: surface.sunken,
        overflow: 'hidden',
      }}
    >
      {/* Session */}
      <Typography
        sx={{ color: ink.muted, fontFamily: typography.mono, fontSize: '0.6875rem', whiteSpace: 'nowrap', flexShrink: 0 }}
      >
        {summary.sessionLabel}
      </Typography>

      <Box sx={{ width: '1px', height: 14, backgroundColor: surface.border, flexShrink: 0 }} />

      {/* Run status */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
        <Box
          aria-hidden
          sx={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: meta.color,
            ...(pulsing
              ? { animation: 'cockpitPulse 1.4s ease-in-out infinite', '@keyframes cockpitPulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.35 } } }
              : {}),
          }}
        />
        <Typography sx={{ color: ink.secondary, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
          {meta.label}
        </Typography>
      </Box>

      {/* Approvals waiting — shown only when something is actually waiting. */}
      {summary.approvalsWaiting > 0 && (
        <>
          <Box sx={{ width: '1px', height: 14, backgroundColor: surface.border, flexShrink: 0 }} />
          <Typography
            sx={{ color: status.brass, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {summary.approvalsWaiting} {summary.approvalsWaiting === 1 ? 'approval waiting' : 'approvals waiting'}
          </Typography>
        </>
      )}

      <Box sx={{ flex: 1 }} />

      {/* Headroom ambient gauge */}
      <Tooltip title={summary.headroomActive ? 'Headroom context in play' : 'No Headroom context active'}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
          <Typography sx={{ color: ink.muted, fontSize: '0.6875rem', whiteSpace: 'nowrap' }}>
            Headroom
          </Typography>
          <Box
            role="meter"
            aria-label="Headroom context level"
            aria-valuenow={gauge}
            aria-valuemin={0}
            aria-valuemax={100}
            sx={{ width: 56, height: 5, borderRadius: `${radius.pill}px`, backgroundColor: surface.border, overflow: 'hidden' }}
          >
            <Box
              sx={{
                width: `${gauge}%`,
                height: '100%',
                borderRadius: `${radius.pill}px`,
                backgroundColor: summary.headroomActive ? accent.violet : ink.muted,
                transition: 'width 240ms ease',
              }}
            />
          </Box>
        </Box>
      </Tooltip>
    </Box>
  );
}
