// Mode-aware tokens for component styles.
//
// Raw dark and light palettes live in tokens.ts so theme construction and
// contrast tests can inspect concrete values. Components use these CSS
// variables so one root theme switch updates every surface, including sx
// styles that predate the toggle.

export const surface = {
  base: 'var(--panetera-surface-base)',
  canvas: 'var(--panetera-surface-canvas)',
  raised: 'var(--panetera-surface-raised)',
  raisedHover: 'var(--panetera-surface-raised-hover)',
  overlay: 'var(--panetera-surface-overlay)',
  sunken: 'var(--panetera-surface-sunken)',
  border: 'var(--panetera-surface-border)',
  borderStrong: 'var(--panetera-surface-border-strong)',
  backdrop: 'var(--panetera-surface-backdrop)',
} as const;

export const ink = {
  primary: 'var(--panetera-ink-primary)',
  secondary: 'var(--panetera-ink-secondary)',
  muted: 'var(--panetera-ink-muted)',
  disabled: 'var(--panetera-ink-disabled)',
  onAccent: 'var(--panetera-ink-on-accent)',
} as const;

export const accent = {
  violet: 'var(--panetera-accent-violet)',
  violetMuted: 'var(--panetera-accent-violet-muted)',
  violetHover: 'var(--panetera-accent-violet-hover)',
  violetSelected: 'var(--panetera-accent-violet-selected)',
  violetBorder: 'var(--panetera-accent-violet-border)',
} as const;

export const status = {
  brass: 'var(--panetera-status-brass)',
  brassMuted: 'var(--panetera-status-brass-muted)',
  success: 'var(--panetera-status-success)',
  successMuted: 'var(--panetera-status-success-muted)',
  danger: 'var(--panetera-status-danger)',
  dangerMuted: 'var(--panetera-status-danger-muted)',
  neutral: 'var(--panetera-status-neutral)',
} as const;

export const elevation = {
  raised: 'var(--panetera-elevation-raised)',
  card: 'var(--panetera-elevation-card)',
  cardHover: 'var(--panetera-elevation-card-hover)',
  overlay: 'var(--panetera-elevation-overlay)',
  focusRing: 'var(--panetera-elevation-focus-ring)',
} as const;

export const glass = {
  raisedRgb: 'var(--panetera-glass-raised-rgb)',
  overlayRgb: 'var(--panetera-glass-overlay-rgb)',
  borderRgb: 'var(--panetera-glass-border-rgb)',
  violetRgb: 'var(--panetera-glass-violet-rgb)',
} as const;

export { radius, SPACING_UNIT, typography, density } from './tokens';
