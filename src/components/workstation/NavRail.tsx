// src/components/workstation/NavRail.tsx
//
// The slim icon rail down the left edge, holding the top-level drawers.
//
// It exists to let the cockpit be one tier. The shell used to spend 87px of
// chrome before any work was visible -- a 56px top bar over a 30px status
// strip -- largely because the top bar was carrying identity, project context,
// four drawer toggles, the quick switcher and the theme control at once. The
// bar can only lose a tier if something else absorbs the drawers, and that is
// what this is.
//
// A rail is also better at the job than a row of top-bar buttons. Each drawer
// gets a fixed position that does not move as labels change width, so it is
// remembered spatially rather than re-read every time. And it is a stable
// place: the rail is rendered at every width, including the stacked narrow
// layout, so a drawer is never unreachable because the window got small.
//
// Presentational only. It owns no drawer state; it reports which drawer is
// open and calls back when one is chosen.

import React from 'react';
import { Box, Tooltip, IconButton } from '@mui/material';
import LayersIcon from '@mui/icons-material/Layers';
import HubIcon from '@mui/icons-material/Hub';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import { accent, density, elevation, ink, radius, surface } from '../../theme/cssTokens';
import { transition } from '../../theme/motion';

/** Which top-level drawer is currently open, if any. */
export type RailTarget = 'headroom' | 'rig' | 'activity';

export interface NavRailProps {
  openDrawer: RailTarget | null;
  onToggle: (target: RailTarget) => void;
  /** The audit log is a modal, not a drawer, so it never reports as open. */
  onOpenAudit: () => void;
}

interface RailItem {
  id: RailTarget | 'audit';
  /**
   * Stated verbatim rather than derived from the label.
   *
   * These are the exact strings the top bar used before the drawers moved
   * here. An aria-label is what a screen reader announces and what automation
   * targets, so it is part of the interface contract -- generating it from a
   * display label would have silently reworded four controls as a side effect
   * of a layout change.
   */
  ariaLabel: string;
  hint: string;
  icon: React.ReactNode;
  controls?: string;
}

const ITEMS: RailItem[] = [
  {
    id: 'headroom',
    ariaLabel: 'Toggle Headroom drawer',
    hint: 'Headroom context and memory',
    icon: <LayersIcon sx={{ fontSize: 18 }} />,
    controls: 'headroom-drawer',
  },
  {
    id: 'rig',
    ariaLabel: 'Toggle Rig drawer',
    hint: 'Rig connections and capabilities',
    icon: <HubIcon sx={{ fontSize: 18 }} />,
    controls: 'rig-drawer',
  },
  {
    id: 'activity',
    ariaLabel: 'Toggle activity drawer',
    hint: 'Activity',
    icon: <ViewSidebarIcon sx={{ fontSize: 18 }} />,
    controls: 'activity-drawer',
  },
  {
    id: 'audit',
    ariaLabel: 'Open audit log',
    hint: 'Audit log',
    icon: <VerifiedUserIcon sx={{ fontSize: 18 }} />,
  },
];

export function NavRail({ openDrawer, onToggle, onOpenAudit }: NavRailProps): React.ReactElement {
  return (
    <Box
      component="nav"
      aria-label="Workstation drawers"
      sx={{
        width: density.rail,
        minWidth: density.rail,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        pt: 1,
        backgroundColor: surface.canvas,
        borderRight: `1px solid ${surface.border}`,
      }}
    >
      {ITEMS.map((item) => {
        const isDrawer = item.id !== 'audit';
        const open = isDrawer && openDrawer === item.id;

        return (
          <Tooltip key={item.id} title={item.hint} placement="right">
            <IconButton
              aria-label={item.ariaLabel}
              {...(isDrawer ? { 'aria-expanded': open, 'aria-controls': item.controls } : {})}
              onClick={() => (isDrawer ? onToggle(item.id as RailTarget) : onOpenAudit())}
              sx={{
                position: 'relative',
                width: 32,
                height: 32,
                borderRadius: `${radius.sm}px`,
                border: '1px solid transparent',
                color: open ? accent.violet : ink.muted,
                backgroundColor: open ? accent.violetSelected : 'transparent',
                borderColor: open ? accent.violetBorder : 'transparent',
                transition: transition(['background-color', 'color', 'border-color']),
                '&:hover': {
                  color: ink.primary,
                  backgroundColor: open ? accent.violetHover : surface.raisedHover,
                },
                '&:focus-visible': {
                  outline: 'none',
                  boxShadow: elevation.focusRing,
                  borderColor: accent.violetBorder,
                },
                // A hairline icon is hard to hit with a finger. The rail keeps
                // its width; the target grows into it.
                '@media (pointer: coarse)': { width: density.touch - 4, height: density.touch - 4 },
                // The open drawer is marked on the edge the drawer opens from,
                // so the mark points at the thing it describes.
                ...(open
                  ? {
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        left: -9,
                        top: '22%',
                        bottom: '22%',
                        width: 2,
                        borderRadius: 1,
                        backgroundColor: accent.violet,
                      },
                    }
                  : {}),
              }}
            >
              {item.icon}
            </IconButton>
          </Tooltip>
        );
      })}
    </Box>
  );
}
