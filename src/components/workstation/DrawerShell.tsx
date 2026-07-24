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
import { Box, Button, Stack, Typography } from '@mui/material';
import { ink, surface } from '../../theme/cssTokens';

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
        sx={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          px: 2,
          py: 1.75,
          borderBottom: `1px solid ${surface.border}`,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography id={titleId} variant="h6">{title}</Typography>
          {description && (
            <Typography variant="caption" sx={{ color: ink.secondary, display: 'block' }}>{description}</Typography>
          )}
        </Box>
        <Stack direction="row" gap={0.5} sx={{ flexShrink: 0 }}>
          {onRefresh && (
            <Button
              aria-label={refreshLabel ?? `Refresh ${title}`}
              disabled={refreshing}
              onClick={onRefresh}
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          )}
          <Button onClick={onClose} aria-label={closeLabel}>Close</Button>
        </Stack>
      </Box>
      {/* Only the body scrolls, so the header and its actions stay reachable. */}
      <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', p: 2 }}>
        {children}
      </Box>
    </Box>
  );
}
