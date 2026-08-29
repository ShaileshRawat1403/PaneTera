// src/components/surfaces/SurfaceHeader.tsx
//
// The 3-zone header every active surface wears.
//
//   ┌──────────────────────────────────────────────────────────────┐
//   │ Identity & Context │ Surface Tools │ View Controls           │
//   └──────────────────────────────────────────────────────────────┘
//
// One spatial contract for a browser page, a local application, an MCP-backed
// view and a verified artifact alike, so a person learns the header once
// instead of once per surface kind.
//
// PRESENTATIONAL ONLY, AND DELIBERATELY SO
//
// It is a pure function of its props. It holds no state, resolves nothing,
// fetches nothing, and executes nothing. Every action it renders leaves as
// metadata through `onAction`; the host decides what a `propose` action means
// and routes it through the authoritative proposal → approval → invocation
// path. The frozen contract is explicit that surface header actions must never
// become a second execution authority, and the way to guarantee that is for
// this file to have no way to execute anything at all.
//
// It reads a SurfaceDescriptor, which is itself only a projection. So this is
// a view of a view: it cannot disagree with Browser Operator, Rig, the
// workspace, or the evidence store, because it never holds their state.
//
// PRESENCE IS A WORD, NOT A DOT
//
// Presence has four values and a dot has one channel, so a dot has to overload
// colour to carry them -- which is exactly how "connected" became green across
// the workbench. A word carries the state unambiguously and leaves colour free
// to mean one thing.
//
// So presence renders as a small monospace label in neutral ink, always. The
// only colour in this component is the verified mark, because integrity is a
// separate axis from presence: a surface can be live and unverified, or a
// disconnected snapshot that was verified. Flattening the two into one dot
// loses precisely the distinction the descriptor exists to state.

import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { accent, density, elevation, ink, radius, status, surface, typography } from '../../theme/cssTokens';
import { transition } from '../../theme/motion';
import type {
  SurfaceAction,
  SurfaceActionBehavior,
  SurfaceDescriptor,
  SurfacePresence,
} from '../../surfaces/types';

export interface SurfaceHeaderProps {
  descriptor: SurfaceDescriptor;
  /**
   * Called with the action's metadata when one is chosen. The header does not
   * know what any action does; it reports that one was asked for.
   */
  onAction?: (action: SurfaceAction) => void;
  /** Offered only when the descriptor says the surface can split. */
  onSplit?: () => void;
  /** Offered only when the descriptor says the surface can close. */
  onClose?: () => void;
}

/**
 * Plain language for a presence value.
 *
 * Deliberately not the raw token: `unavailable` is an internal word, and the
 * existing workbench toolbar already established that internal identifiers do
 * not reach the screen.
 */
export function describePresence(presence: SurfacePresence): string {
  switch (presence) {
    case 'live':
      return 'Live';
    case 'snapshot':
      return 'Snapshot';
    case 'disconnected':
      return 'Disconnected';
    case 'unavailable':
    default:
      return 'Unavailable';
  }
}

/**
 * The ink a presence label is set in. Never a status colour.
 *
 * `live` sits one step brighter than the rest because it is the state a person
 * is most often acting on, but the difference is emphasis within one neutral
 * ramp, not a signal. A live surface is healthy-and-unremarkable, and the
 * contract is explicit that healthy-and-unremarkable is neutral.
 */
export function presenceInk(presence: SurfacePresence): string {
  return presence === 'live' ? ink.secondary : ink.muted;
}

/**
 * How an action is presented, from how it is governed.
 *
 * A `propose` action is the only one that can cost the person a decision, so
 * it is the only one that looks different: brass, the shell's attention
 * colour, stated before the click rather than discovered after it. `local-ui`
 * and `observe` both stay quiet, because copying a value and reading a page
 * are equally free.
 */
export function actionIsGoverned(behavior: SurfaceActionBehavior): boolean {
  return behavior === 'propose';
}

const zoneGap = 1;

