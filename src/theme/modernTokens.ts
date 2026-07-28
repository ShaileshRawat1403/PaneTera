// src/theme/modernTokens.ts
//
// Modern, refined design tokens for PaneTera.
// Enhanced aesthetics with deeper depth, softer shadows, and more polish.

export const modernSurface = {
  /** Deepest ground, behind everything. */
  base: '#0F0E0D',
  /** The authoritative canvas plane. */
  canvas: '#141211',
  /** Default panel: composer, cards, drawers. */
  raised: '#1C1A18',
  /** An interactive panel under the pointer. */
  raisedHover: '#232019',
  /** Panel above a panel: menus, popovers. */
  overlay: '#2A2722',
  /** Pressed or recessed wells. */
  sunken: '#0C0B0A',
  /** Hairlines and dividers. */
  border: '#332E28',
  /** Border on a focused or active container. */
  borderStrong: '#4A433C',
  /** Modal scrim over the workstation. */
  backdrop: 'rgba(15, 14, 13, 0.85)',
  /** Subtle gradient overlays */
  gradientTop: 'linear-gradient(180deg, rgba(28, 26, 24, 0.5) 0%, transparent 100%)',
  gradientBottom: 'linear-gradient(0deg, rgba(15, 14, 13, 0.8) 0%, transparent 100%)',
} as const;

export const modernInk = {
  /** Parchment white. Primary reading text. */
  primary: '#F5F0E8',
  /** Supporting text. */
  secondary: '#BDB4A8',
  /** De-emphasised but readable. */
  muted: '#8E857A',
  /** Disabled controls only. */
  disabled: '#6B6359',
  /** Text on violet or brass fills. */
  onAccent: '#FFFFFF',
} as const;

export const modernAccent = {
  /** Modern violet with slight blue shift for depth. */
  violet: '#A78BFA',
  /** Muted violet for backgrounds. */
  violetMuted: 'rgba(167, 139, 250, 0.12)',
  /** Hover state. */
  violetHover: 'rgba(167, 139, 250, 0.20)',
  /** Selected state. */
  violetSelected: 'rgba(167, 139, 250, 0.16)',
  /** Border color. */
  violetBorder: 'rgba(167, 139, 250, 0.45)',
  /** Glow effect for emphasis. */
  violetGlow: '0 0 20px rgba(167, 139, 250, 0.15)',
  /** Strong glow for focus. */
  violetGlowStrong: '0 0 30px rgba(167, 139, 250, 0.25)',
} as const;

export const modernStatus = {
  /** Brass with warmth. */
  brass: '#E0A050',
  brassMuted: 'rgba(224, 160, 80, 0.12)',
  /** Success with richness. */
  success: '#6BCB77',
  successMuted: 'rgba(107, 203, 119, 0.12)',
  /** Danger with clarity. */
  danger: '#FF6B6B',
  dangerMuted: 'rgba(255, 107, 107, 0.12)',
  /** Info for neutral states. */
  info: '#4ECDC4',
  infoMuted: 'rgba(78, 205, 196, 0.12)',
  /** Neutral. */
  neutral: '#8E857A',
} as const;

export const modernRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const modernElevation = {
  /** Subtle lift for panels. */
  raised: '0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3)',
  /** Card at rest. */
  card: '0 2px 4px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)',
  /** Card under pointer. */
  cardHover: '0 8px 24px rgba(0, 0, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.3)',
  /** Deep lift for modals. */
  overlay: '0 16px 48px rgba(0, 0, 0, 0.6), 0 8px 16px rgba(0, 0, 0, 0.4)',
  /** Focus ring. */
  focusRing: '0 0 0 3px rgba(167, 139, 250, 0.3)',
  /** Glow effect. */
  glow: '0 0 40px rgba(167, 139, 250, 0.08)',
} as const;

/** Glassmorphic values with improved depth. */
export const modernGlass = {
  raisedRgb: '28, 26, 24',
  overlayRgb: '42, 39, 34',
  borderRgb: '51, 46, 40',
  violetRgb: '167, 139, 250',
  /** Backdrop blur value */
  blur: '24px',
  /** Saturation boost */
  saturation: '180%',
} as const;

/**
 * Modern typography with better hierarchy.
 */
export const modernTypography = {
  sans: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: '"JetBrains Mono", "SF Mono", "Fira Code", "Cascadia Code", monospace',
  /** Display font for hero text */
  display: '"Inter", "SF Pro Display", -apple-system, sans-serif',
} as const;

/**
 * Refined spacing scale.
 */
export const modernSpacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
} as const;

/**
 * Modern transition presets.
 */
export const modernTransitions = {
  /** Quick micro-interaction */
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  /** Standard UI transition */
  normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  /** Smooth entrance */
  smooth: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  /** Gentle spring effect */
  spring: '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  /** Complex animation */
  complex: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

/**
 * Modern border styles.
 */
export const modernBorders = {
  subtle: '1px solid rgba(51, 46, 40, 0.5)',
  default: '1px solid rgba(51, 46, 40, 0.8)',
  strong: '1px solid rgba(74, 67, 60, 0.8)',
  accent: '1px solid rgba(167, 139, 250, 0.4)',
  glow: '1px solid rgba(167, 139, 250, 0.6)',
} as const;
