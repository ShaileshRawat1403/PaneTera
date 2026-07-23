// src/components/workstation/workstationLayout.ts
//
// The narrow-viewport layout decisions, kept pure so they can be tested without
// a DOM.
//
// The contract says the conversation "becomes a contextual surface rather than a
// permanent pane" below workstation width. Until now that was unbuilt: below
// 1024px both planes simply shrank, so at 760px the conversation and the
// authoritative canvas each got roughly half a cramped window and neither was
// usable.
//
// The strategy here is a single switched column rather than two crushed ones.
// One plane fills the width at a time, with a persistent switch between them.
// The rules encode two constraints from the handoff that are easy to violate:
//
//   1. Never hide the composer as a side effect. The composer lives inside the
//      conversation plane, so conversation is the default a person lands on, and
//      the switch back to it is always one action away. This module does not
//      auto-switch to the canvas, because doing so would move the composer
//      off-screen without the person asking.
//
//   2. Never strand a person. The switch is persistent and always visible, so
//      the composer is always one action away whatever the canvas holds. That is
//      what makes stranding structurally impossible, rather than a rule that
//      second-guesses the person. An earlier version collapsed the canvas view
//      to the conversation whenever the canvas was empty; verified in a browser,
//      that made the Canvas switch feel dead, because tapping it while the
//      canvas showed its (perfectly informative) empty state did nothing. The
//      empty canvas is a real thing to show, so a request to see it is honoured.

import * as React from 'react';
import { WORKSTATION_MIN_VIEWPORT } from './paneSizing';

/** Which plane fills the column in the stacked (narrow) layout. */
export type WorkstationPlane = 'conversation' | 'canvas';

/**
 * Below this width the two planes cannot coexist without crushing both, so the
 * layout switches from a split to a single stacked column.
 *
 * Shares the workstation threshold rather than picking a second one, so "the
 * canvas holds its 60% floor" and "the layout is stacked" are two statements
 * about the same boundary rather than two numbers that can drift apart.
 */
export const STACKED_BELOW_VIEWPORT = WORKSTATION_MIN_VIEWPORT;

/** Whether a viewport is narrow enough to stack the planes. */
export function isStackedWidth(width: number): boolean {
  return width > 0 && width < STACKED_BELOW_VIEWPORT;
}

/**
 * Whether the canvas switch should signal that content is waiting there.
 *
 * An availability hint, not an unread count. It is true whenever the canvas
 * holds something and the person is looking at the other plane, because the
 * honest statement is "there is something over there", which stays true however
 * many times they glance at it. Deliberately not auto-switching is what makes
 * this hint necessary: the person is told, and chooses.
 */
export function shouldSignalCanvas(active: WorkstationPlane, canvasHasContent: boolean): boolean {
  return canvasHasContent && active !== 'canvas';
}

/**
 * Track whether the viewport is in the stacked range.
 *
 * Uses matchMedia so it re-renders on the boundary crossing rather than on every
 * resize pixel. SSR-safe: returns the split layout when there is no window.
 */
export function useIsStacked(): boolean {
  const query = `(max-width: ${STACKED_BELOW_VIEWPORT - 1}px)`;
  const [stacked, setStacked] = React.useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const update = () => setStacked(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);

  return stacked;
}
