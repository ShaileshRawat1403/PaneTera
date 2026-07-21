// src/composer/contextTypes.ts
// Context items created by the `+` attachment menu.
//
// These do NOT pass through the intent resolver. Attachments and intent are
// separate inputs that meet only at send time, when the Headroom envelope is
// assembled. Routing attachments through the resolver would create the parallel
// system the composer contract exists to prevent.
//
// See docs/COMPOSER_CONTEXT_CONTRACT.md.

export type ContextKind =
  | 'file'
  | 'folder'
  | 'project'
  | 'image'
  | 'web'
  | 'note'
  | 'evidence'
  | 'mcp-resource'
  | 'live-app';

export type ContextOrigin =
  | 'local-fs'
  | 'workspace-mcp'
  | 'browser-observation'
  | 'external-mcp'
  | 'user-input';

/**
 * Two levels only. `read-full` was removed from the contract: it meant
 * "read-scoped where the scope is large", which is a scope size and not a
 * distinct level of access.
 */
export type AccessLevel = 'reference-only' | 'read-scoped';

export type Freshness = 'current' | 'needs-review' | 'stale' | 'not-measured';

export type Measurement =
  | { unit: 'tokens'; value: number; tokenizerId: string }
  | { unit: 'bytes'; value: number }
  | { unit: 'not-measured' };

export type Materialization =
  | { mode: 'inline'; measurement: Measurement }
  | {
      mode: 'retrieved';
      strategy: string;
      lastRetrieved?: string;
      itemsRetrieved?: number;
      measurement: Measurement;
    }
  | { mode: 'reference' };

export interface ContextSource {
  origin: ContextOrigin;
  locator: string;
  connectionId?: string;
  capturedAt?: string;
  /** Registered workspace this item belongs to, when it is inside one. */
  workspaceId?: string;
  /** Opaque server record proving an explicit native file/folder selection. */
  selectionGrantId?: string;
  selectedAt?: string;
  expiresAt?: string;
  recursive?: boolean;
  observedMtimeMs?: number;
  /** Provenance record for material retrieved through Rig. */
  provenanceRecordId?: string;
}

export interface ContextItem {
  id: string;
  kind: ContextKind;
  label: string;
  source: ContextSource;
  access: AccessLevel;
  /**
   * V1 invariant. Typed as the literal so that widening it is a contract change
   * requiring an ADR, not an assignment.
   */
  authority: 'none';
  materialization: Materialization;
  freshness: Freshness;
  included: boolean;
}

/** A workspace the user may attach from. Registered workspaces only in V1. */
export interface AttachableWorkspace {
  id: string;
  name: string;
  path: string;
}

/**
 * What the `+` menu offers. Options that depend on capabilities which do not
 * exist yet are listed as unavailable rather than hidden, so the menu tells the
 * truth about the product's shape instead of quietly omitting it.
 */
export interface AttachmentOption {
  kind: ContextKind;
  label: string;
  available: boolean;
  unavailableReason?: string;
}

/**
 * Kinds the core API accepts.
 *
 * Enforced by attachContextItem, not only by the menu. A kind absent from this
 * set has no retrieval path, so accepting it would produce a context item that
 * claims a source PaneTera cannot read.
 */
export const SUPPORTED_CONTEXT_KINDS: readonly ContextKind[] = [
  'file',
  'folder',
  'project',
  'note',
  'web',
  'mcp-resource',
];

export function isSupportedContextKind(kind: ContextKind): boolean {
  return SUPPORTED_CONTEXT_KINDS.includes(kind);
}

/**
 * What the host can actually do right now.
 *
 * Every field answers "can selecting this lead to a real interaction". The menu
 * renders an option only when the answer is yes, so it stops being a roadmap of
 * things that do not work.
 */
export interface AttachmentAvailability {
  /** A governed registered-project picker is wired. */
  hasProjectPicker: boolean;
  /** Native operating-system file selection is wired. */
  hasLocalFilePicker: boolean;
  /** Native operating-system folder selection is wired. */
  hasLocalFolderPicker: boolean;
  /** At least one project is registered, so there is something to choose. */
  hasProjects: boolean;
  /** Reference validation for public addresses is wired. */
  hasWebLinks: boolean;
  /** At least one enabled, connected MCP resource is available through Rig. */
  hasMcpResources: boolean;
}

// Deliberately no `hasRigSurface`. No Rig surface exists to send anyone to, so
// a field describing one would advertise architecture the product does not
// have. It returns when there is something to point at.

/**
 * Build the `+` menu.
 *
 * Only actionable options are returned. The previous version listed image,
 * evidence, MCP resource and live application as permanently disabled rows
 * explaining themselves in implementation language ("Headroom envelope stage",
 * "Rig discovery"). A menu is not the place to document a roadmap: every row a
 * person cannot use is a row they have to read and dismiss.
 *
 * A kind returns here only once its full source and retrieval path exist.
 */
export function attachmentOptions(availability: AttachmentAvailability): AttachmentOption[] {
  const options: AttachmentOption[] = [
    // Always available: the content comes from the person, not from a source
    // PaneTera has to reach.
    { kind: 'note', label: 'Paste text or note', available: true },
  ];

  if (availability.hasProjectPicker && availability.hasProjects) {
    options.push({ kind: 'project', label: 'Choose project', available: true });
  }
  if (availability.hasLocalFilePicker) {
    options.push({ kind: 'file', label: 'Choose local file…', available: true });
  }
  if (availability.hasLocalFolderPicker) {
    options.push({ kind: 'folder', label: 'Choose local folder…', available: true });
  }

  if (availability.hasWebLinks) {
    options.push({ kind: 'web', label: 'Add web link', available: true });
  }
  if (availability.hasMcpResources) {
    options.push({ kind: 'mcp-resource', label: 'Choose MCP resource…', available: true });
  }

  return options;
}

/**
 * Explanation shown when no project is registered.
 *
 * One concise sentence, not four disabled rows. Returns null when projects
 * exist, so the empty explanation appears only when it is true.
 */
export function noProjectsExplanation(availability: AttachmentAvailability): string | null {
  if (availability.hasProjects) return null;
  return 'No projects are registered yet, so there is nothing to attach from.';
}
