// server/auditRecord.ts
//
// A versioned, typed, actor-attributed audit record, added alongside the loose
// legacy `{ timestamp, event, details }` line without breaking it.
//
// The point of this slice is honesty about who acted. The old record had no
// actor at all; a scattering of call sites put an ad hoc `actor: 'panetera-ui'`
// or `actor: 'extension:<id>'` string inside `details`, with no shared meaning
// and no guarantee it was server-derived. This module replaces that with a
// typed actor whose kind is constrained and whose identity can only be built
// from server-authoritative state.
//
// Two rules are load-bearing and are the reason this exists:
//
//   1. `human` is reachable only from an opaque principal minted after portal
//      authentication and server-side identity configuration. `agent` remains
//      unreachable. A bearer token by itself still never becomes a person.
//
//   2. Actor identity is server-derived. The emitter never reads an actor from a
//      request body, and the factories take only values the server already
//      holds (an authenticated extension session, a governed connection). A
//      client cannot place an identity into a record.

import crypto from 'crypto';
import { appendAuditLine } from './audit';
import { isSensitiveObjectKey, isSensitiveParamName } from './redactionPolicy';
import { isAuthoritativeOperatorPrincipal, type OperatorPrincipal } from './operatorPrincipal';

/** Bumped from the implicit legacy version (1). */
export const AUDIT_SCHEMA_VERSION = 2 as const;

/**
 * Who acted.
 *
 * `unknown` is not a failure state, it is the honest label for an action whose
 * principal the server cannot vouch for, including every legacy line. It must
 * never be quietly upgraded to `system` or `human`.
 */
export type ActorKind =
  | 'system'
  | 'browser-extension'
  | 'mcp-client'
  | 'connector'
  | 'human'
  | 'agent'
  | 'unknown';

export interface AuditActor {
  kind: ActorKind;
  /** A server-derived, non-secret identifier, or null when there is none. */
  id: string | null;
  /** A short, non-secret, human-readable label. */
  label?: string;
}

export type PolicyDecision = 'allowed' | 'denied' | 'approval-required' | 'not-applicable';
export type AuditOutcome = 'success' | 'error' | 'denied' | 'pending' | 'unknown';

/**
 * Identifiers that tie a record to the things it relates to. All optional; only
 * what a given event genuinely has is set. Every value is scrubbed before it is
 * written, so a credential smuggled into one of these fields does not survive.
 */
export interface AuditCorrelation {
  runId?: string;
  proposalId?: string;
  approvalId?: string;
  grantId?: string;
  connectionId?: string;
  parentRecordId?: string;
  captureId?: string;
  extractionId?: string;
}

export interface TypedAuditRecord {
  recordId: string;
  schemaVersion: number;
  timestamp: string;
  event: string;
  actor: AuditActor;
  outcome: AuditOutcome;
  policyDecision: PolicyDecision;
  correlation: AuditCorrelation;
  /** Bounded, scrubbed domain detail. Kept at top level for read compatibility. */
  details: Record<string, unknown>;
  prevHash?: string;
}

let lastAuditHash = '0';

const MAX_STRING = 2_048;
const MAX_DETAILS_BYTES = 8_192;
const MAX_DEPTH = 8;
const MAX_KEYS = 64;
const MAX_ARRAY = 200;

/** Literal credential shapes to redact wherever they appear as a value. */
const BEARER_LITERAL = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const JWT_LITERAL = /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g;

/**
 * Redact secrets carried inside a URL: embedded credentials, sensitive query
 * values, and the entire fragment.
 *
 * A URL is the one string where secrets hide in plain sight under a benign key
 * like `targetUrl`, so name-based scrubbing never sees them. The whole fragment
 * is dropped rather than filtered, because OAuth implicit flows return tokens in
 * it (`#access_token=…`) and a fragment is rarely load-bearing in an audit line.
 */
function redactUrlSecrets(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return value;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return value;

  if (parsed.username || parsed.password) {
    parsed.username = '';
    parsed.password = '';
  }
  for (const key of [...parsed.searchParams.keys()]) {
    if (isSensitiveParamName(key)) parsed.searchParams.set(key, 'redacted');
  }
  if (parsed.hash) parsed.hash = '#[redacted]';
  return parsed.toString();
}

function redactLiteralSecrets(value: string): string {
  return redactUrlSecrets(value).replace(BEARER_LITERAL, '[redacted]').replace(JWT_LITERAL, '[redacted]');
}

