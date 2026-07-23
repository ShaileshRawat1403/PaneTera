// src/components/workbench/auditRecordViewModel.ts
//
// The presentation model for the typed audit trail. It is the single place that
// turns a server-normalized TypedAuditRecord into something a person can read at
// a glance, and it is deliberately pure and free of React so it can be tested in
// isolation and reused by the panel without duplicating the classification the
// server already did.
//
// The load-bearing rule, inherited from the backend, is that this model never
// invents attribution. It reads `actor.kind`, `outcome`, and `policyDecision`
// off the typed record and nothing else. It does not look at the event name, the
// owner strings inside details, or any legacy field to decide who acted or what
// a policy said. An action the server could not attribute stays visibly unknown,
// and a legacy line stays a legacy line. Promoting either into a human or a
// system actor here would quietly undo the honesty the audit model exists for.

/** A tone for a chip, mapped to theme tokens by the component, not to colours here. */
export type AuditTone = 'success' | 'danger' | 'attention' | 'accent' | 'neutral' | 'muted';

/** The actor kinds the typed record can carry. `agent` is unreachable but handled. */
export type AuditActorKind =
  | 'human'
  | 'system'
  | 'browser-extension'
  | 'mcp-client'
  | 'connector'
  | 'agent'
  | 'unknown';

export type AuditOutcome = 'success' | 'error' | 'denied' | 'pending' | 'unknown';
export type AuditPolicyDecision = 'allowed' | 'denied' | 'approval-required' | 'not-applicable';

/**
 * The wire shape as delivered by the normalized read endpoint. Every field is
 * optional here on purpose: a malformed or partial legacy line must degrade to a
 * readable row, never throw while rendering the audit surface.
 */
export interface RawAuditRecord {
  recordId?: unknown;
  schemaVersion?: unknown;
  timestamp?: unknown;
  event?: unknown;
  actor?: { kind?: unknown; id?: unknown; label?: unknown } | null;
  outcome?: unknown;
  policyDecision?: unknown;
  correlation?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
}

export interface AuditActorView {
  kind: AuditActorKind;
  /** The distinct display name for the kind, e.g. "Browser Operator". */
  kindLabel: string;
  /**
   * The non-secret identity to show, or null when there is none. For a human
   * this is the configured label plus the fingerprinted id the server sent; the
   * raw operator id is never on the wire, so it can never appear here.
   */
  identity: string | null;
  tone: AuditTone;
  /** True only for a kind the server could actually attribute. Unknown is false. */
  authoritative: boolean;
}

export interface AuditChip {
  label: string;
  tone: AuditTone;
}

export interface AuditCorrelationView {
  /** The identifier type, e.g. "proposal", "approval", "provenance". */
  type: string;
  label: string;
  value: string;
}

export interface AuditRecordView {
  recordId: string;
  timestamp: string;
  event: string;
  actor: AuditActorView;
  /** The outcome of the attempt. Rendered separately from policy, never merged. */
  outcome: AuditChip;
  /** The policy decision. Rendered separately from outcome, never merged. */
  policy: AuditChip;
  correlations: AuditCorrelationView[];
  /**
   * The project (workspace) an event belongs to, read from the scrubbed detail.
   * This is a domain grouping, not attribution: it says which project the action
   * touched, never who acted.
   */
  project: string | null;
  /** True for a pre-typed line the server wrapped as unattributed. */
  isLegacy: boolean;
  /** The already-scrubbed detail object. Displayed as-is; never reconstructed. */
  details: Record<string, unknown>;
}

const ACTOR_KINDS: ReadonlySet<AuditActorKind> = new Set<AuditActorKind>([
  'human',
  'system',
  'browser-extension',
  'mcp-client',
  'connector',
  'agent',
  'unknown',
]);

const ACTOR_KIND_LABEL: Record<AuditActorKind, string> = {
  human: 'Human operator',
  system: 'PaneTera system',
  'browser-extension': 'Browser Operator',
  'mcp-client': 'MCP client',
  connector: 'Connector',
  // The backend cannot authenticate an agent principal, so a stored `agent` kind
  // is a claim the server never verified. It is disclosed as exactly that, in
  // words, rather than shown as a clean "Agent" that implies a real principal.
  agent: 'Unverified agent claim',
  unknown: 'Unknown / unattributed',
};

const ACTOR_TONE: Record<AuditActorKind, AuditTone> = {
  human: 'accent',
  system: 'neutral',
  'browser-extension': 'attention',
  'mcp-client': 'accent',
  connector: 'attention',
  // Danger, not muted: an unverifiable actor claim is a caution, not a quiet note.
  agent: 'danger',
  unknown: 'muted',
};

/**
 * The kinds that represent a principal the server could vouch for. `unknown` and
 * `agent` are excluded: unknown is honest non-attribution, and no authoritative
 * agent principal exists.
 */
const AUTHORITATIVE_KINDS: ReadonlySet<AuditActorKind> = new Set<AuditActorKind>([
  'human',
  'system',
  'browser-extension',
  'mcp-client',
  'connector',
]);

