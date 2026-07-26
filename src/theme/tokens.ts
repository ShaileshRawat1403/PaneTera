// src/theme/tokens.ts
// The design language from PANETERA_WORKSTATION_CONTRACT.md, as values.
//
// The contract specifies warm graphite surfaces, parchment-white text, a
// restrained violet interaction accent, and brass for attention. Green denotes
// meaningful success, never continuous healthy decoration.
//
// "Warm" is the load-bearing word. The composer previously used #171d27 and
// #a0aec0, which are cool blue-greys: their blue channel exceeds their red.
// Warm graphite inverts that relationship, so every surface below has
// red >= blue. test/theme.test.ts asserts it, because "warm" is otherwise the
// kind of intention that quietly drifts back to Tailwind slate.

export const surface = {
  /** Deepest ground, behind everything. */
  base: '#181614',
  /** The authoritative canvas plane, one step up from base so it reads as its own surface. */
  canvas: '#1B1917',
  /** Default panel: composer, cards, drawers. */
  raised: '#211E1B',
  /** An interactive panel under the pointer. One warm step above `raised`. */
  raisedHover: '#26221F',
  /** Panel above a panel: menus, popovers. */
  overlay: '#2A2622',
  /** Pressed or recessed wells. */
  sunken: '#141211',
  /** Hairlines and dividers. */
  border: '#3A3430',
  /** Border on a focused or active container. */
  borderStrong: '#4C443E',
  /** Modal scrim over the workstation. */
  backdrop: 'rgba(24, 22, 20, 0.72)',
} as const;

export const ink = {
  /** Parchment white. Primary reading text. */
  primary: '#F2EDE4',
  /** Supporting text: descriptions, helper copy, metadata. AA everywhere. */
  secondary: '#BDB4A8',
  /**
   * De-emphasised but still readable. AA on every surface.
   *
   * The previous value (#8E857A) reached only 4.14:1 on the overlay surface and
   * was documented as "large text only", while every actual use was 10 to 12.5px
   * helper text. Rather than re-tag call sites and rely on that discipline
   * holding, the token itself now meets 4.5:1 everywhere, so the remaining
   * distinction between secondary and muted is emphasis rather than safety.
   */
  muted: '#968C82',
  /**
   * Genuinely disabled controls only.
   *
   * WCAG exempts disabled elements from contrast minimums, which is what makes
   * a dimmer value legitimate here and nowhere else. Never use this for text a
   * user is expected to read.
   */
  disabled: '#7A7268',
  /** Text on violet or brass fills. */
  onAccent: '#17130F',
} as const;

export const accent = {
  /** Restrained violet. Interaction, selection, focus. */
  violet: '#B9A5E8',
  violetMuted: 'rgba(185, 165, 232, 0.16)',
  violetHover: 'rgba(185, 165, 232, 0.24)',
  /** The fill under a selected or open control, a touch stronger than hover. */
  violetSelected: 'rgba(185, 165, 232, 0.20)',
  violetBorder: 'rgba(185, 165, 232, 0.52)',
} as const;

export const status = {
  /** Brass. Attention: approvals, ambiguity, stale context, weak evidence. */
  brass: '#D6A756',
  brassMuted: 'rgba(214, 167, 86, 0.14)',
  /**
   * Meaningful success only. The contract forbids green as continuous healthy
   * decoration, so this is for a completed verification or an approved action,
   * not for an idle connection sitting there being fine.
   */
  success: '#8FBF7F',
  successMuted: 'rgba(143, 191, 127, 0.14)',
  /** Failure and refusal. */
  danger: '#E08A7B',
  dangerMuted: 'rgba(224, 138, 123, 0.14)',
  /** Neutral, for healthy-and-unremarkable. Deliberately not green. */
  neutral: '#8E857A',
} as const;

/** 8px system. Values are multipliers of the base unit, not raw pixels. */
export const SPACING_UNIT = 8;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/**
 * Humanist typography. Monospace is reserved for code, paths, identifiers, and
 * logs, per the contract, so it is a separate token rather than a variant.
 *
 * System-resident faces only. An earlier version named Inter and JetBrains
 * Mono while index.css loaded Plus Jakarta Sans and Fira Code from Google
 * Fonts, so the tokens described a typeface the app never rendered. Naming a
 * font PaneTera does not ship means either a third-party request on first
 * paint, which a local-first product should not make, or a silent fallback.
 * These stacks resolve offline on every target platform.
 *
 * If a licensed face is wanted later, self-host it and prepend it here.
 */
