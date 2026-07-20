// src/theme/paneteraTheme.ts
// MUI theme assembled from the contract's design language.
//
// Mounted once at the app root so every component inherits the tokens without
// each one restating them. Composer surfaces read from the theme rather than
// from literals; older components inherit the palette automatically and can be
// migrated in their own passes.

import { createTheme } from '@mui/material/styles';
import { accent, elevation, ink, radius, SPACING_UNIT, status, surface, typography } from './tokens';
import { duration, easing } from './motion';

export const paneteraTheme = createTheme({
  spacing: SPACING_UNIT,

  palette: {
    mode: 'dark',
    background: {
      default: surface.base,
      paper: surface.raised,
    },
    text: {
      primary: ink.primary,
      secondary: ink.secondary,
      disabled: ink.disabled,
    },
    primary: {
      main: accent.violet,
      contrastText: ink.onAccent,
    },
    // Brass is attention, not a second brand colour.
    warning: {
      main: status.brass,
      contrastText: ink.onAccent,
    },
    success: {
      main: status.success,
      contrastText: ink.onAccent,
    },
    error: {
      main: status.danger,
      contrastText: ink.onAccent,
    },
    divider: surface.border,
  },

  shape: {
    borderRadius: radius.md,
  },

  typography: {
    fontFamily: typography.sans,
    // Humanist proportions: comfortable line height, restrained weights. No
    // weight above 700, which reads as shouting on a working surface.
    body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.55 },
    caption: { fontSize: '0.75rem', lineHeight: 1.45, letterSpacing: '0.01em' },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.005em' },
    overline: { textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 },
  },

  transitions: {
    duration: {
      shortest: duration.instant,
      shorter: duration.quick,
      short: duration.settled,
    },
    easing: {
      easeOut: easing.enter,
      easeIn: easing.exit,
      easeInOut: easing.standard,
      sharp: easing.standard,
    },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Tokens published as CSS variables so plain stylesheets can reach them
        // without restating literals. index.css consumes these.
        ':root': {
          '--panetera-surface-base': surface.base,
          '--panetera-surface-raised': surface.raised,
          '--panetera-surface-overlay': surface.overlay,
          '--panetera-surface-border': surface.border,
          '--panetera-surface-border-strong': surface.borderStrong,
          '--panetera-ink-primary': ink.primary,
          '--panetera-ink-secondary': ink.secondary,
          '--panetera-ink-muted': ink.muted,
          '--panetera-accent-violet': accent.violet,
          '--panetera-font-sans': typography.sans,
          '--panetera-font-mono': typography.mono,
          '--panetera-duration-quick': `${duration.quick}ms`,
          '--panetera-duration-settled': `${duration.settled}ms`,
          '--panetera-easing-enter': easing.enter,
        },
        body: {
          backgroundColor: surface.base,
          color: ink.primary,
          fontFamily: typography.sans,
        },
        code: { fontFamily: typography.mono },
        pre: { fontFamily: typography.mono },
        // One reduced-motion policy, stated once. index.css carries the same
        // rule for elements outside MUI's reach; motion.ts returns 'none' for
        // the same reason. Previously the helpers kept a 90ms fade while this
        // override cut it to 0.01ms, so code and tests disagreed.
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animation: 'none !important',
            transition: 'none !important',
            scrollBehavior: 'auto !important',
          },
        },
      },
    },

    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: surface.raised,
        },
      },
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: radius.sm,
          transition: `background-color ${duration.instant}ms ${easing.standard}, color ${duration.instant}ms ${easing.standard}`,
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: radius.sm,
          color: ink.secondary,
          transition: `background-color ${duration.instant}ms ${easing.standard}, color ${duration.instant}ms ${easing.standard}`,
          '&:hover': { backgroundColor: accent.violetMuted, color: ink.primary },
          // Visible focus is a contract requirement, and the browser default
          // ring disappears against a dark surface.
          '&:focus-visible': {
            outline: 'none',
            boxShadow: elevation.focusRing,
            color: ink.primary,
          },
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: surface.overlay,
          color: ink.primary,
          border: `1px solid ${surface.border}`,
          borderRadius: radius.sm,
          fontSize: '0.75rem',
          lineHeight: 1.5,
          padding: '8px 10px',
          boxShadow: elevation.overlay,
        },
      },
    },

    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: surface.overlay,
          border: `1px solid ${surface.border}`,
          borderRadius: radius.md,
          boxShadow: elevation.overlay,
          marginTop: 4,
        },
        list: { padding: 4 },
      },
    },

    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: radius.sm,
          fontSize: '0.875rem',
          '&:hover': { backgroundColor: accent.violetMuted },
          '&.Mui-selected': { backgroundColor: accent.violetMuted },
          '&.Mui-disabled': { opacity: 1, color: ink.secondary },
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { borderRadius: radius.sm, fontWeight: 500 },
      },
    },

    MuiDivider: {
      styleOverrides: { root: { borderColor: surface.border } },
    },
  },
});

export default paneteraTheme;
