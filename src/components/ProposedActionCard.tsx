// src/components/ProposedActionCard.tsx
//
// The one shared implementation of the approval gate.
//
// Migrated to theme tokens in the Phase 3 pass. Beyond colour, five changes,
// all from the locked contract:
//
//   1. `className="pulse-glow"` removed. That animation was deleted from
//      index.css in Phase 0 as decorative looping motion, so the class was
//      already dead; a pending approval should not pulse at you regardless.
//   2. Green no longer marks a pending or starting action. Green is reserved
//      for meaningful success, and "about to run" is not success. Pending is
//      brass (attention), the approve control is the violet interaction accent.
//   3. A `safe` risk classification reads neutral rather than green. It is a
//      classification, not an achievement.
//   4. Execution modes are described in plain language. `apple-container` and
//      `local-shell` are internal identifiers.
//   5. Shouting labels are sentence case. `PROPOSAL BLOCKED` was doing with
//      capitals what a colour and a word already do.
//
// Behaviour change, decided in review: Approve and run fires once, immediately.
// The timer-based pseudo-undo is gone.

import React, { useRef, useState } from 'react';
import { Box, Typography, Button, Chip } from '@mui/material';
import { accent, ink, radius, status, surface, typography } from '../theme/cssTokens';
import { transition } from '../theme/motion';
import { singleFire } from './singleFire';

interface ProposedActionCardProps {
  workspaceName: string;
  command: string;
  reason?: string;
  onApprove: () => void;
  onCancel: () => void;
  /** 'chat' gets a little outer margin to sit inside a message bubble; 'panel' fills its feed card as-is. */
  variant?: 'panel' | 'chat';

  // Enhanced metadata fields from server allowlist
  riskLevel?: 'safe' | 'review' | 'dangerous';
  executionMode?: 'local-shell' | 'apple-container' | 'dax' | 'dry-run';
  isDryRun?: boolean;
  allowed?: boolean;
  description?: string;
}

/** Plain language for an internal execution mode identifier. */
function describeMode(mode: string): string {
  switch (mode) {
    case 'local-shell':
      return 'On this machine';
    case 'apple-container':
      return 'In an isolated container';
    case 'dax':
      return 'Through DAX';
    case 'dry-run':
      return 'Simulated only';
    default:
      return 'Unknown environment';
  }
}

/**
 * Risk classification colours.
 *
 * `safe` is neutral, not green: it describes what the command is, not that
 * something succeeded. Reserving green keeps it meaningful when a verification
 * actually completes.
 */
export function riskColours(level: 'safe' | 'review' | 'dangerous') {
  switch (level) {
    case 'safe':
      return { colour: status.neutral, muted: 'transparent' };
    case 'review':
      return { colour: status.brass, muted: status.brassMuted };
    case 'dangerous':
    default:
      return { colour: status.danger, muted: status.dangerMuted };
  }
}

function describeRisk(level: 'safe' | 'review' | 'dangerous'): string {
  if (level === 'safe') return 'Low risk';
  if (level === 'review') return 'Needs review';
  return 'High risk';
}

