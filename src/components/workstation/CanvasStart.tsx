// src/components/workstation/CanvasStart.tsx
//
// The initial state of the authoritative canvas, before any project, capability,
// or content exists. Extracted from App so the start state has one clear primary
// path and can be tested for that structure directly.
//
// The design is a quiet cockpit, not a landing page. There is no hero, no
// invented metric, and no claim that a project or capability already exists. The
// heading states the choice; a single tonal start panel gives the two real
// actions structure; and the primary path — choosing a project — is the only one
// carrying the violet interaction accent, so the eye lands on it first while the
// secondary and composer paths stay legible but quieter.

import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { accent, elevation, ink, radius, surface } from '../../theme/tokens';
import { transition } from '../../theme/motion';

export interface CanvasStartProps {
  onChooseProject: () => void;
  onConnectCapability: () => void;
}

const focusRing = {
  '&:focus-visible': { outline: 'none', boxShadow: elevation.focusRing, borderColor: accent.violetBorder },
} as const;

/** One action tile. The primary path is violet; the secondary stays neutral. */
function StartAction({
  variant,
  title,
  detail,
  onClick,
}: {
  variant: 'primary' | 'secondary';
  title: string;
  detail: string;
  onClick: () => void;
}) {
  const primary = variant === 'primary';
  return (
    <Button
      onClick={onClick}
      data-variant={variant}
      sx={{
        textAlign: 'left',
        alignItems: 'flex-start',
        flexDirection: 'column',
        gap: 0.5,
        p: 1.5,
        textTransform: 'none',
        borderRadius: `${radius.md}px`,
        border: `1px solid ${primary ? accent.violetBorder : surface.border}`,
        backgroundColor: primary ? accent.violetMuted : surface.sunken,
        transition: transition(['background-color', 'border-color']),
        '&:hover': {
          backgroundColor: primary ? accent.violetHover : surface.overlay,
          borderColor: primary ? accent.violetBorder : surface.borderStrong,
        },
        ...focusRing,
      }}
    >
      <Typography variant="subtitle2" sx={{ color: ink.primary, fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="caption" sx={{ color: ink.secondary, lineHeight: 1.5 }}>
        {detail}
      </Typography>
    </Button>
  );
}

export function CanvasStart({ onChooseProject, onConnectCapability }: CanvasStartProps): React.ReactElement {
  return (
    <Box
      sx={{
        flexGrow: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 3, md: 6 },
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography
            variant="overline"
            sx={{ color: ink.muted, fontWeight: 600, fontSize: '0.6875rem', letterSpacing: '0.08em' }}
          >
            Ready when you are
          </Typography>
          <Typography
            component="h1"
            sx={{
              color: ink.primary,
              // A workspace heading, not a marketing hero: sized to lead the
              // column without dominating it.
              fontSize: { xs: '1.25rem', md: '1.375rem' },
              lineHeight: 1.3,
              letterSpacing: '-0.01em',
              fontWeight: 600,
            }}
          >
            Choose a project or describe your goal
          </Typography>
          <Typography variant="body2" sx={{ color: ink.secondary, lineHeight: 1.7 }}>
            Whatever you start takes shape here: a live application, a document, a result, or
            evidence you can inspect.
          </Typography>
        </Box>

        {/* A single tonal start panel gives the two real actions structure without
            implying anything already exists. */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
            p: 1.75,
            border: `1px solid ${surface.border}`,
            borderRadius: `${radius.md}px`,
            backgroundColor: surface.raised,
          }}
        >
          <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 600 }}>
            Start here
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1.25 }}>
            <StartAction
              variant="primary"
              title="Choose a project"
              detail="Open one of your registered projects."
              onClick={onChooseProject}
            />
            <StartAction
              variant="secondary"
              title="Connect a capability"
              detail="Add a tool or MCP server in Rig."
              onClick={onConnectCapability}
            />
          </Box>
          <Typography variant="caption" sx={{ color: ink.muted, lineHeight: 1.5 }}>
            Or describe your goal in the composer on the left.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
