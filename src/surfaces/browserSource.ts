// src/surfaces/browserSource.ts
//
// Adapts the shape App.tsx already keeps for the browser preview into the
// BrowserSourceState that projectBrowserSurface reads.
//
// It exists so the mapping is a pure function with its own tests, rather than
// an object literal assembled inline in a 2500-line render. The projection was
// already pure and tested; this is the last unproven hop between App state and
// the descriptor, and it is exactly where a wrong `kind` or a dropped frame
// would silently produce a surface that claims the wrong liveness.
//
// It reads only what App already holds. It does not call the bridge, does not
// resolve anything, and adds no new source of truth.

import type {
  BrowserSourceState,
  BrowserFrameState,
  BrowserPairingState,
} from './projectSurface';

/**
 * The inspection lifecycle as App.tsx models it: a discriminated union whose
 * `live` case carries the captured frame.
 *
 * Re-declared structurally rather than imported, for the same reason
 * projectSurface re-declares its inputs: this module must stay free of DOM and
 * React dependencies so it can be tested as a plain function.
 */
export type WebPreviewInspectionLike =
  | { kind: 'idle' }
  | { kind: 'requesting' }
  | { kind: 'live'; frame: BrowserFrameState }
  | { kind: 'evidence'; record?: unknown }
  | { kind: 'error'; detail?: string };

/** The web preview request App is currently showing, if any. */
export interface WebPreviewRequestLike {
  url: string;
  name: string;
}

export interface BrowserSourceInput {
  request: WebPreviewRequestLike | null | undefined;
  inspection: WebPreviewInspectionLike;
  pairing: BrowserPairingState;
}

/**
 * Build the projection's input from App state.
 *
 * The frame is carried only from the `live` case, because that is the only
 * case that has one. Reading it more permissively is how a stale capture would
 * end up presented as the current page.
 */
export function browserSourceState(input: BrowserSourceInput): BrowserSourceState {
  const { request, inspection, pairing } = input;

  return {
    pairing,
    request: request ? { url: request.url, name: request.name } : undefined,
    frame: inspection.kind === 'live' ? inspection.frame : undefined,
    inspectionKind: inspection.kind,
  };
}