export const typography = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
} as const;

export const elevation = {
  /** Panels sitting on the base surface. */
  raised: '0 1px 2px rgba(0, 0, 0, 0.32)',
  /** A resting interactive card. */
  card: '0 1px 2px rgba(0, 0, 0, 0.28)',
  /** An interactive card lifting under the pointer or keyboard focus. */
  cardHover: '0 8px 20px rgba(0, 0, 0, 0.40)',
  /** Menus and popovers. */
  overlay: '0 12px 32px rgba(0, 0, 0, 0.44)',
  /** Focus ring, drawn as a shadow so it costs no layout. */
  focusRing: `0 0 0 3px ${accent.violetMuted}`,
} as const;

/** Glassmorphic RGB values for backdrop-filter effects. */
export const glass = {
  /** raised surface RGB (33, 30, 27). */
  raisedRgb: '33, 30, 27',
  /** overlay surface RGB (42, 38, 34). */
  overlayRgb: '42, 38, 34',
  /** border RGB (58, 52, 48). */
  borderRgb: '58, 52, 48',
  /** accent violet RGB (185, 165, 232). */
  violetRgb: '185, 165, 232',
} as const;

export const lightGlass = {
  /** raised surface RGB for light mode (255, 255, 255). */
  raisedRgb: '255, 255, 255',
  /** overlay surface RGB for light mode (255, 255, 255). */
  overlayRgb: '255, 255, 255',
  /** border RGB for light mode (212, 212, 211). */
  borderRgb: '212, 212, 211',
  /** accent violet RGB for light mode (109, 70, 194). */
  violetRgb: '109, 70, 194',
} as const;

/**
 * Light mode keeps the same warm, restrained identity: parchment becomes the
 * ground, graphite becomes the ink, and violet remains the sole interaction
 * accent. These are raw values for theme construction and contrast tests;
 * components consume the mode-aware CSS variables from cssTokens.ts.
 */
export const lightSurface = {
  base: '#F4F4F3',
  canvas: '#FAFAF9',
  raised: '#FFFFFF',
  raisedHover: '#F4F4F3',
  overlay: '#FFFFFF',
  sunken: '#E4E4E3',
  border: '#D4D4D3',
  borderStrong: '#A1A1A0',
  backdrop: 'rgba(33, 28, 24, 0.34)',
} as const;

export const lightInk = {
  primary: '#181614',
  secondary: '#45403B',
  muted: '#5C564F',
  disabled: '#948D85',
  onAccent: '#FFFFFF',
} as const;

export const lightAccent = {
  violet: '#6D46C2',
  violetMuted: 'rgba(109, 70, 194, 0.08)',
  violetHover: 'rgba(109, 70, 194, 0.14)',
  violetSelected: 'rgba(109, 70, 194, 0.12)',
  violetBorder: 'rgba(109, 70, 194, 0.40)',
} as const;

export const lightStatus = {
  brass: '#9E6A00',
  brassMuted: 'rgba(158, 106, 0, 0.10)',
  success: '#1B7A27',
  successMuted: 'rgba(27, 122, 39, 0.10)',
  danger: '#A82B1E',
  dangerMuted: 'rgba(168, 43, 30, 0.10)',
  neutral: '#5C564F',
} as const;

export const lightElevation = {
  raised: '0 1px 3px rgba(24, 22, 20, 0.06)',
  card: '0 1px 3px rgba(24, 22, 20, 0.05)',
  cardHover: '0 8px 24px rgba(24, 22, 20, 0.10)',
  overlay: '0 12px 32px rgba(24, 22, 20, 0.14)',
  focusRing: `0 0 0 3px ${lightAccent.violetMuted}`,
} as const;

export const tokens = {
  surface,
  ink,
  accent,
  status,
  radius,
  typography,
  elevation,
  SPACING_UNIT,
} as const;
