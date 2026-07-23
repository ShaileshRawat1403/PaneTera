// src/components/rig/rigLoadingModel.ts
//
// The loading boundary for the Rig drawer's connection inventory, kept pure and
// React-free so it can be tested in isolation. Its one job is to never let
// unavailable data pose as an authoritative empty Rig.
//
// The defect this closes: the panel initialised connections to `[]`, so a failed
// or malformed initial load sat next to "Connections (0)" and "No MCP servers
// connected yet." That confuses "we could not read the Rig" with "the Rig is
// genuinely empty." Here, only a 2xx response whose body is a real
// `{ connections: [...] }` array is a load; everything else is an explicit
// failure that the panel must show as such, and an empty array is the single
// authoritative empty state.

import {
  CONNECTION_STATES,
  CONNECTION_HEALTHS,
  RIG_TRANSPORT_KINDS,
  RIG_SOURCE_CLASSES,
  STDIO_ISOLATION_MODES,
  type RigCapability,
  type RigConnection,
  type ProvenanceRecord,
} from '../../rig/types';
import { isProvenanceRecord, projectProvenanceRecord } from './provenanceModel';

const STATE_SET: ReadonlySet<string> = new Set(CONNECTION_STATES);
const HEALTH_SET: ReadonlySet<string> = new Set(CONNECTION_HEALTHS);
const TRANSPORT_SET: ReadonlySet<string> = new Set(RIG_TRANSPORT_KINDS);
const SOURCE_CLASS_SET: ReadonlySet<string> = new Set(RIG_SOURCE_CLASSES);
const ISOLATION_SET: ReadonlySet<string> = new Set(STDIO_ISOLATION_MODES);

/**
 * Whether a value is a canonical ISO-8601 timestamp.
 *
 * `discoveredAt` is written by the server as `new Date().toISOString()`. A lenient
 * `Date.parse` accepts junk like a bare year, so the shape is checked against the
 * canonical form and then confirmed parseable, so `"not-a-date"` is rejected.
 */