const OUTCOME_TONE: Record<AuditOutcome, AuditTone> = {
  // Success is the one place green is earned: a completed, allowed action.
  success: 'success',
  error: 'danger',
  denied: 'danger',
  pending: 'attention',
  unknown: 'muted',
};

const OUTCOME_LABEL: Record<AuditOutcome, string> = {
  success: 'Succeeded',
  error: 'Failed',
  denied: 'Denied',
  pending: 'Pending',
  unknown: 'Unknown',
};

const POLICY_TONE: Record<AuditPolicyDecision, AuditTone> = {
  // Allowed is routine and stays neutral. Colouring every allowed row green would
  // make the trail a wall of green, which is the anti-pattern the theme forbids.
  allowed: 'neutral',
  denied: 'danger',
  'approval-required': 'attention',
  'not-applicable': 'muted',
};

const POLICY_LABEL: Record<AuditPolicyDecision, string> = {
  allowed: 'Allowed',
  denied: 'Denied',
  'approval-required': 'Approval required',
  'not-applicable': 'Not applicable',
};

/** The correlation keys we surface, in display order, with their human type. */
const CORRELATION_FIELDS: ReadonlyArray<{ key: string; type: string; label: string }> = [
  { key: 'runId', type: 'run', label: 'Run' },
  { key: 'proposalId', type: 'proposal', label: 'Proposal' },
  { key: 'approvalId', type: 'approval', label: 'Approval' },
  { key: 'grantId', type: 'grant', label: 'Grant' },
  { key: 'connectionId', type: 'connection', label: 'Connection' },
  { key: 'parentRecordId', type: 'provenance', label: 'Provenance' },
  { key: 'captureId', type: 'capture', label: 'Capture' },
  { key: 'extractionId', type: 'extraction', label: 'Extraction' },
];

/**
 * Enum lists the panel uses to populate its bounded filter controls.
 *
 * `agent` is deliberately excluded: offering it as a normal filter would imply
 * agent is an ordinary, authenticatable actor. It is not, so it gets no filter
 * until an authoritative agent identity exists. Records that still carry the
 * claim remain visible under the actor column, disclosed as unverified.
 */
export const AUDIT_ACTOR_KIND_OPTIONS: ReadonlyArray<{ value: AuditActorKind; label: string }> =
  (Object.keys(ACTOR_KIND_LABEL) as AuditActorKind[])
    .filter((kind) => kind !== 'agent')
    .map((kind) => ({ value: kind, label: ACTOR_KIND_LABEL[kind] }));

export const AUDIT_OUTCOME_OPTIONS: ReadonlyArray<{ value: AuditOutcome; label: string }> =
  (Object.keys(OUTCOME_LABEL) as AuditOutcome[]).map((value) => ({ value, label: OUTCOME_LABEL[value] }));

export const AUDIT_POLICY_OPTIONS: ReadonlyArray<{ value: AuditPolicyDecision; label: string }> =
  (Object.keys(POLICY_LABEL) as AuditPolicyDecision[]).map((value) => ({ value, label: POLICY_LABEL[value] }));

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function coerceActorKind(value: unknown): AuditActorKind {
  return typeof value === 'string' && ACTOR_KINDS.has(value as AuditActorKind)
    ? (value as AuditActorKind)
    : 'unknown';
}

function coerceOutcome(value: unknown): AuditOutcome {
  return value === 'success' || value === 'error' || value === 'denied' || value === 'pending'
    ? value
    : 'unknown';
}

function coercePolicy(value: unknown): AuditPolicyDecision {
  return value === 'allowed' || value === 'denied' || value === 'approval-required'
    ? value
    : 'not-applicable';
}

/**
 * Build the actor view strictly from the typed actor.
 *
 * The identity string is assembled only from `actor.label` and `actor.id`, both
 * server-derived and non-secret. It never reads the event, details, or any owner
 * field, so an owner string cannot become an identity and a legacy line cannot
 * be dressed up as a person.
 */
function toActorView(actor: RawAuditRecord['actor'], isLegacy: boolean): AuditActorView {
  const kind = coerceActorKind(actor?.kind);
  const label = asString(actor?.label);
  const id = asString(actor?.id);

  let identity: string | null;
  if (isLegacy || kind === 'unknown') {
    // Never a principal. A legacy line reads as legacy; a typed-but-unknown line
    // reads as explicitly unattributed, carrying its reason label if present.
    identity = isLegacy ? 'Unattributed legacy record' : label || 'Unattributed';
  } else if (label && id) {
    identity = `${label} (${id})`;
  } else {
    identity = label || id || null;
  }

  return {
    kind,
    kindLabel: isLegacy ? ACTOR_KIND_LABEL.unknown : ACTOR_KIND_LABEL[kind],
    identity,
    tone: ACTOR_TONE[kind],
    authoritative: !isLegacy && AUTHORITATIVE_KINDS.has(kind),
  };
}

