// src/components/rig/provenanceModel.ts
//
// The presentation model for Rig provenance records. It is the single place a
// provenance record is validated at the load boundary and interpreted for
// display, so the raw array dump can be replaced with a progressively disclosed,
// evidence-accurate view.
//
// The rule it holds: nothing is inferred. Trust level, integrity, actor, and
// approval are read verbatim from the canonical record and never guessed or
// upgraded. An unknown-but-valid record type is shown as its own unfamiliar type,
// never mapped onto a known event.

import {
  PROVENANCE_TRUST_LEVELS,
  PROVENANCE_INTEGRITIES,
  RIG_SOURCE_CLASSES,
  type ProvenanceRecord,
  type ProvenanceTrustLevel,
  type ProvenanceIntegrity,
} from '../../rig/types';

const TRUST_SET: ReadonlySet<string> = new Set(PROVENANCE_TRUST_LEVELS);
const INTEGRITY_SET: ReadonlySet<string> = new Set(PROVENANCE_INTEGRITIES);
const SOURCE_CLASS_SET: ReadonlySet<string> = new Set(RIG_SOURCE_CLASSES);

/**
 * Whether a value is exactly the server's timestamp serialization.
 *
 * `createdAt` is written by the server as `new Date().toISOString()`, which is
 * always millisecond-precision UTC: `YYYY-MM-DDThh:mm:ss.sssZ`. Only that exact
 * shape is accepted, so a bare-second string or a `+hh:mm` offset is rejected.
 * The round-trip through `Date` also rejects a normalized impossible date such as
 * `2026-02-30T00:00:00.000Z`, which `Date` silently rolls forward to March: if
 * the parsed date does not re-serialize to the same string, it was not a real
 * instant in that form.
 */
function isCanonicalTimestamp(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

/** Maximum length for any single identifier or type field. */
const MAX_FIELD_LENGTH = 256;

/**
 * Whether a value is a bounded, non-blank, already-trimmed string.
 *
 * A field must carry meaning, so it cannot be empty or whitespace, cannot arrive
 * with surrounding whitespace to mask a blank value, and cannot be unbounded.
 */
function isBoundedField(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_FIELD_LENGTH && value === value.trim();
}

/**
 * A structural guard for a single provenance record.
 *
 * Every field the view reads is validated, and the closed enums (trust level,
 * integrity, source class) must be exact known values. `recordType` and
 * `retentionClass` stay open strings because new kinds can legitimately appear.
 * One malformed element must make the whole load unreadable rather than reach the
 * renderer as a partial record.
 */
export function isProvenanceRecord(value: unknown): value is ProvenanceRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  // Identity and type fields must be meaningful: bounded, non-blank, trimmed.
  if (!isBoundedField(r.recordId) || !isBoundedField(r.recordType) || !isBoundedField(r.ownerId)) return false;
  if (!isBoundedField(r.retentionClass)) return false;
  // The timestamp must be exactly the server's serialization, and not a
  // normalized impossible date.
  if (!isCanonicalTimestamp(r.createdAt)) return false;
  if (typeof r.sourceClass !== 'string' || !SOURCE_CLASS_SET.has(r.sourceClass)) return false;
  if (typeof r.trustLevel !== 'string' || !TRUST_SET.has(r.trustLevel)) return false;
  if (typeof r.integrity !== 'string' || !INTEGRITY_SET.has(r.integrity)) return false;
  const src = r.sourceIdentity as Record<string, unknown> | undefined;
  if (!src || typeof src !== 'object' || !isBoundedField(src.kind) || !isBoundedField(src.id)) return false;
  if (!Array.isArray(r.parentRecordIds) || !r.parentRecordIds.every(isBoundedField)) return false;
  if (r.inputDigest !== null && typeof r.inputDigest !== 'string') return false;
  if (r.outputDigest !== null && typeof r.outputDigest !== 'string') return false;
  const corr = r.correlation as Record<string, unknown> | undefined;
  if (!corr || typeof corr !== 'object' || Array.isArray(corr)) return false;
  for (const key of ['envelopeId', 'proposalId', 'approvalId', 'connectionId'] as const) {
    // A present correlation id must be a meaningful bounded value, not blank.
    if (corr[key] !== undefined && !isBoundedField(corr[key])) return false;
  }
  return true;
}

/**
 * Project a validated record onto exactly the canonical fields.
 *
 * The input may carry extra keys — a secret-bearing extension field, or an
 * unknown correlation key — and preserving the arbitrary input in the view or the
 * raw disclosure would leak them. Building a fresh object from the known fields
 * only, and copying only the four known correlation keys and the two source
 * identity keys, guarantees nothing beyond the canonical record survives.
 */