function isCanonicalTimestamp(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

/** Validate the transport discriminator and its kind-specific fields. */
function isValidTransport(transport: Record<string, unknown>): boolean {
  if (typeof transport.kind !== 'string' || !TRANSPORT_SET.has(transport.kind)) return false;
  if (transport.kind === 'stdio') {
    if (typeof transport.executablePath !== 'string') return false;
    if (!Array.isArray(transport.argv) || !transport.argv.every((a) => typeof a === 'string')) return false;
    if (typeof transport.cwd !== 'string') return false;
    // Isolation is a security-relevant claim; only the known modes are accepted.
    if (typeof transport.isolationMode !== 'string' || !ISOLATION_SET.has(transport.isolationMode)) return false;
    return true;
  }
  // http
  if (typeof transport.url !== 'string') return false;
  if (typeof transport.localDevelopment !== 'boolean') return false;
  if (transport.authRef !== null && typeof transport.authRef !== 'string') return false;
  return true;
}

/**
 * A structural guard for a single capability.
 *
 * `enabledResources` reads `item.enabled` and expanded cards read
 * `capability.description.text`, `capability.kind`, and `capability.permission`,
 * all without guarding. A `null` or malformed capability in one of the three
 * arrays would crash those paths, so each element and its enums are validated
 * here before the loader claims `RigConnection`.
 */
export function isRigCapability(value: unknown): value is RigCapability {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  if (typeof c.capabilityId !== 'string') return false;
  if (c.kind !== 'tool' && c.kind !== 'resource' && c.kind !== 'prompt') return false;
  if (typeof c.enabled !== 'boolean') return false;
  if (c.permission !== 'denied' && c.permission !== 'proposable' && c.permission !== 'auto-invocable') return false;
  const description = c.description as Record<string, unknown> | undefined;
  return Boolean(description) && typeof description === 'object' && typeof description.text === 'string';
}

/** The minimal fetch surface the loader needs, injectable for tests. */
export type RigFetch = (
  input: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; statusText?: string; json: () => Promise<unknown> }>;

/**
 * The result of a connections load. A failure never carries connections, so a
 * failed or stale load can never be rendered as a current, empty Rig.
 */
export type RigConnectionsResult =
  | { ok: true; connections: RigConnection[] }
  | { ok: false; reason: string };

/**
 * A structural guard for a single connection.
 *
 * The loader claims `RigConnection[]`, and the renderer dereferences
 * `connection.capabilities.tools`, `connection.health.state`, and
 * `connection.transport.kind` without guarding, so a `null`, a primitive, or an
 * object missing those shapes would crash the panel. Validating each element
 * here makes the claimed contract real: one malformed element fails the whole
 * load rather than reaching the renderer.
 */
export function isRigConnection(value: unknown): value is RigConnection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  if (typeof c.connectionId !== 'string' || typeof c.displayName !== 'string') return false;
  if (typeof c.sourceClass !== 'string' || !SOURCE_CLASS_SET.has(c.sourceClass)) return false;
  // The state and health must be exact known enum values. An unrecognised string
  // is a version mismatch or a malformed response and must make the load
  // unreadable, never be quietly accepted and rendered as a known state.
  if (typeof c.state !== 'string' || !STATE_SET.has(c.state)) return false;
  const health = c.health as Record<string, unknown> | undefined;
  if (!health || typeof health !== 'object' || typeof health.state !== 'string' || !HEALTH_SET.has(health.state as string)) return false;
  const transport = c.transport as Record<string, unknown> | undefined;
  if (!transport || typeof transport !== 'object' || !isValidTransport(transport)) return false;
  const caps = c.capabilities as Record<string, unknown> | undefined;
  if (!caps || typeof caps !== 'object') return false;
  // The inventory freshness/completeness fields the card reads must be present
  // and well-typed, so the card never infers freshness from a missing field. A
  // discovery timestamp must be null or a real canonical timestamp.
  if (typeof caps.truncated !== 'boolean') return false;
  if (caps.discoveredAt !== null && !isCanonicalTimestamp(caps.discoveredAt)) return false;
  // Each capability array must exist and every element must be a valid capability,
  // so a `resources: [null]` cannot reach the renderer. Each element's kind must
  // also match the array it sits in: a `prompt` inside `tools` is a malformed
  // payload, and accepting it would let array placement reclassify a capability
  // and invent an unsupported action (e.g. tool invocation on a prompt).
  const ARRAY_KIND = { tools: 'tool', resources: 'resource', prompts: 'prompt' } as const;
  const ids: string[] = [];
  for (const key of ['tools', 'resources', 'prompts'] as const) {
    const list = caps[key];
    if (!Array.isArray(list) || !list.every(isRigCapability)) return false;
    if (!list.every((item) => (item as RigCapability).kind === ARRAY_KIND[key])) return false;
    for (const item of list) ids.push((item as RigCapability).capabilityId);
  }
  // Capability ids must be unique across the three arrays, both because the card
  // keys on them (a duplicate is a React key collision) and because two
  // capabilities claiming one id is a malformed snapshot.
  if (new Set(ids).size !== ids.length) return false;
  return true;
}

/**
 * Load the Rig connection inventory, turning every failure into an explicit,
 * safe reason.
 *
 * A non-2xx keeps its HTTP status and status text, which are not secret and are
 * what a person needs (a 401 reads as sign-in, a 500 as a server fault). A 2xx
 * whose body is not a `{ connections: [...] }` array is a schema failure and is
 * reported as unreadable, never coerced to an empty inventory. A thrown fetch
 * becomes a connection message.
 */