export const ProposedActionCard: React.FC<ProposedActionCardProps> = ({
  workspaceName,
  command,
  reason,
  onApprove,
  onCancel,
  variant = 'panel',
  riskLevel = 'safe',
  executionMode = 'local-shell',
  isDryRun = true,
  allowed = true,
  description
}) => {
  // Approving fires once, immediately. The previous version started a
  // two-second countdown with an Undo, which meant the consequential moment was
  // a timer rather than the click. A pseudo-undo on an action that may already
  // have side effects is a weaker guarantee than it appears to offer, and it
  // put a second decision point where the contract wants one.
  //
  // Guarded against double-firing with a ref, not just state.
  //
  // `setSubmitting(true)` does not take effect until React commits, so two
  // clicks dispatched before that commit would both read `submitting === false`
  // and both fire. The ref updates synchronously, which closes that window; the
  // state exists only to drive the disabled styling. Backend idempotency
  // remains the real boundary.
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const handleApprove = () =>
    singleFire(submittingRef, () => {
      setSubmitting(true);
      onApprove();
    });

  const outerSx = variant === 'chat' ? { mt: 2, mb: 1 } : {};

  const commandSx = {
    fontFamily: typography.mono,
    fontWeight: 600,
    color: ink.primary,
  } as const;

  // 2. BLOCKED COMMAND STATE
  if (allowed === false) {
    return (
      <Box
        role="alert"
        sx={{
          ...outerSx,
          backgroundColor: status.dangerMuted,
          border: `1px solid ${status.danger}`,
          borderRadius: `${radius.md}px`,
          p: 2,
        }}
      >
        <Typography
          variant="caption"
          sx={{ color: status.danger, fontWeight: 600, display: 'block', mb: 1 }}
        >
          Blocked
        </Typography>
        <Typography variant="body2" sx={{ color: ink.primary, mb: 1, lineHeight: 1.55 }}>
          <Box component="span" sx={commandSx}>
            {command}
          </Box>{' '}
          is not in the approved command list, so PaneTera will not run it.
        </Typography>
        <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mb: 2 }}>
          {/*
            The server's own explanation wins. Replacing it with fixed copy
            about the allowlist discarded the specific reason a command was
            refused, which is the part worth reading.
          */}
          {reason ?? 'Commands must be added to the allowlist before they can be proposed.'}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          onClick={onCancel}
          sx={{ color: ink.secondary, borderColor: surface.borderStrong }}
        >
          Dismiss
        </Button>
      </Box>
    );
  }

  const risk = riskColours(riskLevel);

  // 3. STANDARD WAITING FOR APPROVAL STATE
  return (
    <Box
      sx={{
        ...outerSx,
        backgroundColor: status.brassMuted,
        border: `1px solid ${status.brass}`,
        borderRadius: `${radius.md}px`,
        p: 2,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
          mb: 1.5,
        }}
      >
        <Typography variant="caption" sx={{ color: status.brass, fontWeight: 600 }}>
          Needs your approval
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {isDryRun && (
            <Chip
              label="Dry run"
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                backgroundColor: accent.violetMuted,
                color: ink.primary,
                border: `1px solid ${accent.violetBorder}`,
                borderRadius: `${radius.sm}px`,
              }}
            />
          )}
          <Chip
            label={describeMode(executionMode)}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              backgroundColor: 'transparent',
              color: ink.secondary,
              border: `1px solid ${surface.border}`,
              borderRadius: `${radius.sm}px`,
            }}
          />
          <Chip
            label={describeRisk(riskLevel)}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              backgroundColor: risk.muted,
              color: risk.colour,
              border: `1px solid ${risk.colour}`,
              borderRadius: `${radius.sm}px`,
            }}
          />
        </Box>
      </Box>

      <Typography variant="body2" sx={{ color: ink.primary, mb: 0.5, lineHeight: 1.55 }}>
        Run{' '}
        <Box component="span" sx={commandSx}>
          {command}
        </Box>{' '}
        in <Box component="span" sx={{ fontWeight: 600 }}>{workspaceName}</Box>
      </Typography>

      {description && (
        <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mb: 0.5 }}>
          {description}
        </Typography>
      )}

      {reason && (
        <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mb: 1.5 }}>
          {reason}
        </Typography>
      )}

      {isDryRun && (
        <Typography
          variant="caption"
          sx={{ color: ink.secondary, display: 'block', mt: 1, mb: 1.5 }}
        >
          This simulates the command and shows what it would do. Nothing is changed.
        </Typography>
      )}

      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
        {/*
          The approve control carries the interaction accent, not green.
          Approving is an action being taken, not an outcome achieved.
        */}
        <Button
          size="small"
          variant="contained"
          onClick={handleApprove}
          disabled={submitting}
        >
          {isDryRun ? 'Preview dry run' : 'Approve and run'}
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={onCancel}
          disabled={submitting}
          sx={{
            color: status.danger,
            borderColor: status.danger,
            transition: transition(['background-color']),
            '&:hover': { backgroundColor: status.dangerMuted, borderColor: status.danger },
          }}
        >
          Reject
        </Button>
      </Box>
    </Box>
  );
};
