// src/components/workbench/LiveWorkbenchToolbar.tsx
// Controls for a connected live application.
//
// Migrated to theme tokens in the Phase 3 pass. Two substantive changes:
//
//   1. A reachable application reads neutral, not green. The contract reserves
//      green for meaningful success, and an application that is simply up is
//      the absence of a problem. This matches the gateway dot in the shell.
//   2. Raw status strings are no longer shown. `framing-likely-blocked` is an
//      internal identifier, and the contract forbids surfacing internal codes.

import React from 'react';
import { Box, Typography, IconButton, Chip, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import { LocalAppDefinitionClient } from './LiveWorkbenchSurface';
import { accent, ink, radius, status as statusToken, surface, typography } from '../../theme/cssTokens';

interface LiveWorkbenchToolbarProps {
  app: LocalAppDefinitionClient | null;
  status: string; // 'checking', 'reachable', 'framing-likely-blocked', 'invalid-configuration'
  onReload: () => void;
  onClose: () => void;
}

/** Plain language for a machine-readable status. */
function describeStatus(state: string): string {
  switch (state) {
    case 'reachable':
      return 'Connected';
    case 'checking':
      return 'Checking';
    case 'framing-likely-blocked':
      return 'Refuses embedding';
    case 'invalid-configuration':
      return 'Not configured';
    default:
      return 'Unavailable';
  }
}

/**
 * Neutral when connected. Brass when something needs attention. Danger when it
 * is simply not there. Never green: a working connection is not an achievement.
 *
 * The brass fallthrough previously caught everything non-reachable, so an
 * application that was down read as "needs attention" rather than "failed".
 * Refusing to embed and being misconfigured are conditions to resolve; not
 * responding is a failure.
 */
export function statusColour(state: string): string {
  if (state === 'reachable') return statusToken.neutral;
  if (state === 'checking') return ink.muted;
  if (state === 'framing-likely-blocked' || state === 'invalid-configuration') {
    return statusToken.brass;
  }
  return statusToken.danger;
}

export const LiveWorkbenchToolbar: React.FC<LiveWorkbenchToolbarProps> = ({
  app,
  status,
  onReload,
  onClose,
}) => {
  if (!app) return null;

  const colour = statusColour(status);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 1.5,
        backgroundColor: surface.raised,
        borderBottom: `1px solid ${surface.border}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: ink.primary }} noWrap>
          {app.name}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: ink.secondary, fontFamily: typography.mono }}
          noWrap
        >
          {app.url}
        </Typography>
        <Chip
          label={describeStatus(status)}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.65rem',
            color: colour,
            backgroundColor: 'transparent',
            border: `1px solid ${colour}`,
            borderRadius: `${radius.sm}px`,
            flexShrink: 0,
          }}
        />
        <Tooltip title="PaneTera observes this application; it does not act inside it.">
          <Chip
            label="Guide mode"
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              backgroundColor: accent.violetMuted,
              color: ink.primary,
              border: `1px solid ${accent.violetBorder}`,
              borderRadius: `${radius.sm}px`,
              flexShrink: 0,
            }}
          />
        </Tooltip>
      </Box>

      <Box sx={{ flexShrink: 0 }}>
        <Tooltip title="Reload">
          <IconButton size="small" onClick={onReload} aria-label="Reload application">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Open in browser">
          <IconButton
            size="small"
            onClick={() => window.open(app.url, '_blank', 'noopener,noreferrer')}
            aria-label="Open application in browser"
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Close">
          <IconButton size="small" onClick={onClose} aria-label="Close application" sx={{ ml: 1 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};
