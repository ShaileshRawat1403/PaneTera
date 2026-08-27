// src/surfaces/projectSurface.ts
//
// Pure projection functions that transform existing PaneTera source state
// into SurfaceDescriptor values.
//
// These functions:
//   - Accept existing source-of-truth types as input.
//   - Return a SurfaceDescriptor (presentation projection only).
//   - Never mutate the input.
//   - Never execute capabilities, make network calls, or access stores.
//   - Never import React or return ReactNode values.
//
// Supported projections in this slice:
//   A. Browser live/observation surface
//   B. Local App workbench surface

import type {
  SurfaceDescriptor,
  SurfaceAction,
  SurfacePresence,
} from './types';

// ─── Source state types (re-declared inline to avoid pulling in DOM/React) ──

/**
 * Subset of BrowserOperatorStatus from browserOperatorBridge.ts.
 * We re-declare here to keep this module free of DOM dependencies
 * (the bridge uses `window.postMessage`).
 */
export interface BrowserPairingState {
  paired: boolean;
  extensionAvailable: boolean;
}

/**
 * Subset of BrowserLiveFrame from browserOperatorBridge.ts.
 * Includes screenshotDataUrl so the renderer payload is self-contained.
 *
 * Note: screenshotDataUrl can be up to ~8MB (base64 JPEG).  The descriptor
 * is an ephemeral projection computed on demand, not cached or serialised
 * to storage, so carrying the reference is acceptable.  If future use
 * requires persistence or transfer, the payload should carry a content-hash
 * reference instead.
 */
export interface BrowserFrameState {
  sessionId: string;
  title: string;
  url: string;
  screenshotDataUrl: string;
  viewport: {
    width: number;
    height: number;
  };
  capturedAt: string;
}

/**
 * Subset of BrowserInspectedComponent from browserOperatorBridge.ts.
 * Presentation-relevant fields only.
 */
export interface BrowserInspectedComponentState {
  tagName: string;
  id: string;
  classNames: string[];
  role: string;
  text: string;
  path: string;
  rect: { x: number; y: number; width: number; height: number };
  attributes: Record<string, string>;
}

/**
 * The inspection lifecycle state as tracked in App.tsx.
 * We accept only the discriminant `kind` and the fields
 * needed for projection.
 */
export type BrowserInspectionKind = 'idle' | 'requesting' | 'live' | 'evidence' | 'error';

/**
 * Composite browser source state that the projection reads.
 * All fields come from existing state in App.tsx and browserOperatorBridge.ts.
 */
export interface BrowserSourceState {
  /** From requestBrowserOperatorStatus(). */
  pairing: BrowserPairingState;

  /** The web preview request that opened this surface, if any. */
  request?: {
    url: string;
    name: string;
  };

  /** The current live frame, if the browser is in live inspection mode. */
  frame?: BrowserFrameState;

  /** The most recently inspected component, if any. */
  inspectedComponent?: BrowserInspectedComponentState;

  /** The current inspection lifecycle phase. */
  inspectionKind: BrowserInspectionKind;
}

// ─── Source state types for Local App ──────────────────────────────

/**
 * Subset of LocalAppDefinitionClient from LiveWorkbenchSurface.tsx.
 * Re-declared to avoid pulling in React component dependencies.
 */
export interface LocalAppSourceDefinition {
  appId: string;
  name: string;
  url: string;
  description?: string;
  enabled: boolean;
}

/**
 * The reachability status string as used in App.tsx and LiveWorkbenchToolbar.tsx.
 * Values: 'checking' | 'reachable' | 'framing-likely-blocked' | 'invalid-configuration'
 * or any other string (mapped to 'unavailable').
 */
export type LocalAppStatus = string;

/**
 * Composite local app source state that the projection reads.
 */
export interface LocalAppSourceState {
  app: LocalAppSourceDefinition;
  status: LocalAppStatus;
}

// ─── Browser Projection ───────────────────────────────────────────

/**
 * Derives SurfacePresence from the current browser inspection lifecycle
 * and pairing state.
 *
 * - paired + live frame → 'live'
 * - paired + evidence/idle with a request → 'snapshot'
 * - paired but no frame or request → 'disconnected'
 * - not paired → 'disconnected'
 * - extension not available → 'unavailable'
 */
function deriveBrowserPresence(source: BrowserSourceState): SurfacePresence {
  if (!source.pairing.extensionAvailable) return 'unavailable';
  if (!source.pairing.paired) return 'disconnected';

  if (source.inspectionKind === 'live' && source.frame) return 'live';
  if (source.inspectionKind === 'evidence') return 'snapshot';
  if (source.inspectionKind === 'requesting') return 'live';
  if (source.request) return 'snapshot';

  return 'disconnected';
}

