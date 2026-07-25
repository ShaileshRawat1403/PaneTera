// src/components/workstation/CanvasStart.tsx
//
// The initial state of the authoritative canvas, before any project, capability,
// or content exists. Extracted from App so the start state has one clear primary
// path and can be tested for that structure directly.
//
// The design is a quiet operational cockpit, not a landing page. There is no hero,
// no invented metric, and no claim that a project or capability already exists. A
// restrained two-column composition anchors the canvas: the left states the choice
// and the instruction; the right offers the three real starts. A faint pane-seam
// motif behind the content gives PaneTera identity without decoration. Only the
// primary path — choosing a project — carries the violet interaction accent, so
// the eye lands on it first while the other paths stay legible but quieter.

import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { accent, elevation, ink, radius, surface, typography } from '../../theme/cssTokens';
import { enterStyles, transition, duration, easing } from '../../theme/motion';

export interface CanvasStartProps {
  onChooseProject: () => void;
  onConnectCapability: () => void;
  /** Move focus into the composer. Inserts and submits nothing. */
  onDescribeGoal: () => void;
}

const focusRing = {
  '&:focus-visible': { outline: 'none', boxShadow: elevation.focusRing, borderColor: accent.violetBorder },
} as const;

/** One start tile. The primary path is violet and carries the seam accent; the
 *  others stay neutral. All three lift on hover and keyboard focus. */
function StartAction({
  variant,
  dataVariant,
  title,
  detail,
  hint,
  onClick,
}: {
  variant: 'primary' | 'secondary';
  dataVariant: string;
  title: string;
  detail: string;
  hint?: string;
  onClick: () => void;
}) {
  const primary = variant === 'primary';
  return (
    <Button
      onClick={onClick}
      data-variant={dataVariant}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'left',
        alignItems: 'stretch',
        flexDirection: 'column',
        gap: 0.5,
        p: 1.75,
        pl: primary ? 2.25 : 1.75,
        textTransform: 'none',
        borderRadius: `${radius.md}px`,
        border: `1px solid ${primary ? accent.violetBorder : surface.border}`,
        backgroundColor: primary ? accent.violetMuted : surface.raised,
        boxShadow: elevation.card,
        transition: transition(['background-color', 'border-color', 'box-shadow', 'transform']),
        // The seam accent: a hairline down the leading edge marks the primary path.
        ...(primary
          ? { '&::before': { content: '""', position: 'absolute', left: 0, top: 10, bottom: 10, width: '2px', borderRadius: '2px', backgroundColor: accent.violet } }
          : {}),
        '&:hover': {
          backgroundColor: primary ? accent.violetHover : surface.raisedHover,
          borderColor: primary ? accent.violetBorder : surface.borderStrong,
          boxShadow: elevation.cardHover,
          transform: 'translateY(-1px)',
        },
        '&:active': {
          transform: 'scale(0.98)',
          transition: transition(['transform'], duration.instant),
        },
        ...focusRing,
      }}
    >
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" gap={1} sx={{ width: '100%' }}>
        <Typography variant="subtitle2" sx={{ color: ink.primary, fontWeight: 600 }}>
          {title}
        </Typography>
        {hint && (
          <Typography component="span" variant="caption" sx={{ flexShrink: 0, color: ink.muted, fontFamily: typography.mono, fontSize: '0.68rem' }}>
            {hint}
          </Typography>
        )}
      </Stack>
      <Typography variant="caption" sx={{ color: ink.secondary, lineHeight: 1.5 }}>
        {detail}
      </Typography>
    </Button>
  );
}

export function CanvasStart({ onChooseProject, onConnectCapability, onDescribeGoal }: CanvasStartProps): React.ReactElement {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        flexGrow: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // The canvas is its own plane, one warm step up from the base ground.
        backgroundColor: surface.canvas,
        // Sit a little above the vertical midpoint so the canvas does not read as
        // an empty void with a floating panel.
        pt: { xs: 4, md: 6 },
        pb: { xs: 6, md: 14 },
        px: { xs: 3, md: 6 },
      }}
    >
      {/* Pane-seam motif: two faint intersecting rules, several contexts converging
          into one workspace. Decorative and inert. */}
      <Box aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <Box sx={{ position: 'absolute', left: '50%', top: '18%', bottom: '18%', width: '1px', backgroundColor: surface.border, opacity: 0.5, display: { xs: 'none', md: 'block' } }} />
        <Box sx={{ position: 'absolute', top: '50%', left: '12%', right: '12%', height: '1px', backgroundColor: surface.border, opacity: 0.35, display: { xs: 'none', md: 'block' } }} />
      </Box>

      <Box
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: 1040,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '5fr 4fr' },
          columnGap: { md: 5 },
          rowGap: 3,
          alignItems: 'start',
          ...enterStyles(),
        }}
      >
        {/* Left: the choice and the instruction. */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, ...enterStyles(), animationDelay: '0ms' }}>
          <Typography
            variant="overline"
            sx={{ color: ink.muted, fontWeight: 600, fontSize: '0.6875rem', letterSpacing: '0.09em' }}
          >
            Ready when you are
          </Typography>
          <Typography
            component="h1"
            sx={{
              color: ink.primary,
              fontSize: { xs: '1.375rem', md: '1.625rem' },
              lineHeight: 1.25,
              letterSpacing: '-0.015em',
              fontWeight: 600,
              maxWidth: '18ch',
            }}
          >
            Choose a project or describe your goal
          </Typography>
          <Typography variant="body2" sx={{ color: ink.secondary, lineHeight: 1.7, maxWidth: '46ch' }}>
            Whatever you start takes shape here: a live application, a document, a result, or
            evidence you can inspect.
          </Typography>
          <Typography variant="caption" sx={{ mt: 0.5, color: ink.muted, lineHeight: 1.6 }}>
            Describe your goal in the composer, or press{' '}
            <Box component="span" sx={{ px: 0.6, py: 0.1, borderRadius: `${radius.sm}px`, border: `1px solid ${surface.border}`, backgroundColor: surface.sunken, color: ink.secondary, fontFamily: typography.mono, fontSize: '0.72rem' }}>/</Box>
            {' '}for quick actions.
          </Typography>
        </Box>

        {/* Right: the three real starts. */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, ...enterStyles(), animationDelay: '80ms' }}>
          <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 600, letterSpacing: '0.02em' }}>
            Start here
          </Typography>
          <StartAction
            variant="primary"
            dataVariant="primary"
            title="Choose a project"
            detail="Open one of your registered projects."
            onClick={onChooseProject}
          />
          <StartAction
            variant="secondary"
            dataVariant="secondary"
            title="Connect a capability"
            detail="Add a tool or MCP server in Rig."
            onClick={onConnectCapability}
          />
          <StartAction
            variant="secondary"
            dataVariant="describe-goal"
            title="Describe your goal"
            detail="Jump to the composer and start typing."
            hint="/"
            onClick={onDescribeGoal}
          />
        </Box>

        {/* Full width: what the canvas becomes. */}
        <Box sx={{ gridColumn: { md: '1 / -1' }, pt: 0.5, borderTop: `1px solid ${surface.border}` }}>
          <Typography variant="caption" sx={{ color: ink.muted, lineHeight: 1.6 }}>
            Applications, documents, results, and evidence take shape on this canvas as you work.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
