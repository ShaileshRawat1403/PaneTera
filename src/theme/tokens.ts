// src/theme/tokens.ts
// The design language from PANETERA_WORKSTATION_CONTRACT.md, as values.
//
// Cool graphite surfaces, near-neutral text, a restrained violet interaction
// accent, and brass for attention. Green denotes meaningful success, never
// continuous healthy decoration.
//
// WHY COOL, WHEN THIS PALETTE USED TO BE WARM
//
// PaneTera's claim is that the person's real work sits on the canvas and the
// workstation recedes around it. That work is frequently colour-critical --
// an OpenPencil document, a darktable edit, a Shotcut frame, a screenshot
// under inspection. A warm chrome casts over all of it: every neutral in a
// photograph placed on a warm ground reads slightly wrong, and the person
// cannot tell whether they are looking at their image or at our surface.
// Cool-neutral surfaces are what let a rendered frame look like itself.
//
// So the axis is deliberate rather than decorative, and it is now inverted:
// every surface has blue >= red. The discipline that matters is the second
// half of the rule -- COOL, NOT BLUE. These are graphite, not slate and not
// navy, so the blue-over-red margin stays small. test/theme.test.ts asserts
// both halves: the direction and the bound.
//
// Warmth is not gone, it is spent where it carries meaning. Brass is the
// warmest thing in the interface, which is what makes an approval waiting on
// a person the warmest thing on screen. Against a cool ground it reads as
// heat, in a way it never quite did against warm graphite.

export const surface = {
  /** Deepest ground, behind everything. */
  base: '#15161A',
  /** The authoritative canvas plane, one step up from base so it reads as its own surface. */
  canvas: '#191A1E',
  /** Default panel: composer, cards, drawers. */
  raised: '#1E2025',
  /** An interactive panel under the pointer. One step above `raised`. */
  raisedHover: '#23262C',
  /** Panel above a panel: menus, popovers. */
  overlay: '#282B32',
  /** Pressed or recessed wells. */
  sunken: '#101115',
  /** Hairlines and dividers. */
  border: '#2C2F36',
  /** Border on a focused or active container. */
  borderStrong: '#3E4148',
  /** Modal scrim over the workstation. */
  backdrop: 'rgba(21, 22, 26, 0.72)',
} as const;

export const ink = {
  /** Near-neutral white, a shade cool to sit with the surfaces. Primary reading text. */
  primary: '#E8E9EC',
  /** Supporting text: descriptions, helper copy, metadata. AA everywhere. */
  secondary: '#B4B8C0',
  /**
   * De-emphasised but still readable. AA on every surface.
   *
   * The previous value (#8E857A) reached only 4.14:1 on the overlay surface and
   * was documented as "large text only", while every actual use was 10 to 12.5px
   * helper text. Rather than re-tag call sites and rely on that discipline
   * holding, the token itself now meets 4.5:1 everywhere, so the remaining
   * distinction between secondary and muted is emphasis rather than safety.
   */
  muted: '#8F949E',
  /**
   * Genuinely disabled controls only.
   *
   * WCAG exempts disabled elements from contrast minimums, which is what makes
   * a dimmer value legitimate here and nowhere else. Never use this for text a
   * user is expected to read.
   */
  disabled: '#6E727B',
  /** Text on violet or brass fills. */
  onAccent: '#15161A',
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
  /**
   * Neutral, for healthy-and-unremarkable. Deliberately not green.
   *
   * This is the colour of a connected app, a live surface, a reachable
   * endpoint -- everything that is merely fine. Green is reserved for
   * verified, so "fine" has to have somewhere else to go.
   */
  neutral: '#8F949E',
} as const;

/** 8px system. Values are multipliers of the base unit, not raw pixels. */
export const SPACING_UNIT = 8;

/**
 * Vertical rhythm, on a 4px grid.
 *
 * These were previously independent literals scattered across the shell -- 56,
 * 34, 30, 44, 16, 7 -- chosen one at a time. paneSizing.ts already makes this
 * argument about widths, refusing to let "the canvas holds 60%" and "the layout
 * is stacked" become two numbers that can drift apart. Heights deserve the
 * same treatment: "compact, minimal, quiet" is a claim about rhythm, and
 * independent literals are what destroy rhythm.
 *
 * The grid is 4px because that is the largest step that divides every value
 * here, including the 28px control inside the 44px bar.
 */
export const density = {
  /**
   * A global chrome bar. One tier, not two.
   *
   * The shell previously spent 87px before any work was visible: a 56px top bar
   * over a 30px cockpit strip. They carry one idea between them -- where you
   * are and what is happening -- so they are now one bar, and the reclaimed
   * height goes to the canvas as surface-local identity.
   */
  bar: 44,
  /** A control sitting inside a bar, leaving 8px of breathing room above and below. */
  control: 28,
  /** The nav rail's width. Equal to `bar`, so the shell's chrome squares off at the corner. */
  rail: 44,
  /**
   * Minimum comfortable target for a coarse pointer. Controls stay at `control`
   * height on a mouse and grow to this under `@media (pointer: coarse)`.
   */
  touch: 44,
  /** A surface-local bar: the surface header, the open-surfaces strip. */
  surfaceBar: 32,
} as const;

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
  /** raised surface RGB (30, 32, 37). */
  raisedRgb: '30, 32, 37',
  /** overlay surface RGB (40, 43, 50). */
  overlayRgb: '40, 43, 50',
  /** border RGB (44, 47, 54). */
  borderRgb: '44, 47, 54',
  /** accent violet RGB (185, 165, 232). */
  violetRgb: '185, 165, 232',
} as const;

export const lightGlass = {
  /** raised surface RGB for light mode (255, 255, 255). */
  raisedRgb: '255, 255, 255',
  /** overlay surface RGB for light mode (255, 255, 255). */
  overlayRgb: '255, 255, 255',
  /** border RGB for light mode (210, 213, 218). */
  borderRgb: '210, 213, 218',
  /** accent violet RGB for light mode (109, 70, 194). */
  violetRgb: '109, 70, 194',
} as const;

/**
 * Light mode keeps the same restrained identity with the roles swapped: paper
 * becomes the ground, graphite becomes the ink, and violet remains the sole
 * interaction accent. The same cool-not-blue discipline applies, and it needs
 * more care here: a colour cast is far more visible near white than near
 * black, so the blue-over-red margins below are smaller than the dark ones.
 * These are raw values for theme construction and contrast tests; components
 * consume the mode-aware CSS variables from cssTokens.ts.
 */
export const lightSurface = {
  base: '#F2F3F5',
  canvas: '#F8F9FA',
  raised: '#FFFFFF',
  raisedHover: '#EDEEF1',
  overlay: '#FFFFFF',
  sunken: '#E5E7EA',
  border: '#D2D5DA',
  borderStrong: '#A3A6AB',
  backdrop: 'rgba(21, 22, 26, 0.34)',
} as const;

export const lightInk = {
  primary: '#15161A',
  secondary: '#41454D',
  muted: '#565B64',
  disabled: '#9298A1',
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
  neutral: '#565B64',
} as const;

export const lightElevation = {
  raised: '0 1px 3px rgba(21, 22, 26, 0.06)',
  card: '0 1px 3px rgba(21, 22, 26, 0.05)',
  cardHover: '0 8px 24px rgba(21, 22, 26, 0.10)',
  overlay: '0 12px 32px rgba(21, 22, 26, 0.14)',
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
