// src/theme/motion.ts
// Motion tokens, with reduced motion treated as a requirement rather than a
// nicety.
//
// The workstation contract lists reduced-motion support alongside WCAG AA
// contrast and keyboard operation. Motion here exists only where it explains a
// state change: a menu appearing, a chip attaching or leaving, a panel opening.
// Nothing loops, nothing draws attention to itself, nothing animates on idle.

export const duration = {
  /** Focus rings, hover, colour shifts. Below this, motion reads as a glitch. */
  instant: 90,
  /** Menu and popover entry, chip attach. */
  quick: 140,
  /** Panel open, larger surfaces travelling further. */
  settled: 200,
} as const;

export const easing = {
  /** Entering: decelerate into place. */
  enter: 'cubic-bezier(0.16, 0.84, 0.44, 1)',
  /** Leaving: accelerate away, faster than entering. */
  exit: 'cubic-bezier(0.4, 0, 0.7, 0.2)',
  /** Symmetric moves such as hover and colour. */
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether the person has asked for less motion.
 *
 * Defaults to true when no matchMedia exists, which covers server rendering.
 * Guessing "no reduction" during SSR would flash full motion before hydration
 * corrects it, which is exactly the population that should not see it.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Build a CSS transition string, honouring reduced motion.
 *
 * Under reduced motion this returns `none` rather than a shortened duration.
 * A 40ms version of the same movement is still movement, and the request is to
 * not move.
 */
export function transition(
  properties: readonly string[],
  ms: number = duration.quick,
  curve: string = easing.standard,
  reduced: boolean = prefersReducedMotion(),
): string {
  if (reduced) return 'none';
  return properties.map((property) => `${property} ${ms}ms ${curve}`).join(', ');
}

/**
 * Styles for an element entering the layout.
 *
 * Under reduced motion this returns nothing at all: the element simply exists.
 *
 * An earlier version kept a short fade here on the reasoning that opacity
 * carries no vestibular cost. That was defensible in isolation but untrue in
 * the running app, because the global `prefers-reduced-motion` override in the
 * theme and in index.css cancels all animation anyway. The code claimed one
 * policy and the stylesheet enforced another, and the tests documented the
 * claim rather than the behaviour. One policy now: reduced motion means no
 * animation.
 */
export function enterStyles(reduced: boolean = prefersReducedMotion()) {
  if (reduced) return {};
  return {
    '@keyframes panetera-enter': {
      from: { opacity: 0, transform: 'translateY(4px) scale(0.99)' },
      to: { opacity: 1, transform: 'translateY(0) scale(1)' },
    },
    animation: `panetera-enter ${duration.quick}ms ${easing.enter}`,
  };
}

/** Chip arrival. Smaller travel than a panel, because it moves a shorter way. */
export function chipEnterStyles(reduced: boolean = prefersReducedMotion()) {
  if (reduced) return {};
  return {
    '@keyframes panetera-chip-enter': {
      from: { opacity: 0, transform: 'translateY(3px)' },
      to: { opacity: 1, transform: 'translateY(0)' },
    },
    animation: `panetera-chip-enter ${duration.quick}ms ${easing.enter}`,
  };
}

/**
 * Scroll behaviour for programmatic scrolling.
 *
 * `scrollIntoView({ behavior: 'smooth' })` is animation, and an auto-scrolling
 * transcript animates on every reply. It is one of the more disruptive motions
 * in the product for anyone sensitive to it, precisely because it is
 * involuntary and repeats.
 */
export function scrollBehavior(reduced: boolean = prefersReducedMotion()): ScrollBehavior {
  return reduced ? 'auto' : 'smooth';
}

export const motion = {
  duration,
  easing,
  transition,
  enterStyles,
  chipEnterStyles,
  prefersReducedMotion,
  REDUCED_MOTION_QUERY,
} as const;
