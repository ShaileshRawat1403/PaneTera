// src/composer/contextTray.ts
// In-memory context tray. Pure functions over an immutable item list.
//
// Boundaries for the composer-foundation slice:
//   - no persistence;
//   - no filesystem read;
//   - no directory enumeration;
//   - registered workspace paths only;
//   - folders and projects are references and materialise nothing.

import type {
  AccessLevel,
  ContextSource,
  AttachableWorkspace,
  ContextItem,
  ContextKind,
  Freshness,
  Materialization,
  Measurement,
} from './contextTypes';
import { isSupportedContextKind } from './contextTypes';
import { resolveWebLink } from './webLink';

export type ContextTray = readonly ContextItem[];

export const EMPTY_TRAY: ContextTray = [];

export interface AttachRequest {
  kind: ContextKind;
  label: string;
  locator: string;
  workspace?: AttachableWorkspace;
  /** Inline text for a note. Never read from disk. */
  noteBody?: string;
}

/**
 * Kinds whose locator is a public web address rather than a filesystem path.
 *
 * A web item is a name PaneTera was given, not a page it fetched. Keeping it
 * out of the workspace-confinement branch is deliberate: confinement is about
 * filesystem reach, and this kind has none.
 */
const WEB_KINDS: readonly ContextKind[] = ['web'];

export type AttachResult =
  | { ok: true; tray: ContextTray; item: ContextItem; material?: string }
  | { ok: false; reason: AttachRejection };

/**
 * Transient material for items whose content the user supplied directly.
 *
 * Kept out of ContextItem on purpose. A ContextItem is a reference plus
 * metadata and is safe to log or persist; material is the actual content and is
 * not. Keying by item id means removing a chip drops its material with it.
 */
export type MaterialStore = Readonly<Record<string, string>>;

export const EMPTY_MATERIAL: MaterialStore = {};

export function putMaterial(store: MaterialStore, id: string, material: string): MaterialStore {
  return { ...store, [id]: material };
}

export function dropMaterial(store: MaterialStore, id: string): MaterialStore {
  if (!(id in store)) return store;
  const next = { ...store };
  delete next[id];
  return next;
}

/** Material for the items being sent, in tray order. */
export function materialFor(tray: ContextTray, store: MaterialStore): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of tray) {
    const material = store[item.id];
    if (typeof material === 'string') out[item.id] = material;
  }
  return out;
}

export type AttachRejection =
  | 'unsupported-kind'
  | 'outside-registered-workspace'
  | 'duplicate'
  | 'empty-locator'
  | 'missing-material'
  | 'invalid-web-address';

const KINDS_REQUIRING_WORKSPACE: readonly ContextKind[] = ['file', 'folder', 'project'];

/**
 * Kinds that materialise nothing at attach time.
 *
 * Folders and projects are references by definition. Files are references in
 * this slice too: inline materialisation needs a policy-gated read that does
 * not exist yet, and inventing a measurement for content we have not read would
 * be exactly the fabricated precision the workstation contract forbids.
 */
function materializationFor(kind: ContextKind, noteBody?: string): Materialization {
  if (kind === 'note' && typeof noteBody === 'string') {
    // A note is the one kind whose content the user supplied directly, so its
    // byte length is a measurement rather than an estimate.
    return {
      mode: 'inline',
      measurement: { unit: 'bytes', value: byteLength(noteBody) },
    };
  }
  return { mode: 'reference' };
}

function byteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length;
  return Buffer.byteLength(value, 'utf8');
}

function originFor(kind: ContextKind): ContextSource['origin'] {
  // A web link came from the person typing it. Calling it a browser observation
  // would claim PaneTera had looked at the page, which it has not.
  if (kind === 'note' || kind === 'web') return 'user-input';
  return 'workspace-mcp';
}

function accessFor(kind: ContextKind): AccessLevel {
  // A reference-only item carries a name and no read authority. Files and
  // folders inside a registered workspace carry read-scoped access, which the
  // host policy engine still gates at retrieval time.
  if (kind === 'note') return 'read-scoped';
  // A web link is a name only. PaneTera holds no read authority over the page.
  if (kind === 'web') return 'reference-only';
  return KINDS_REQUIRING_WORKSPACE.includes(kind) ? 'read-scoped' : 'reference-only';
}