export async function loadRigConnections(fetchImpl: RigFetch, token: string): Promise<RigConnectionsResult> {
  let response: Awaited<ReturnType<RigFetch>>;
  try {
    response = await fetchImpl('/api/rig/connections', { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return { ok: false, reason: 'Could not reach the Rig service. Check your connection and try again.' };
  }
  if (!response.ok) {
    const status = Number.isFinite(response.status) ? response.status : 0;
    const detail = typeof response.statusText === 'string' && response.statusText ? ` ${response.statusText}` : '';
    return { ok: false, reason: `Could not load Rig connections (${status}${detail}).` };
  }
  try {
    const data = await response.json();
    const connections = (data as { connections?: unknown } | null)?.connections;
    if (!Array.isArray(connections) || !connections.every(isRigConnection)) {
      // A non-array, or an array with a malformed element, is unreadable. It is
      // never coerced to a partial or empty inventory that could crash the panel.
      return { ok: false, reason: 'The Rig connections response was not in the expected format.' };
    }
    return { ok: true, connections };
  } catch {
    return { ok: false, reason: 'The Rig connections response could not be read.' };
  }
}

export type RigProvenanceResult =
  | { ok: true; records: ProvenanceRecord[] }
  | { ok: false; reason: string };

/**
 * Load provenance records with the same honesty as connections: a non-2xx or a
 * body that is not a `{ records: [...] }` array is an explicit failure, never a
 * silent empty set. The caller preserves the last valid records and discloses
 * staleness rather than clearing them.
 */
export async function loadRigProvenance(fetchImpl: RigFetch, token: string): Promise<RigProvenanceResult> {
  let response: Awaited<ReturnType<RigFetch>>;
  try {
    response = await fetchImpl('/api/rig/provenance', { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return { ok: false, reason: 'Could not reach the provenance service.' };
  }
  if (!response.ok) {
    const status = Number.isFinite(response.status) ? response.status : 0;
    const detail = typeof response.statusText === 'string' && response.statusText ? ` ${response.statusText}` : '';
    return { ok: false, reason: `Could not load provenance (${status}${detail}).` };
  }
  try {
    const data = await response.json();
    const records = (data as { records?: unknown } | null)?.records;
    // Every element must be a valid provenance record. One malformed element
    // makes the whole load unreadable rather than reaching the renderer.
    if (!Array.isArray(records) || !records.every(isProvenanceRecord)) {
      return { ok: false, reason: 'The provenance response was not in the expected format.' };
    }
    // Project each record onto its canonical fields, so arbitrary input keys
    // (including secret-bearing ones) never reach state, the view, or the raw
    // disclosure. Reject duplicate record ids within one response.
    const projected = records.map(projectProvenanceRecord);
    const ids = projected.map((r) => r.recordId);
    if (new Set(ids).size !== ids.length) {
      return { ok: false, reason: 'The provenance response contained duplicate record ids.' };
    }
    return { ok: true, records: projected };
  } catch {
    return { ok: false, reason: 'The provenance response could not be read.' };
  }
}

/**
 * The mutually exclusive states the connections area can be in. Each is rendered
 * distinctly so unavailable data is never mistaken for an empty Rig.
 *
 *   - loading: no successful load has completed yet and there is no error.
 *   - error:   a failure with no cached inventory to fall back to.
 *   - stale:   a failure after a prior success; the cached inventory is shown,
 *              disclosed as stale, rather than blanked or shown as current.
 *   - empty:   a successful load that returned zero connections. The only
 *              authoritative empty state.
 *   - ready:   a successful load with one or more connections.
 */
export type RigConnectionsView =
  | { status: 'loading' }
  | { status: 'error'; reason: string }
  | { status: 'stale'; reason: string; connections: RigConnection[] }
  | { status: 'empty' }
  | { status: 'ready'; connections: RigConnection[] };

export interface RigConnectionsState {
  /** True once at least one load has succeeded, so a cached inventory exists. */
  loaded: boolean;
  /** The last successfully loaded inventory. Empty until the first success. */
  connections: RigConnection[];
  /** The current load error, or null. Cleared on success. */
  error: string | null;
}

/**
 * Reduce the raw load state into the view. A current error with a prior success
 * is stale (cached inventory preserved and disclosed), while an error with no
 * prior success is a hard failure. Only a successful, empty load is authoritative
 * empty; an error is never allowed to read as zero connections.
 */
export function resolveRigConnectionsView(state: RigConnectionsState): RigConnectionsView {
  if (state.error) {
    if (!state.loaded) return { status: 'error', reason: state.error };
    return { status: 'stale', reason: state.error, connections: state.connections };
  }
  if (!state.loaded) return { status: 'loading' };
  if (state.connections.length === 0) return { status: 'empty' };
  return { status: 'ready', connections: state.connections };
}

/**
 * The one interaction mode for the cards, derived from the loading model rather
 * than from any error text.
 *
 *   - live: the shown cards reflect the current, successfully loaded state, and
 *     no refresh is in flight. Consequential, state-dependent actions are safe.
 *   - refreshing: a same-token load is in flight while cached cards are shown.
 *     Cards stay readable, but a state-dependent mutation must not race the
 *     refresh, so consequential actions pause until it settles.
 *   - stale: a refresh failed and the cards are cached. They reflect a state that
 *     may no longer hold, so consequential actions are withheld until the state
 *     is refreshed; inspection of the cached details remains available.
 *
 * A view with no cards (loading with no cache, hard error, empty) has nothing to
 * act on, so it reports `live` by default and simply renders no cards.
 */
export type RigInteractionMode = 'live' | 'refreshing' | 'stale';

export function resolveRigInteractionMode(view: RigConnectionsView, loading: boolean): RigInteractionMode {
  const hasCards = view.status === 'ready' || view.status === 'stale';
  if (loading && hasCards) return 'refreshing';
  if (view.status === 'stale') return 'stale';
  return 'live';
}
