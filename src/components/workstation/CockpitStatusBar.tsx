// src/components/workstation/CockpitStatusBar.tsx
//
// The cockpit readout: what is happening right now, at a glance, without
// opening a drawer. Session, run status, approvals waiting, Headroom.
//
// This used to be its own 30px strip beneath a 56px top bar. Both tiers carried
// one idea between them -- where you are and what is happening -- so they are
// now a single 44px bar, and this renders inline inside it. The reclaimed
// height goes to the canvas, which is the part of the screen the product is
// actually about.
//
// It is a quiet instrument, not a dashboard. Warm palette only, colour reserved
// for meaning: neutral when idle, violet while working, brass when something is
// waiting on the person, green when a run has just succeeded. No emojis.
//
// Every value here must be a fact the shell can source. An earlier version
// rendered Headroom as a percentage gauge filled by `items / 8`, where the 8
// had no referent -- nothing bounds a capsule at eight items, so a ninth pinned
// the bar at full and left it there. A filled bar reads as a measurement, so it
// was a measurement of nothing. It is replaced by a count of open questions,
// which is defined, and which renders as absence when there is nothing to say.

import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { accent, ink, radius, status, surface, typography } from '../../theme/cssTokens';

export type CockpitRunStatus = 'idle' | 'working' | 'awaiting-approval' | 'succeeded' | 'failed';

export interface CockpitSummary {
  /** Short, human-facing session label, e.g. "Session a1b2c3". */
  sessionLabel: string;
  /** The current run's coarse status. */
  runStatus: CockpitRunStatus;
  /**
   * How many governed actions are waiting on the person. A real count, from
   * countApprovalsWaiting -- never a status flag rendered as a number.
   */
  approvalsWaiting: number;
  /** Whether a Headroom capsule is currently in play. */
  headroomActive: boolean;
  /**
   * Unresolved questions on the active capsule. A defined quantity with a
   * natural zero, not a proportion of an invented ceiling.
   */
  headroomOpenQuestions: number;
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

/**
 * What the cockpit says about Headroom, or null to render nothing.
 *
 * Absence is a legitimate state and is shown as absence: with no capsule in
 * play there is no Headroom fact to report, so the slot stays empty rather than
 * displaying a zeroed instrument.
 */
export function headroomReadout(summary: Pick<CockpitSummary, 'headroomActive' | 'headroomOpenQuestions'>): string | null {
  if (!summary.headroomActive) return null;
  const open = Number.isFinite(summary.headroomOpenQuestions)
    ? Math.max(0, Math.trunc(summary.headroomOpenQuestions))
    : 0;
  if (open === 0) return 'Headroom · active';
  return `Headroom · ${open} open`;
}

/**
 * The readout, with no bar chrome of its own, so the shell can place it inside
 * the single cockpit tier.
 */
export function CockpitReadout({ summary }: { summary: CockpitSummary }): React.ReactElement {
  const meta = cockpitStatusMeta(summary.runStatus);
  const headroom = headroomReadout(summary);
  const pulsing = summary.runStatus === 'working';

  return (
    <Box
      role="status"
      aria-label="Cockpit status"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      {/* Session. First to go when the bar is tight: an identifier, not a state. */}
      <Typography
        sx={{
          color: ink.muted,
          fontFamily: typography.mono,
          fontSize: '0.6875rem',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          display: { xs: 'none', lg: 'block' },
        }}
      >
        {summary.sessionLabel}
      </Typography>

      <Box sx={{ width: '1px', height: 14, backgroundColor: surface.border, flexShrink: 0, display: { xs: 'none', lg: 'block' } }} />

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
        <Typography
          sx={{ color: ink.secondary, fontSize: '0.75rem', whiteSpace: 'nowrap', display: { xs: 'none', md: 'block' } }}
        >
          {meta.label}
        </Typography>
      </Box>

      {/*
        Approvals waiting.

        The only element in the shell permitted to be loud, and the only one
        that never collapses at narrow widths. Everything else here is ambient;
        this is a person being asked for a decision, and it is the warmest thing
        on a deliberately cool ground. Shown only when something is genuinely
        waiting -- a zero renders as absence, not as a quiet zero.
      */}
      {summary.approvalsWaiting > 0 && (
        <>
          <Box sx={{ width: '1px', height: 14, backgroundColor: surface.border, flexShrink: 0 }} />
          <Typography
            sx={{
              color: status.brass,
              fontSize: '0.75rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              border: `1px solid ${status.brass}`,
              backgroundColor: status.brassMuted,
              borderRadius: `${radius.sm / 2}px`,
              px: 0.6,
              py: 0.05,
            }}
          >
            {summary.approvalsWaiting} {summary.approvalsWaiting === 1 ? 'approval waiting' : 'approvals waiting'}
          </Typography>
        </>
      )}

      {/* Headroom: a count when there is one, nothing when there is not. */}
      {headroom && (
        <Tooltip title={summary.headroomOpenQuestions > 0
          ? 'Unresolved questions on the active Headroom capsule'
          : 'Headroom context in play'}>
          <Typography
            sx={{
              color: ink.muted,
              fontSize: '0.6875rem',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              display: { xs: 'none', lg: 'block' },
            }}
          >
            {headroom}
          </Typography>
        </Tooltip>
      )}

    </Box>
  );
}