function freshnessFor(kind: ContextKind): Freshness {
  // Nothing here has been revalidated, and most kinds have no revalidation
  // mechanism in this slice. 'not-measured' is the honest state; 'current'
  // would be a claim we cannot support.
  if (kind === 'note') return 'current';
  return 'not-measured';
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `ctx-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Reset id sequencing. Test support only. */
export function resetContextIds(): void {
  counter = 0;
}

export function attachContextItem(tray: ContextTray, request: AttachRequest): AttachResult {
  // Enforced here rather than only in the menu. A kind with no retrieval path
  // would otherwise produce an item claiming a source nothing can read, and a
  // direct caller could bypass the UI entirely.
  if (!isSupportedContextKind(request.kind)) {
    return { ok: false, reason: 'unsupported-kind' };
  }

  const locator = request.locator.trim();
  if (!locator) return { ok: false, reason: 'empty-locator' };

  if (request.kind === 'note' && typeof request.noteBody !== 'string') {
    return { ok: false, reason: 'missing-material' };
  }

  // Canonical validation, not a scheme check.
  //
  // This previously tested only `^https?://`, which accepted every private and
  // loopback address and every credential-bearing URL that reached the core
  // directly: `http://127.0.0.1/` went straight into the tray. The entry
  // surface validated properly, so the hole was invisible from the UI and
  // invisible to tests that only tried `example.com` and `file:///`.
  //
  // The core now runs the same validator the entry surface does, and stores the
  // normalised result, so a locator in the tray is always canonical.
  let normalisedWebUrl: string | null = null;
  if (WEB_KINDS.includes(request.kind)) {
    const resolved = resolveWebLink(locator);
    if (!resolved.ok) return { ok: false, reason: 'invalid-web-address' };
    normalisedWebUrl = resolved.url;
  }

  if (KINDS_REQUIRING_WORKSPACE.includes(request.kind)) {
    if (!request.workspace) return { ok: false, reason: 'outside-registered-workspace' };
    if (!isWithinWorkspace(locator, request.workspace.path)) {
      return { ok: false, reason: 'outside-registered-workspace' };
    }
  }

  // Compared against the normalised form, so `example.com` and
  // `https://example.com/` are recognised as the same address rather than
  // producing two chips for one page.
  const storedLocator = normalisedWebUrl ?? locator;

  if (tray.some((item) => item.source.locator === storedLocator && item.kind === request.kind)) {
    return { ok: false, reason: 'duplicate' };
  }

  const item: ContextItem = {
    id: nextId(),
    kind: request.kind,
    label: request.label.trim() || storedLocator,
    source: {
      origin: originFor(request.kind),
      locator: storedLocator,
      workspaceId: request.workspace?.id,
    },
    access: accessFor(request.kind),
    authority: 'none',
    materialization: materializationFor(request.kind, request.noteBody),
    freshness: freshnessFor(request.kind),
    included: true,
  };

  // Material travels beside the item, never inside it. The caller stores it and
  // submits it with the item; the tray itself stays free of content.
  const material = request.kind === 'note' ? request.noteBody : undefined;

  return { ok: true, tray: [...tray, item], item, material };
}

/**
 * Path containment check.
 *
 * Deliberately strict: a prefix match alone would let `/repo-secrets` pass as
 * inside `/repo`. Containment requires a separator boundary.
 */
export function isWithinWorkspace(locator: string, workspacePath: string): boolean {
  const normalise = (value: string) => value.replace(/\/+$/, '');
  const target = normalise(locator);
  const root = normalise(workspacePath);
  if (!root) return false;
  if (target === root) return true;
  if (target.includes('..')) return false;
  return target.startsWith(`${root}/`);
}

/** Remove an item. Source data is never touched. */
export function removeContextItem(tray: ContextTray, id: string): ContextTray {
  return tray.filter((item) => item.id !== id);
}

/** Toggle whether an item is sent with the next message. */
export function setContextIncluded(tray: ContextTray, id: string, included: boolean): ContextTray {
  return tray.map((item) => (item.id === id ? { ...item, included } : item));
}

/** `/clear-context`: drop everything, delete nothing. */
export function clearContext(): ContextTray {
  return EMPTY_TRAY;
}

export function includedItems(tray: ContextTray): ContextItem[] {
  return tray.filter((item) => item.included);
}

/**
 * Aggregate Headroom figure for the tray.
 *
 * Returns bytes only when every included item is byte-measured, and
 * not-measured otherwise. It never sums across units and never converts bytes
 * into tokens, because a ratio-derived token count is an estimate presented as
 * a count.
 */
export function trayMeasurement(tray: ContextTray): Measurement {
  const included = includedItems(tray);
  if (included.length === 0) return { unit: 'bytes', value: 0 };

  let bytes = 0;
  for (const item of included) {
    const materialization = item.materialization;
    if (materialization.mode === 'reference') continue;
    const measurement = materialization.measurement;
    if (measurement.unit === 'bytes') {
      bytes += measurement.value;
      continue;
    }
    return { unit: 'not-measured' };
  }
  return { unit: 'bytes', value: bytes };
}

export type { Measurement } from './contextTypes';