/**
 * Deeply copy a value, redacting secrets and bounding size.
 *
 * A value under a sensitive key name is replaced wholesale. Every surviving
 * string is scanned for literal bearer or JWT shapes and truncated. This runs on
 * actor fields, correlation, and details, so no path into a record skips it.
 */
export function scrubSecrets(value: unknown, keyIsSensitive = false): unknown {
  return scrubValue(value, keyIsSensitive, 0, new WeakSet());
}

/**
 * The recursive worker, bounded in every direction that can grow without limit.
 *
 * A cyclic or pathologically deep details object used to overflow the stack and
 * crash the very request being recorded, which is the worst possible failure
 * mode for an audit system. Depth, cycles, key count, and array length are all
 * capped here so that malformed detail degrades to a placeholder instead of
 * taking down the operation.
 */
function scrubValue(value: unknown, keyIsSensitive: boolean, depth: number, seen: WeakSet<object>): unknown {
  // A sensitive key redacts its entire value before its type is even
  // considered. Checking this only inside the string branch let a numeric,
  // boolean, or object secret through: `{ password: 1234 }` survived.
  if (keyIsSensitive) return '[redacted]';

  if (typeof value === 'string') {
    return redactLiteralSecrets(value).slice(0, MAX_STRING);
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value;
  }
  if (value && typeof value === 'object') {
    if (seen.has(value as object)) return '[cyclic]';
    if (depth >= MAX_DEPTH) return '[max-depth]';
    seen.add(value as object);
    try {
      if (Array.isArray(value)) {
        return value.slice(0, MAX_ARRAY).map((item) => scrubValue(item, keyIsSensitive, depth + 1, seen));
      }
      const out: Record<string, unknown> = {};
      let count = 0;
      for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
        if (count >= MAX_KEYS) {
          out['…'] = '[truncated]';
          break;
        }
        count += 1;
        out[key] = scrubValue(inner, keyIsSensitive || isSensitiveObjectKey(key), depth + 1, seen);
      }
      return out;
    } finally {
      // Release the node so a repeated-but-acyclic structure is not misread as a
      // cycle across sibling branches.
      seen.delete(value as object);
    }
  }
  return undefined;
}

