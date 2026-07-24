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

/**
 * Light mode keeps the same warm, restrained identity: parchment becomes the
 * ground, graphite becomes the ink, and violet remains the sole interaction
 * accent. These are raw values for theme construction and contrast tests;
 * components consume the mode-aware CSS variables from cssTokens.ts.
 */
export const lightSurface = {
  base: '#F4F0E8',
  canvas: '#F8F5EF',
  raised: '#FFFCF7',
  raisedHover: '#F2ECE3',
  overlay: '#FFFDF9',
  sunken: '#EDE7DE',
  border: '#D5CCC0',
  borderStrong: '#B8AA9B',
  backdrop: 'rgba(33, 28, 24, 0.34)',
} as const;

export const lightInk = {
  primary: '#211C18',
  secondary: '#5E554D',
  muted: '#6F655B',
  disabled: '#9A9086',
  onAccent: '#FFFDF9',
} as const;

export const lightAccent = {
  violet: '#6F55A8',
  violetMuted: 'rgba(111, 85, 168, 0.12)',
  violetHover: 'rgba(111, 85, 168, 0.18)',
  violetSelected: 'rgba(111, 85, 168, 0.16)',
  violetBorder: 'rgba(111, 85, 168, 0.46)',
} as const;

export const lightStatus = {
  brass: '#8A5A00',
  brassMuted: 'rgba(138, 90, 0, 0.11)',
  success: '#3F7A38',
  successMuted: 'rgba(63, 122, 56, 0.11)',
  danger: '#A9483B',
  dangerMuted: 'rgba(169, 72, 59, 0.11)',
  neutral: '#746B62',
} as const;

export const lightElevation = {
  raised: '0 1px 2px rgba(65, 49, 34, 0.10)',
  card: '0 1px 2px rgba(65, 49, 34, 0.09)',
  cardHover: '0 8px 20px rgba(65, 49, 34, 0.16)',
  overlay: '0 12px 32px rgba(65, 49, 34, 0.18)',
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
