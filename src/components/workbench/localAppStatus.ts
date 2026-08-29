// src/components/workbench/localAppStatus.ts
//
// Plain language and colour for a local application's reachability status.
//
// These were LiveWorkbenchToolbar's, and outlived it. The toolbar was replaced
// by the shared SurfaceHeader when the local app branch moved onto SurfaceHost,
// but both of these are pure mappings that the surface still needs -- the
// header states presence, while a renderer still has to explain *why* an
// application is unavailable.
//
// Kept as their own module rather than left in a component nothing renders. A
// component that exists only so a test can import two functions out of it is
// the same dead weight as an unused design system.

import { ink, status as statusToken } from '../../theme/cssTokens';

/**
 * Plain language for a machine-readable status.
 *
 * The raw values are internal identifiers -- `framing-likely-blocked` is not a
 * sentence -- and the contract forbids surfacing internal codes.
 */
export function describeStatus(state: string): string {
  switch (state) {
    case 'reachable':
      return 'Connected';
    case 'checking':
      return 'Checking';
    case 'framing-likely-blocked':
      return 'Refuses embedding';
    case 'invalid-configuration':
      return 'Not configured';
    default:
      return 'Unavailable';
  }
}

/**
 * Neutral when connected. Brass when something needs attention. Danger when it
 * is simply not there. Never green: a working connection is not an achievement.
 *
 * The brass fallthrough previously caught everything non-reachable, so an
 * application that was down read as "needs attention" rather than "failed".
 * Refusing to embed and being misconfigured are conditions to resolve; not
 * responding is a failure.
 */
export function statusColour(state: string): string {
  if (state === 'reachable') return statusToken.neutral;
  if (state === 'checking') return ink.muted;
  if (state === 'framing-likely-blocked' || state === 'invalid-configuration') {
    return statusToken.brass;
  }
  return statusToken.danger;
}
