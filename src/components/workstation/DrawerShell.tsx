// src/components/workstation/DrawerShell.tsx
//
// The shared shell for the right-anchored governance drawers. Rig and Headroom
// had independently-written but near-identical shells — a labelled section, an
// h6 title with a caption, and a right-aligned Close (and, for Rig, a Refresh) —
// so this primitive gives them one grammar: consistent header hierarchy, action
// placement, padding, and a header that stays put while only the body scrolls.
//
// It is deliberately scoped to the two drawers whose behaviour is genuinely
// identical. The Activity feed and the Audit dialog use different containers, so
// they are aligned separately rather than forced through this shell.

import React from 'react';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { accent, elevation, ink, radius, surface } from '../../theme/cssTokens';
import { transition } from '../../theme/motion';

export interface DrawerShellProps {
  /** The id the drawer's `aria-labelledby` points at, so the region is named. */
  titleId: string;
  title: string;
  description?: string;
  onClose: () => void;
  /** An explicit accessible name for Close, e.g. "Close Rig". */
  closeLabel: string;
  /** When provided, a Refresh action is shown before Close. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** An explicit accessible name for Refresh, e.g. "Refresh Rig connections". */
  refreshLabel?: string;
  children: React.ReactNode;
}

const actionButtonStyles = {
  color: ink.secondary,
  px: 1.5,
  py: 0.5,
  minHeight: 32,
  borderRadius: `${radius.sm}px`,
  border: `1px solid ${surface.border}`,
  backgroundColor: surface.sunken,
  transition: transition(['background-color', 'color', 'border-color']),
  '&:hover': {
    color: ink.primary,
    backgroundColor: surface.overlay,
    borderColor: surface.borderStrong,
  },
  '&:focus-visible': {
    outline: 'none',
    boxShadow: elevation.focusRing,
    borderColor: accent.violetBorder,
  },
  '&.Mui-disabled': {
    color: ink.disabled,
    borderColor: surface.border,
    backgroundColor: surface.sunken,
  },
} as const;

export function DrawerShell({
  titleId,
  title,
  description,
  onClose,
  closeLabel,
  onRefresh,
  refreshing = false,
  refreshLabel,
  children,
}: DrawerShellProps): React.ReactElement {
  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <Box
        component="header"
        aria-busy={refreshing}
        sx={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          px: 2,
          py: 1.75,
          borderBottom: `1px solid ${surface.border}`,
          backgroundColor: surface.raised,
          // Opaque fill, so the blur was blurring nothing. Shell chrome is opaque.
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography id={titleId} variant="h6" sx={{ color: ink.primary, fontWeight: 650 }}>
            {title}
          </Typography>
          {description && (
            <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mt: 0.25 }}>
              {description}
            </Typography>
          )}
        </Box>
        <Stack direction="row" gap={1} sx={{ flexShrink: 0 }}>
          {onRefresh && (
            <Button
              size="small"
              aria-label={refreshLabel ?? `Refresh ${title}`}
              disabled={refreshing}
              onClick={onRefresh}
              startIcon={
                refreshing ? (
                  <CircularProgress size={12} color="inherit" sx={{ color: ink.secondary }} />
                ) : undefined
              }
              sx={actionButtonStyles}
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          )}
          <Button size="small" onClick={onClose} aria-label={closeLabel} sx={actionButtonStyles}>
            Close
          </Button>
        </Stack>
      </Box>
      {/* Only the body scrolls, so the header and its actions stay reachable. */}
      <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', p: 2 }}>
        {children}
      </Box>
    </Box>
  );
}
