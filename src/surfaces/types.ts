// src/surfaces/types.ts
//
// Frozen PaneTera SurfaceHost UI contract.
//
// A SurfaceDescriptor is a PRESENTATION PROJECTION.  It describes how
// existing source state should be displayed inside the workstation canvas.
//
// Invariants:
//   - Does not own browser, Rig, workspace, or provenance state.
//   - Does not execute capabilities or contain callbacks.
//   - Does not contain React components or render functions.
//   - External MCPs never provide renderers; PaneTera owns rendering.
//
// Liveness semantics:
//   - A merely connected/reachable application is neutral, not green.
//   - Green is reserved for verified cryptographic provenance.
//
// Surface actions carry intent and governance metadata only:
//   - 'local-ui': executes entirely within PaneTera UI (e.g. copy, toggle).
//   - 'observe':  reads from the surface without mutation (e.g. snapshot, inspect).
//   - 'propose':  enters the proposal → approval → invocation governance path.

// ─── Presence & Integrity ─────────────────────────────────────────

/** Whether the surface's upstream source is currently reachable. */
export type SurfacePresence = 'live' | 'snapshot' | 'disconnected' | 'unavailable';

/** Whether the surface's content has been cryptographically verified. */
export type SurfaceIntegrity = 'verified' | 'unverified';

// ─── Surface Actions ──────────────────────────────────────────────

/**
 * How a surface action is governed.
 *
 * - 'local-ui':  Runs entirely within PaneTera's UI layer (copy, toggle view).
 * - 'observe':   Reads from the source without mutating it (snapshot, inspect).
 * - 'propose':   Enters the governed proposal → approval → invocation path.
 */
export type SurfaceActionBehavior = 'local-ui' | 'observe' | 'propose';

/**
 * A declared action that can be offered from a surface header.
 *
 * This is metadata only.  It does not own execution, does not carry callbacks,
 * and does not contain React render functions.
 */
export interface SurfaceAction {
  /** Stable identifier for this action within the surface. */
  id: string;

  /** Human-readable label shown in Zone 2 of the surface header. */
  label: string;

  /** Optional icon identifier (not a React component). */
  icon?: string;

  /**
   * How this action is governed.
   *
   * Actions with behavior 'propose' must reference a governed capability
   * via capabilityRef so the SurfaceHost can route them through the
   * authoritative proposal → approval → invocation path.
   */
  behavior: SurfaceActionBehavior;

  /**
   * For governed actions (behavior === 'propose'), the upstream capability
   * that will be invoked through the Rig governance path.
   */
  capabilityRef?: {
    connectionId: string;
    capabilityId: string;
  };

  /** Optional static payload to pass when the action is triggered. */
  payload?: Record<string, unknown>;
}

// ─── Renderer Types ───────────────────────────────────────────────

/**
 * PaneTera's known renderer types.  External MCPs do not provide arbitrary
 * renderers; PaneTera owns rendering via typed data schemas.
 */
export type SurfaceRendererType =
  | 'browser-observation'
  | 'local-app-frame'
  | 'rig-structured-view'
  | 'markdown-artifact'
  | 'diff-viewer'
  | 'workspace-catalog';

// ─── Surface Descriptor ───────────────────────────────────────────

/**
 * Pure presentation projection of an upstream source's state into the
 * workstation canvas.
 *
 * SurfaceDescriptor does not:
 *   - own browser state (that stays with Browser Operator)
 *   - own Rig connection state (that stays with Rig)
 *   - own workspace state (that stays with the relevant source)
 *   - own provenance state (that stays with the evidence system)
 *   - execute capabilities
 *   - contain ReactNode or render functions
 */
export interface SurfaceDescriptor {
  /** Stable surface identifier, derived from the upstream source. */
  id: string;

  /** What kind of upstream source this surface projects. */
  kind: 'browser' | 'local-app' | 'mcp' | 'artifact' | 'workspace';

  /** Zone 1: Identity & Context. */
  identity: {
    /** Primary title for the surface header. */
    title: string;
    /** Secondary context (URL, filename, project name). */
    subtitle?: string;
    /** Optional icon identifier (not a React component). */
    icon?: string;
  };

  /** Current liveness and integrity of the upstream source. */
  state: {
    /** Whether the source is live, showing a snapshot, disconnected, or unavailable. */
    presence: SurfacePresence;
    /**
     * Whether the surface content has verified cryptographic provenance.
     * Omitted when integrity is not applicable (most surfaces).
     * Only set to 'verified' when the evidence system has confirmed it.
     */
    integrity?: SurfaceIntegrity;
  };

  /** Zone 2: Surface Tools.  Elastic — may be empty. */
  actions: SurfaceAction[];

  /** Zone 3: View Controls. */
  view?: {
    /** Current view mode label (e.g. 'Responsive', '100%', 'Markdown'). */
    mode?: string;
    /** Whether this surface supports splitting into a multi-grid layout. */
    canSplit?: boolean;
    /** Whether this surface can be closed by the user. */
    canClose?: boolean;
  };

  /**
   * Which PaneTera-owned renderer should display this surface's content,
   * and what typed data to pass to it.
   *
   * The renderer type selects a PaneTera component.  The payload is a typed
   * data object that the selected renderer knows how to interpret.
   * External producers never supply React code.
   */
  renderer: {
    type: SurfaceRendererType;
    /** Typed data for the selected renderer.  Shape depends on `type`. */
    payload: unknown;
  };
}