export function projectProvenanceRecord(record: ProvenanceRecord): ProvenanceRecord {
  const c = record.correlation;
  const correlation: ProvenanceRecord['correlation'] = {};
  if (c.envelopeId !== undefined) correlation.envelopeId = c.envelopeId;
  if (c.proposalId !== undefined) correlation.proposalId = c.proposalId;
  if (c.approvalId !== undefined) correlation.approvalId = c.approvalId;
  if (c.connectionId !== undefined) correlation.connectionId = c.connectionId;
  return {
    recordId: record.recordId,
    recordType: record.recordType,
    ownerId: record.ownerId,
    sourceIdentity: { kind: record.sourceIdentity.kind, id: record.sourceIdentity.id },
    parentRecordIds: [...record.parentRecordIds],
    inputDigest: record.inputDigest,
    outputDigest: record.outputDigest,
    createdAt: record.createdAt,
    sourceClass: record.sourceClass,
    trustLevel: record.trustLevel,
    correlation,
    integrity: record.integrity,
    retentionClass: record.retentionClass,
  };
}

export type ProvenanceTone = 'neutral' | 'attention' | 'danger';

/** Known record types get a human label; anything else is shown as unknown. */
const KNOWN_TYPE_LABEL: Record<string, string> = {
  'mcp-invocation': 'Tool invocation',
  'mcp-resource-read': 'Resource read',
  'mcp-prompt-read': 'Prompt read',
};

const INTEGRITY_LABEL: Record<ProvenanceIntegrity, string> = {
  verified: 'Integrity verified',
  unverified: 'Integrity unverified',
  broken: 'Integrity broken',
};

const INTEGRITY_TONE: Record<ProvenanceIntegrity, ProvenanceTone> = {
  verified: 'neutral',
  unverified: 'attention',
  broken: 'danger',
};

const TRUST_LABEL: Record<ProvenanceTrustLevel, string> = {
  untrusted: 'Untrusted',
  derived: 'Derived',
  authoritative: 'Authoritative',
};

export interface ProvenanceCorrelationView {
  type: string;
  label: string;
  value: string;
}

export interface ProvenanceRecordView {
  recordId: string;
  /** The human label, or the raw type string when the type is unknown. */
  typeLabel: string;
  /** False when the record type is not a known kind. */
  isKnownType: boolean;
  sourceKind: string;
  sourceId: string;
  /** Integrity is displayed verbatim; it is never inferred from anything else. */
  integrity: { value: ProvenanceIntegrity; label: string; tone: ProvenanceTone };
  /** Trust level is displayed verbatim, separate from integrity. */
  trust: { value: ProvenanceTrustLevel; label: string };
  timestamp: string;
  correlations: ProvenanceCorrelationView[];
  /** The full record, for the raw-details disclosure. */
  raw: ProvenanceRecord;
}

const CORRELATION_FIELDS: ReadonlyArray<{ key: 'envelopeId' | 'proposalId' | 'approvalId' | 'connectionId'; type: string; label: string }> = [
  { key: 'proposalId', type: 'proposal', label: 'Proposal' },
  { key: 'approvalId', type: 'approval', label: 'Approval' },
  { key: 'connectionId', type: 'connection', label: 'Connection' },
  { key: 'envelopeId', type: 'envelope', label: 'Envelope' },
];

/**
 * Interpret one validated provenance record into a display view. Trust and
 * integrity are two independent fields and are surfaced independently.
 */
export function resolveProvenanceView(record: ProvenanceRecord): ProvenanceRecordView {
  // Work only from the canonical projection, so both the view and the raw
  // disclosure are free of any arbitrary input fields.
  const r = projectProvenanceRecord(record);
  const known = Object.prototype.hasOwnProperty.call(KNOWN_TYPE_LABEL, r.recordType);
  const correlations: ProvenanceCorrelationView[] = [];
  for (const field of CORRELATION_FIELDS) {
    const value = r.correlation[field.key];
    if (typeof value === 'string' && value.length > 0) {
      correlations.push({ type: field.type, label: field.label, value });
    }
  }
  return {
    recordId: r.recordId,
    typeLabel: known ? KNOWN_TYPE_LABEL[r.recordType] : r.recordType,
    isKnownType: known,
    sourceKind: r.sourceIdentity.kind,
    sourceId: r.sourceIdentity.id,
    integrity: { value: r.integrity, label: INTEGRITY_LABEL[r.integrity], tone: INTEGRITY_TONE[r.integrity] },
    trust: { value: r.trustLevel, label: TRUST_LABEL[r.trustLevel] },
    timestamp: r.createdAt,
    correlations,
    raw: r,
  };
}