export function SurfaceHeader({
  descriptor,
  onAction,
  onSplit,
  onClose,
}: SurfaceHeaderProps): React.ReactElement {
  const { identity, state, actions, view } = descriptor;
  const verified = state.integrity === 'verified';

  return (
    <Box
      component="header"
      aria-label={`${identity.title} surface header`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: zoneGap,
        minHeight: density.surfaceBar,
        height: density.surfaceBar,
        px: 1,
        backgroundColor: surface.raised,
        borderBottom: `1px solid ${surface.border}`,
        overflow: 'hidden',
      }}
    >
      {/* ── Zone 1: Identity & Context ───────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, minWidth: 0, flexShrink: 1 }}>
        <Typography
          component="span"
          data-testid="surface-presence"
          sx={{
            fontFamily: typography.mono,
            fontSize: '0.5625rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: presenceInk(state.presence),
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {describePresence(state.presence)}
        </Typography>

        <Typography
          component="span"
          sx={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: ink.primary,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {identity.title}
        </Typography>

        {identity.subtitle && (
          <Typography
            component="span"
            title={identity.subtitle}
            sx={{
              fontFamily: typography.mono,
              fontSize: '0.625rem',
              color: ink.muted,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}
          >
            {identity.subtitle}
          </Typography>
        )}

        {/*
          The only colour in this header. Integrity is a separate axis from
          presence, so it gets its own mark rather than tinting the presence
          label: a surface can be live and unverified, or a disconnected
          snapshot that was verified, and both must remain sayable.
        */}
        {verified && (
          <Tooltip title="Provenance verified">
            <Typography
              component="span"
              data-testid="surface-verified"
              sx={{
                fontFamily: typography.mono,
                fontSize: '0.5625rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: status.success,
                border: `1px solid ${status.success}`,
                backgroundColor: status.successMuted,
                borderRadius: `${radius.sm / 2}px`,
                px: 0.4,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              ✓ Verified
            </Typography>
          </Tooltip>
        )}
      </Box>

      {/* ── Zone 2: Surface Tools ────────────────────────────────────
          Elastic. A surface owes this zone nothing, and an empty one is a
          legitimate, quiet result rather than a gap to fill. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, overflow: 'hidden' }}>
        {actions.map((action) => {
          const governed = actionIsGoverned(action.behavior);
          return (
            <Tooltip
              key={action.id}
              title={governed ? `${action.label} — needs your approval` : action.label}
            >
              <Box
                component="button"
                type="button"
                data-testid={`surface-action-${action.id}`}
                data-behavior={action.behavior}
                onClick={() => onAction?.(action)}
                sx={{
                  font: 'inherit',
                  fontSize: '0.6875rem',
                  fontWeight: governed ? 600 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  px: 0.75,
                  py: 0.25,
                  borderRadius: `${radius.sm / 2}px`,
                  color: governed ? status.brass : ink.secondary,
                  backgroundColor: governed ? status.brassMuted : 'transparent',
                  border: `1px solid ${governed ? status.brass : surface.border}`,
                  transition: transition(['background-color', 'color', 'border-color']),
                  '&:hover': {
                    color: governed ? status.brass : ink.primary,
                    backgroundColor: governed ? status.brassMuted : surface.raisedHover,
                    borderColor: governed ? status.brass : surface.borderStrong,
                  },
                  '&:focus-visible': {
                    outline: 'none',
                    boxShadow: elevation.focusRing,
                    borderColor: accent.violetBorder,
                  },
                }}
              >
                {action.label}
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      {/* ── Zone 3: View Controls ────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto', flexShrink: 0 }}>
        {view?.mode && (
          <Typography
            component="span"
            data-testid="surface-view-mode"
            sx={{
              fontFamily: typography.mono,
              fontSize: '0.625rem',
              color: ink.muted,
              whiteSpace: 'nowrap',
            }}
          >
            {view.mode}
          </Typography>
        )}

        {view?.canSplit && onSplit && (
          <Tooltip title="Open beside">
            <Box
              component="button"
              type="button"
              aria-label="Open beside"
              onClick={onSplit}
              sx={iconButtonSx}
            >
              <OpenInFullIcon sx={{ fontSize: 13 }} />
            </Box>
          </Tooltip>
        )}

        {view?.canClose && onClose && (
          <Tooltip title="Close surface">
            <Box
              component="button"
              type="button"
              aria-label="Close surface"
              onClick={onClose}
              sx={iconButtonSx}
            >
              <CloseIcon sx={{ fontSize: 13 }} />
            </Box>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}

const iconButtonSx = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  padding: 0,
  cursor: 'pointer',
  color: ink.muted,
  backgroundColor: 'transparent',
  border: '1px solid transparent',
  borderRadius: `${radius.sm / 2}px`,
  transition: transition(['background-color', 'color']),
  '&:hover': { color: ink.primary, backgroundColor: surface.raisedHover },
  '&:focus-visible': {
    outline: 'none',
    boxShadow: elevation.focusRing,
    borderColor: accent.violetBorder,
  },
} as const;