/** A stable, non-reversible fingerprint of a server-side identity. */
export function fingerprint(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

/**
 * Bound a details object so a record cannot grow without limit or throw.
 *
 * Everything here is wrapped: scrubbing is cycle- and depth-safe, and the
 * serialisation used only to measure size cannot throw because the value is
 * already acyclic by that point. The outer catch is a last resort, so a detail
 * this function cannot handle becomes a placeholder rather than an exception
 * that reaches the caller.
 */
function boundDetails(details: unknown): Record<string, unknown> {
  try {
    const scrubbed = scrubSecrets(details);
    const object =
      scrubbed && typeof scrubbed === 'object' && !Array.isArray(scrubbed)
        ? (scrubbed as Record<string, unknown>)
        : { value: scrubbed };
    const serialised = JSON.stringify(object);
    if (serialised.length <= MAX_DETAILS_BYTES) return object;
    return { truncated: true, note: 'Audit detail exceeded the display bound and was dropped.' };
  } catch {
    return { unserialisable: true, note: 'Audit detail could not be recorded safely.' };
  }
}

// ── Actor factories. The only sanctioned way to build an actor. ──────────────
//
// There is deliberately no `agentActor`. A human actor requires an opaque
// operator principal; the absence of a factory alone would not be an enforcement
// boundary because callers can still hand-write `{ kind: 'human', … }`.
//
// The boundary is a brand, held in a module-private WeakSet rather than on the
// actor object. An on-object symbol was the first attempt and was forgeable:
// `Object.getOwnPropertySymbols` returns non-enumerable symbols, so an outside
// module could read the brand off one factory result and copy it onto a
// fabricated actor. A WeakSet is not reachable from outside this file and keys
// on object identity, so membership cannot be copied. Factory results are frozen
// as well, so a branded actor cannot be mutated after the fact.
//
// What the brand proves, stated honestly: the actor object was constructed by a
// factory in this module, so it did not arrive from a client. It does not prove
// that the session or connection handed to the factory was itself authoritative;
// the factories still accept plain objects, so a caller inside the server
// process could construct one. Binding factories to opaque principal
// capabilities minted by the session and registry modules is the stronger
// guarantee and is deferred. Meanwhile the real enforcement is at the routes,
// which derive actors only from the authenticated middleware session and the
// governed registry, never from a request body. That is what the route guards
// below assert.

const BRANDED_ACTORS = new WeakSet<AuditActor>();

function brandActor(actor: AuditActor): AuditActor {
  const frozen = Object.freeze(actor);
  BRANDED_ACTORS.add(frozen);
  return frozen;
}

function isBrandedActor(actor: AuditActor): boolean {
  return typeof actor === 'object' && actor !== null && BRANDED_ACTORS.has(actor);
}

/** PaneTera itself acting, with no external principal. */
export function systemActor(label = 'panetera-server'): AuditActor {
  return brandActor({ kind: 'system', id: null, label });
}

/**
 * A paired browser extension, identified by a fingerprint of its durable
 * installation rather than its session, so the ephemeral bearer never appears.
 */
export function browserExtensionActor(session: {
  installationId: string;
  runtimeId?: string;
}): AuditActor {
  return brandActor({
    kind: 'browser-extension',
    id: fingerprint(session.installationId),
    label: 'browser extension',
  });
}

/** A governed MCP connection, identified by its non-secret connection id. */
export function connectorActor(connection: { connectionId: string; displayName?: string }): AuditActor {
  return brandActor({
    kind: 'connector',
    id: connection.connectionId.slice(0, MAX_STRING),
    label: connection.displayName ? connection.displayName.slice(0, 120) : 'connector',
  });
}

/**
 * A local MCP client, identified by its authenticated client id.
 *
 * Deliberately distinct from `browser-extension`. The MCP browser façade reads
 * stored evidence under an `McpClientPrincipal` from its own credential
 * registry, and that principal is not bound to any paired browser installation;
 * the façade's own auth even rejects the extension's origin. Attributing these
 * calls to `browser-extension` because they touch browser evidence would be the
 * false attribution this work exists to prevent. This is a different principal,
 * so it gets a different actor.
 */
export function mcpClientActor(principal: { clientId: string; subjectId?: string }): AuditActor {
  return brandActor({
    kind: 'mcp-client',
    id: principal.clientId.slice(0, MAX_STRING),
    label: 'mcp client',
  });
}

/** A configured human operator authenticated at the portal request boundary. */
export function humanActor(principal: OperatorPrincipal): AuditActor {
  if (!isAuthoritativeOperatorPrincipal(principal)) {
    return unknownActor('unauthenticated-principal');
  }
  return brandActor({
    kind: 'human',
    id: fingerprint(principal.subjectId),
    label: principal.label.slice(0, 120),
  });
}

/** The honest actor for a line whose principal is not known. */
export function unknownActor(label = 'legacy-unattributed'): AuditActor {
  return brandActor({ kind: 'unknown', id: null, label });
}

const KNOWN_KINDS: ReadonlySet<ActorKind> = new Set<ActorKind>([
  'system',
  'browser-extension',
  'mcp-client',
  'connector',
  'human',
  'agent',
  'unknown',
]);

/**
 * Force any actor into a known, scrubbed shape. An unrecognised kind becomes
 * unknown. Used at read time, where the brand is gone and the stored kind is
 * trusted because it already passed emit-time authentication.
 */
function sanitiseActor(actor: AuditActor): AuditActor {
  const kind = KNOWN_KINDS.has(actor.kind) ? actor.kind : 'unknown';
  const id = typeof actor.id === 'string' ? (scrubSecrets(actor.id) as string) : null;
  const label = typeof actor.label === 'string' ? (scrubSecrets(actor.label) as string) : undefined;
  return { kind, id, label };
}

/**
 * Authenticate an actor at emit time.
 *
 * Unbranded means the actor was not built by a factory in this module, so it is
 * untrusted and downgraded to unknown. `agent` is rejected outright because no
 * authoritative agent principal exists. A human reaches this point only through
 * the branded `humanActor` factory after capability validation.
 */
function authenticateEmittedActor(actor: AuditActor): AuditActor {
  if (!actor || typeof actor !== 'object' || !isBrandedActor(actor)) {
    return sanitiseActor(unknownActor('unbranded-actor'));
  }
  if (actor.kind === 'agent') {
    return sanitiseActor(unknownActor('unauthenticated-principal'));
  }
  return sanitiseActor(actor);
}

function scrubCorrelation(correlation: AuditCorrelation): AuditCorrelation {
  return scrubSecrets(correlation) as AuditCorrelation;
}

export interface TypedAuditInput {
  event: string;
  actor: AuditActor;
  outcome: AuditOutcome;
  policyDecision: PolicyDecision;
  correlation?: AuditCorrelation;
  details?: Record<string, unknown>;
}

/**
 * Write a typed audit record.
 *
 * The record id and timestamp are generated here, never accepted from a caller.
 * The actor is sanitised, and every string field passes through the secret
 * scrubber, so a token cannot ride into a record through actor, correlation, or
 * details.
 */
export function logTypedAudit(input: TypedAuditInput): TypedAuditRecord {
  // Building the record must never throw into the operation being audited. If
  // any part of it fails, a minimal fallback is written instead and the caller
  // is unaffected.
  let record: TypedAuditRecord;
  try {
    record = {
      recordId: `audit-${crypto.randomUUID()}`,
      schemaVersion: AUDIT_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      event: String(input.event).slice(0, 200),
      actor: authenticateEmittedActor(input.actor),
      outcome: input.outcome,
      policyDecision: input.policyDecision,
      correlation: scrubCorrelation(input.correlation ?? {}),
      details: boundDetails(input.details ?? {}),
      prevHash: lastAuditHash,
    };
    lastAuditHash = crypto.createHash('sha256').update(JSON.stringify({ recordId: record.recordId, prevHash: lastAuditHash })).digest('hex');
  } catch {
    record = {
      recordId: `audit-${crypto.randomUUID()}`,
      schemaVersion: AUDIT_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      event: 'audit.record.malformed',
      actor: sanitiseActor(unknownActor('emit-failure')),
      outcome: 'error',
      policyDecision: 'not-applicable',
      correlation: {},
      details: { note: 'Audit record could not be built and was replaced.' },
      prevHash: lastAuditHash,
    };
    lastAuditHash = crypto.createHash('sha256').update(JSON.stringify({ recordId: record.recordId, prevHash: lastAuditHash })).digest('hex');
  }
  appendAuditLine(record);
  return record;
}

/**
 * Interpret any audit line, legacy or typed, as a typed record.
 *
 * A line already carrying a schema version and an actor is trusted as typed and
 * only sanitised. Anything else is legacy: it is wrapped as
 * `unknown / legacy-unattributed`, never guessed into `system` or `human`, and
 * its original timestamp, event, and details are preserved so the audit trail
 * stays readable.
 */
export function normalizeAuditRecord(raw: unknown): TypedAuditRecord {
  const line = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const isTyped =
    typeof line.schemaVersion === 'number' &&
    line.actor !== null &&
    typeof line.actor === 'object';

  if (isTyped) {
    const actor = line.actor as AuditActor;
    return {
      recordId: typeof line.recordId === 'string' ? line.recordId : `audit-${crypto.randomUUID()}`,
      schemaVersion: line.schemaVersion as number,
      timestamp: typeof line.timestamp === 'string' ? line.timestamp : new Date(0).toISOString(),
      event: typeof line.event === 'string' ? line.event : 'audit_event',
      actor: sanitiseActor(actor),
      outcome: (line.outcome as AuditOutcome) ?? 'unknown',
      policyDecision: (line.policyDecision as PolicyDecision) ?? 'not-applicable',
      correlation: scrubCorrelation((line.correlation as AuditCorrelation) ?? {}),
      details: boundDetails((line.details as Record<string, unknown>) ?? {}),
    };
  }

  // Legacy line, or an unparsed `{ raw: '…' }` wrapper from the read API.
  const details =
    line.details && typeof line.details === 'object'
      ? (line.details as Record<string, unknown>)
      : (line as Record<string, unknown>);

  return {
    recordId: `legacy-${fingerprint(JSON.stringify(line))}`,
    schemaVersion: 1,
    timestamp: typeof line.timestamp === 'string' ? line.timestamp : new Date(0).toISOString(),
    event: typeof line.event === 'string' ? line.event : 'audit_event',
    actor: unknownActor('legacy-unattributed'),
    outcome: 'unknown',
    policyDecision: 'not-applicable',
    correlation: {},
    details: boundDetails(details),
  };
}
