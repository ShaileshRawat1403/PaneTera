import * as React from 'react';

/**
 * The canvas is the authoritative surface, and the contract states a floor:
 *
 *   "At workstation widths the canvas receives at least 60% of usable width."
 *
 * That floor was previously not enforced. The conversation pane capped at 55%
 * of the viewport and the project explorer at 48%, chosen independently. But
 * the explorer nests *inside* the canvas, so the two limits compose: at 1280px
 * a person could drag the conversation to 640px and the explorer to 614px,
 * leaving the authoritative canvas 19px of usable width. Both widths persist to
 * localStorage, so that state survived reloads.
 *
 * Maxima are now derived from the floor rather than picked, and the explorer
 * counts against the canvas budget because it consumes canvas space.
 *
 * Two known limitations, both deliberate and neither a correctness problem:
 *
 * 1. The explorer's cap is computed from the *maximum permitted* conversation
 *    width, not the conversation's actual current width. This is a conservative
 *    bound: when the conversation is narrow the canvas is wider than the
 *    calculation assumes, so the explorer is restricted more than it needs to
 *    be. It errs toward protecting the canvas, which is the right direction to
 *    err, but it does leave usable space unclaimed. Relaxing it requires the
 *    actual conversation width to reach this module, either through shared
 *    layout state or a CSS measurement, which is deferred.
 *
 * 2. Below WORKSTATION_MIN_VIEWPORT the contract says the conversation becomes
 *    a contextual surface rather than a permanent pane. That responsive
 *    transition is not built. What happens instead is that the floor is
 *    relaxed and both panes simply get narrower. The floor is therefore not
 *    claimed at narrow widths rather than quietly broken, but the intended
 *    narrow-layout behaviour remains outstanding work.
 */
export const CANVAS_MIN_SHARE = 0.6;

/** Below this width the layout is not a workstation, so the floor is relaxed. */
export const WORKSTATION_MIN_VIEWPORT = 1024;

export function clampPaneWidth(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), Math.max(min, max));
}

/**
 * Largest conversation pane that still leaves the canvas its share.
 *
 * `dividerWidth` is subtracted because the divider is usable width the canvas
 * does not get either.
 */
export function maxConversationWidth(
  viewportWidth: number,
  options: { min: number; absoluteMax: number; dividerWidth?: number },
): number {
  const divider = options.dividerWidth ?? 0;
  if (viewportWidth < WORKSTATION_MIN_VIEWPORT) {
    // Narrow windows cannot honour the floor and still show a conversation.
    // The contract already says conversation becomes contextual at narrow
    // widths rather than crushing the canvas; until that lands, the absolute
    // cap applies and the floor is not claimed.
    return Math.max(options.min, Math.min(options.absoluteMax, viewportWidth * 0.5));
  }
  const budget = viewportWidth * (1 - CANVAS_MIN_SHARE) - divider;
  return Math.max(options.min, Math.min(options.absoluteMax, budget));
}

/**
 * Largest nested pane the canvas can host and still be the dominant surface.
 *
 * The explorer sits inside the canvas, so its budget is a share of what the
 * canvas actually received, not of the viewport. `canvasWidth` is the space the
 * canvas has after the conversation pane and divider are taken.
 */
export function maxNestedPaneWidth(
  canvasWidth: number,
  options: { min: number; absoluteMax: number; nestedMaxShare?: number },
): number {
  const share = options.nestedMaxShare ?? 0.5;
  return Math.max(options.min, Math.min(options.absoluteMax, canvasWidth * share));
}

/** The canvas share a given layout actually leaves. Used by tests and guards. */
export function canvasShare(
  viewportWidth: number,
  conversationWidth: number,
  dividerWidth = 0,
): number {
  if (viewportWidth <= 0) return 0;
  return (viewportWidth - conversationWidth - dividerWidth) / viewportWidth;
}

export function usePersistentPaneWidth(key: string, initial: number, min: number, maxForViewport: () => number) {
  const [width, setWidthState] = React.useState(() => {
    if (typeof window === 'undefined') return initial;
    const saved = Number(window.localStorage.getItem(key));
    return clampPaneWidth(Number.isFinite(saved) && saved > 0 ? saved : initial, min, maxForViewport());
  });

  const setWidth = React.useCallback((next: number) => {
    const bounded = clampPaneWidth(next, min, maxForViewport());
    setWidthState(bounded);
    if (typeof window !== 'undefined') window.localStorage.setItem(key, String(bounded));
  }, [key, maxForViewport, min]);

  React.useEffect(() => {
    // Re-clamp on resize *and* rewrite storage. A width persisted at a wider
    // viewport would otherwise be restored intact on a narrower one, putting the
    // canvas back under its floor on the next load.
    const handleResize = () =>
      setWidthState((current) => {
        const bounded = clampPaneWidth(current, min, maxForViewport());
        if (bounded !== current && typeof window !== 'undefined') {
          window.localStorage.setItem(key, String(bounded));
        }
        return bounded;
      });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [key, maxForViewport, min]);

  return [width, setWidth] as const;
}