/**
 * Builds the available browser surface actions based on current state.
 *
 * Only includes actions that the current browser bridge actually supports.
 * All browser observation actions are 'observe' — they read from the page
 * without mutating it.  The bridge commands (snapshot, inspect) are
 * initiated by PaneTera's UI and routed through the extension bridge,
 * not through the Rig governance path.
 */
function deriveBrowserActions(source: BrowserSourceState): SurfaceAction[] {
  const actions: SurfaceAction[] = [];

  // Snapshot and inspect are only meaningful when paired and have an active frame or request.
  if (source.pairing.paired && (source.frame || source.request)) {
    actions.push({
      id: 'snapshot',
      label: 'Snapshot',
      icon: 'camera',
      behavior: 'observe',
    });

    actions.push({
      id: 'inspect',
      label: 'Inspect',
      icon: 'search',
      behavior: 'observe',
    });
  }

  return actions;
}

/**
 * Projects existing browser source state into a SurfaceDescriptor.
 *
 * This is a pure function.  It does not:
 *   - mutate the input
 *   - access browser APIs or stores
 *   - execute bridge commands
 *   - return React components
 */
export function projectBrowserSurface(source: BrowserSourceState): SurfaceDescriptor {
  const title = source.frame?.title || source.request?.name || 'Browser';
  const subtitle = source.frame?.url || source.request?.url;
  const presence = deriveBrowserPresence(source);
  const actions = deriveBrowserActions(source);

  const viewportMode = source.frame
    ? `${source.frame.viewport.width}×${source.frame.viewport.height}`
    : undefined;

  return {
    id: source.frame?.sessionId || source.request?.url || 'browser',
    kind: 'browser',

    identity: {
      title,
      subtitle,
      icon: 'globe',
    },

    state: {
      presence,
      // Browser surfaces do not claim verified integrity.
      // Evidence verification is handled by the evidence system.
    },

    actions,

    view: {
      mode: viewportMode,
      canSplit: true,
      canClose: true,
    },

    renderer: {
      type: 'browser-observation',
      payload: {
        sessionId: source.frame?.sessionId ?? null,
        url: source.frame?.url || source.request?.url || null,
        title: source.frame?.title || source.request?.name || null,
        screenshotDataUrl: source.frame?.screenshotDataUrl ?? null,
        viewport: source.frame?.viewport ?? null,
        capturedAt: source.frame?.capturedAt ?? null,
        inspectionKind: source.inspectionKind,
        inspectedComponent: source.inspectedComponent ?? null,
      },
    },
  };
}

// ─── Local App Projection ─────────────────────────────────────────

/**
 * Derives SurfacePresence from the local app status string.
 *
 * Follows a conservative projection:
 *   - 'reachable' is the ONLY status that has proven usable liveness → 'live'.
 *   - All other statuses ('checking', 'framing-likely-blocked',
 *     'invalid-configuration', unknown) → 'unavailable'.
 *
 * The source model has no trustworthy "was live, then lost connection"
 * condition, so the local-app projector never emits 'disconnected'.
 *
 * The original machine-readable status string is preserved in the renderer
 * payload so the renderer can display a human-readable explanation
 * (Checking, Refuses embedding, Not configured, Unavailable) without
 * polluting SurfacePresence with app-specific detail.
 *
 * Connected/reachable does NOT imply verified integrity.
 * Transport details (sandbox profile, iframe flags) are not leaked.
 */
function deriveLocalAppPresence(status: LocalAppStatus): SurfacePresence {
  if (status === 'reachable') return 'live';
  return 'unavailable';
}

/**
 * Projects existing local app source state into a SurfaceDescriptor.
 *
 * This is a pure function.  It does not:
 *   - mutate the input
 *   - access browser APIs or stores
 *   - execute any commands
 *   - return React components
 *   - leak transport details (sandbox profile, iframe sandbox flags)
 */
export function projectLocalAppSurface(source: LocalAppSourceState): SurfaceDescriptor {
  const presence = deriveLocalAppPresence(source.status);

  return {
    id: `local-app:${source.app.appId}`,
    kind: 'local-app',

    identity: {
      title: source.app.name,
      subtitle: source.app.url,
      icon: 'app',
    },

    state: {
      presence,
      // Local app surfaces do not claim verified integrity.
      // A connected iframe is not a cryptographic proof.
    },

    // Local app actions are empty for now.
    // The existing toolbar offers Reload, Open in browser, and Close,
    // which are view controls (Zone 3), not surface tools (Zone 2).
    actions: [],

    view: {
      canSplit: true,
      canClose: true,
    },

    renderer: {
      type: 'local-app-frame',
      payload: {
        appId: source.app.appId,
        name: source.app.name,
        url: source.app.url,
        description: source.app.description ?? null,
        enabled: source.app.enabled,
        // Preserve the original machine-readable status so the renderer
        // can display a human-readable explanation (Checking, Refuses
        // embedding, Not configured, Unavailable) without polluting
        // SurfacePresence with app-specific detail.
        sourceStatus: source.status,
      },
    },
  };
}