function toCorrelations(correlation: RawAuditRecord['correlation']): AuditCorrelationView[] {
  if (!correlation || typeof correlation !== 'object') return [];
  const views: AuditCorrelationView[] = [];
  for (const field of CORRELATION_FIELDS) {
    const value = (correlation as Record<string, unknown>)[field.key];
    if (typeof value === 'string' && value.length > 0) {
      views.push({ type: field.type, label: field.label, value });
    }
  }
  return views;
}

/**
 * Turn one normalized record into a view row.
 *
 * A record is treated as legacy when it predates the typed schema (version below
 * 2) or carries no actor object at all. Legacy rows are pinned to
 * unknown/unattributed regardless of anything else in the line.
 */
export function toAuditRecordView(raw: RawAuditRecord | null | undefined): AuditRecordView {
  const record = raw && typeof raw === 'object' ? raw : {};
  const version = typeof record.schemaVersion === 'number' ? record.schemaVersion : 1;
  const hasActor = Boolean(record.actor && typeof record.actor === 'object');
  const isLegacy = version < 2 || !hasActor;

  const outcome = coerceOutcome(record.outcome);
  const policy = coercePolicy(record.policyDecision);
  const details = record.details && typeof record.details === 'object' ? record.details : {};
  const workspaceId = (details as Record<string, unknown>).workspaceId;
  const project = typeof workspaceId === 'string' && workspaceId.length > 0 ? workspaceId : null;

  return {
    recordId: asString(record.recordId) || `row-${asString(record.timestamp)}-${asString(record.event)}`,
    timestamp: asString(record.timestamp),
    event: asString(record.event, 'audit_event'),
    actor: toActorView(record.actor, isLegacy),
    outcome: { label: OUTCOME_LABEL[outcome], tone: OUTCOME_TONE[outcome] },
    policy: { label: POLICY_LABEL[policy], tone: POLICY_TONE[policy] },
    correlations: toCorrelations(record.correlation),
    project,
    isLegacy,
    details: details as Record<string, unknown>,
  };
}

export interface AuditFilter {
  actorKind?: AuditActorKind | 'all';
  outcome?: AuditOutcome | 'all';
  policyDecision?: AuditPolicyDecision | 'all';
}

/** The minimal fetch surface the loader needs, so it can be injected in tests. */
export type AuditFetch = (
  input: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; statusText?: string; json: () => Promise<unknown> }>;

/**
 * The result of a load attempt, kept explicit so the panel can distinguish an
 * empty-but-successful trail from a failure. A failure never carries records, so
 * a stale or failed load can never be mistaken for a current, empty one.
 */
export type AuditLoadResult =
  | { ok: true; records: RawAuditRecord[] }
  | { ok: false; reason: string };

/**
 * Load audit records, turning every failure into an explicit, safe reason.
 *
 * A non-2xx response preserves its HTTP status and status text, which are not
 * secret and are exactly what a person needs to see (a 401 reads as sign-in, a
 * 500 as a server fault). A thrown fetch becomes a connection message. A 2xx
 * whose body is not the expected `{ logs: [...] }` array is a schema failure and
 * is reported as unreadable, not silently coerced to an empty trail, so a broken
 * response can never masquerade as an audit trail with nothing in it. In no case
 * are records returned on failure, so the caller cannot render stale data as if
 * it were fresh.
 */
export async function loadAuditRecords(fetchImpl: AuditFetch, token: string): Promise<AuditLoadResult> {
  let response: Awaited<ReturnType<AuditFetch>>;
  try {
    response = await fetchImpl('/api/myai-workspaces/audit', { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return { ok: false, reason: 'Could not reach the audit service. Check your connection and try again.' };
  }
  if (!response.ok) {
    const status = Number.isFinite(response.status) ? response.status : 0;
    const detail = typeof response.statusText === 'string' && response.statusText ? ` ${response.statusText}` : '';
    return { ok: false, reason: `Could not load the audit trail (${status}${detail}).` };
  }
  try {
    const data = await response.json();
    const logs = (data as { logs?: unknown } | null)?.logs;
    if (!Array.isArray(logs)) {
      // A successful status with a body we cannot read is a failure, not empty.
      return { ok: false, reason: 'The audit trail response was not in the expected format.' };
    }
    return { ok: true, records: logs as RawAuditRecord[] };
  } catch {
    return { ok: false, reason: 'The audit trail response could not be read.' };
  }
}

/** Apply the bounded actor/outcome/policy filters. Absent or 'all' means no filter. */
export function filterAuditRecordViews(views: AuditRecordView[], filter: AuditFilter): AuditRecordView[] {
  return views.filter((view) => {
    if (filter.actorKind && filter.actorKind !== 'all' && view.actor.kind !== filter.actorKind) return false;
    if (filter.outcome && filter.outcome !== 'all' && OUTCOME_LABEL[filter.outcome] !== view.outcome.label) return false;
    if (
      filter.policyDecision &&
      filter.policyDecision !== 'all' &&
      POLICY_LABEL[filter.policyDecision] !== view.policy.label
    ) {
      return false;
    }
    return true;
  });
}
