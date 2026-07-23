import { Buffer } from 'node:buffer';
import type { BrowserTrust, EvidenceItem, EvidenceOwnership, ExtractionResult } from './evidence/evidenceTypes';
import { isSensitiveParamName } from './redactionPolicy';

type JsonRecord = Record<string, unknown>;

export interface ValidatedBrowserEnvelope {
  protocolVersion: '1.0';
  capabilityVersion: '1.0';
  transactionId: string;
  idempotencyKey: string;
  issuedAt: string;
  expiresAt: string;
  capability: string;
  target: { tabId: number; frameId: number; expectedOrigin: string };
  constraints: { maxElements: number; maxOutputBytes: number; timeoutMs: number };
  payload: JsonRecord;
  isPhase1: boolean;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_CLOCK_SKEW_MS = 60_000;
const MAX_ENVELOPE_AGE_MS = 5 * 60_000;
const MAX_LIFETIME_MS = 5 * 60_000;
const MAX_OUTPUT_BYTES = 2_000_000;
const MAX_EVIDENCE_CONTENT_BYTES = 1_800_000;
const MAX_ELEMENTS = 5_000;
const MAX_TIMEOUT_MS = 30_000;
const MAX_TREE_DEPTH = 12;
const MAX_TREE_NODES = 25_000;
const ALLOWED_EVIDENCE_KINDS = new Set(['text', 'heading', 'table-cell', 'link', 'metadata', 'code']);

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function boundedString(value: unknown, max: number, allowEmpty = false): value is string {
  return typeof value === 'string' && value.length <= max && (allowEmpty || value.length > 0);
}

function validInteger(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
}

function luhnValid(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index--) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

export function sanitizeBrowserText(value: unknown, maxLength = 100_000): string {
  if (typeof value !== 'string') return '';
  let clean = value.slice(0, maxLength);
  const patterns = [
    /sk-[A-Za-z0-9_-]{20,}/g,
    /gh[po]_[A-Za-z0-9_-]{20,}/g,
    /glpat-[A-Za-z0-9_-]{20,}/g,
    /AKIA[0-9A-Z]{16}/g,
    /xox[baprs]-[A-Za-z0-9_-]{10,}/g,
    /Bearer\s+[A-Za-z0-9._-]{20,}/g,
    /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    /(postgres|mongodb|mysql|redis):\/\/[^\s@]+@[^\s]+/g
  ];
  for (const pattern of patterns) clean = clean.replace(pattern, '[REDACTED_CREDENTIAL]');
  clean = clean.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]');
  clean = clean.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');
  clean = clean.replace(/\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]');
  clean = clean.replace(/\b(?:\d[ -]*?){13,19}\b/g, match => luhnValid(match) ? '[REDACTED_CARD]' : match);
  return clean;
}

export function sanitizeBrowserUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 20_000) return '';
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    parsed.username = '';
    parsed.password = '';
    // The canonical param policy, shared with the audit scrubber so the two can
    // no longer disagree about what counts as sensitive.
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (isSensitiveParamName(key)) {
        parsed.searchParams.set(key, '[REDACTED]');
      }
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

function sanitizeUntrustedValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_TREE_DEPTH) return '[TRUNCATED_MAX_DEPTH]';
  if (typeof value === 'string') {
    return /^https?:\/\//i.test(value.trim()) ? sanitizeBrowserUrl(value) : sanitizeBrowserText(value);
  }
  if (Array.isArray(value)) return value.map(item => sanitizeUntrustedValue(item, depth + 1));
  if (isRecord(value)) {
    const result: JsonRecord = {};
    for (const [key, child] of Object.entries(value)) result[key] = sanitizeUntrustedValue(child, depth + 1);
    return result;
  }
  return value;
}

function inspectTree(value: unknown): string | null {
  let nodes = 0;
  const visit = (current: unknown, depth: number): string | null => {
    nodes += 1;
    if (nodes > MAX_TREE_NODES) return 'Payload object graph exceeds the node limit';
    if (depth > MAX_TREE_DEPTH) return 'Payload object graph exceeds the depth limit';
    if (typeof current === 'string' && current.length > 110_000) return 'Payload contains an oversized string';
    if (!current || typeof current !== 'object') return null;
    for (const key of Object.keys(current)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') return 'Prototype-pollution key detected';
      const error = visit((current as JsonRecord)[key], depth + 1);
      if (error) return error;
    }
    return null;
  };
  return visit(value, 0);
}

function validateTimestampWindow(issuedAtValue: unknown, expiresAtValue: unknown, now: number): string | null {
  if (!boundedString(issuedAtValue, 64) || !boundedString(expiresAtValue, 64)) return 'Envelope timestamps are required';
  const issuedAt = Date.parse(issuedAtValue);
  const expiresAt = Date.parse(expiresAtValue);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return 'Envelope timestamps are invalid';
  if (issuedAt > now + MAX_CLOCK_SKEW_MS || issuedAt < now - MAX_ENVELOPE_AGE_MS) return 'Envelope issuedAt is outside the accepted window';
  if (expiresAt <= issuedAt || expiresAt > issuedAt + MAX_LIFETIME_MS || expiresAt < now) return 'Envelope expiry is invalid';
  return null;
}

function validateTarget(value: unknown): ValidationResult<ValidatedBrowserEnvelope['target']> {
  if (!isRecord(value)) return { ok: false, error: 'Envelope target is required' };
  if (!validInteger(value.tabId, 0, Number.MAX_SAFE_INTEGER) || !validInteger(value.frameId ?? 0, 0, Number.MAX_SAFE_INTEGER)) {
    return { ok: false, error: 'Envelope target identifiers are invalid' };
  }
  if (!boundedString(value.expectedOrigin, 2_048)) return { ok: false, error: 'Envelope expectedOrigin is invalid' };
  try {
    const parsed = new URL(value.expectedOrigin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== value.expectedOrigin) throw new Error('not an origin');
  } catch {
    return { ok: false, error: 'Envelope expectedOrigin must be an HTTP(S) origin' };
  }
  return { ok: true, value: { tabId: value.tabId, frameId: Number(value.frameId ?? 0), expectedOrigin: value.expectedOrigin } };
}

function validateConstraints(value: unknown): ValidationResult<ValidatedBrowserEnvelope['constraints']> {
  if (!isRecord(value)) return { ok: false, error: 'Envelope constraints are required' };
  if (!validInteger(value.maxElements, 1, MAX_ELEMENTS)) return { ok: false, error: 'maxElements must be a positive bounded integer' };
  if (!validInteger(value.maxOutputBytes, 1, MAX_OUTPUT_BYTES)) return { ok: false, error: 'maxOutputBytes must be a positive bounded integer' };
  if (!validInteger(value.timeoutMs, 1, MAX_TIMEOUT_MS)) return { ok: false, error: 'timeoutMs must be a positive bounded integer' };
  return { ok: true, value: { maxElements: value.maxElements, maxOutputBytes: value.maxOutputBytes, timeoutMs: value.timeoutMs } };
}

export function validateBrowserEnvelope(input: unknown, allowedCapabilities: ReadonlySet<string>, now = Date.now()): ValidationResult<ValidatedBrowserEnvelope> {
  if (!isRecord(input)) return { ok: false, error: 'Envelope must be an object' };
  const treeError = inspectTree(input);
  if (treeError) return { ok: false, error: treeError };
  if (input.protocolVersion !== '1.0' || input.capabilityVersion !== '1.0') return { ok: false, error: 'Unsupported protocol or capability version' };
  if (!boundedString(input.capability, 100) || !allowedCapabilities.has(input.capability)) return { ok: false, error: 'Unauthorized capability' };
  if (!boundedString(input.transactionId, 100) || !boundedString(input.idempotencyKey, 100)) return { ok: false, error: 'Bounded transactionId and idempotencyKey are required' };
  if (input.riskLevel !== 'inspect') return { ok: false, error: 'Browser observations must use inspect risk' };
  if (!isRecord(input.approval) || input.approval.required !== false || input.approval.status !== 'not-required' || input.approval.grantId !== null) {
    return { ok: false, error: 'Browser observation approval declaration is invalid' };
  }
  const timestampError = validateTimestampWindow(input.issuedAt, input.expiresAt, now);
  if (timestampError) return { ok: false, error: timestampError };
  const target = validateTarget(input.target);
  if (!target.ok) return target;
  const constraints = validateConstraints(input.constraints);
  if (!constraints.ok) return constraints;
  if (!isRecord(input.payload)) return { ok: false, error: 'Envelope payload must be an object' };
  const bytes = Buffer.byteLength(JSON.stringify(input), 'utf8');
  if (bytes > constraints.value.maxOutputBytes) return { ok: false, error: 'Envelope exceeds maxOutputBytes' };
  const isPhase1 = input.capability === 'browser.page.observe' || input.capability === 'browser.selection.observe';
  if (isPhase1 && (
    !boundedString(input.payload.title, 10_000, true) ||
    !boundedString(input.payload.url, 20_000) ||
    !boundedString(input.payload.selectedText ?? '', 100_000, true)
  )) return { ok: false, error: 'Phase 1 payload fields are invalid or oversized' };
  return {
    ok: true,
    value: {
      protocolVersion: '1.0', capabilityVersion: '1.0',
      transactionId: input.transactionId, idempotencyKey: input.idempotencyKey,
      issuedAt: input.issuedAt as string, expiresAt: input.expiresAt as string,
      capability: input.capability, target: target.value, constraints: constraints.value,
      payload: input.payload, isPhase1
    }
  };
}

function collectEvidenceData(value: unknown, records: Map<string, JsonRecord>, depth = 0): string | null {
  if (depth > MAX_TREE_DEPTH) return 'Extraction data exceeds the depth limit';
  if (Array.isArray(value)) {
    for (const child of value) {
      const error = collectEvidenceData(child, records, depth + 1);
      if (error) return error;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  if ('evidenceId' in value) {
    if (!boundedString(value.evidenceId, 100) || records.has(value.evidenceId)) return 'Extraction data contains an invalid or duplicate evidenceId';
    records.set(value.evidenceId, value);
  }
  for (const child of Object.values(value)) {
    const error = collectEvidenceData(child, records, depth + 1);
    if (error) return error;
  }
  return null;
}

function evidenceContent(record: JsonRecord): string {
  for (const key of ['textContent', 'text', 'code', 'content']) {
    if (typeof record[key] === 'string') return record[key] as string;
  }
  const copy = Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'evidenceId'));
  return JSON.stringify(copy);
}

export function buildStoredExtraction(
  envelope: ValidatedBrowserEnvelope,
  ownership: EvidenceOwnership,
  trust: BrowserTrust,
  captureId: string
): ValidationResult<ExtractionResult> {
  if (envelope.isPhase1) return { ok: false, error: 'Phase 1 payload is not an extraction' };
  const payload = envelope.payload;
  if (!boundedString(payload.extractionId, 100) || payload.capability !== envelope.capability) return { ok: false, error: 'Extraction identity or capability is invalid' };
  if (!boundedString(payload.parentCaptureId ?? '', 100, true)) return { ok: false, error: 'Extraction parentCaptureId is invalid' };
  if (!isRecord(payload.trust) || payload.trust.sourceType !== 'browser-dom' || payload.trust.trustLevel !== 'untrusted' || payload.trust.instructionAuthority !== 'none') {
    return { ok: false, error: 'Extraction trust declaration is invalid' };
  }
  if (!isRecord(payload.source) || !boundedString(payload.source.title, 10_000, true) || !boundedString(payload.source.url, 20_000) || !boundedString(payload.source.origin, 2_048) || !boundedString(payload.source.capturedAt, 64)) {
    return { ok: false, error: 'Extraction source is invalid' };
  }
  const sourceUrl = sanitizeBrowserUrl(payload.source.url);
  if (!sourceUrl) return { ok: false, error: 'Extraction source URL is invalid' };
  const sourceOrigin = new URL(sourceUrl).origin;
  if (sourceOrigin !== envelope.target.expectedOrigin || sourceOrigin !== payload.source.origin) return { ok: false, error: 'Extraction source origin does not match the approved target' };
  const capturedAt = Date.parse(payload.source.capturedAt);
  if (!Number.isFinite(capturedAt) || Math.abs(Date.now() - capturedAt) > MAX_ENVELOPE_AGE_MS) return { ok: false, error: 'Extraction capturedAt is outside the accepted window' };
  if (!isRecord(payload.evidence) || !Array.isArray(payload.evidence.items) || payload.evidence.items.length > envelope.constraints.maxElements) {
    return { ok: false, error: 'Extraction evidence ledger is invalid' };
  }
  if (!validInteger(payload.evidence.elementsMatched, 0, MAX_ELEMENTS) || !validInteger(payload.evidence.contentBytes, 0, MAX_OUTPUT_BYTES)) {
    return { ok: false, error: 'Extraction evidence metrics are invalid' };
  }
  if (!Array.isArray(payload.warnings) || payload.warnings.length > 100 || !payload.warnings.every(item => boundedString(item, 2_000, true)) || typeof payload.truncated !== 'boolean') {
    return { ok: false, error: 'Extraction warning or truncation fields are invalid' };
  }

  const cleanData = sanitizeUntrustedValue(payload.data);
  const referencedData = new Map<string, JsonRecord>();
  const dataError = collectEvidenceData(cleanData, referencedData);
  if (dataError) return { ok: false, error: dataError };

  const ids = new Set<string>();
  const items: EvidenceItem[] = [];
  for (const candidate of payload.evidence.items) {
    if (!isRecord(candidate) || !boundedString(candidate.evidenceId, 100) || ids.has(candidate.evidenceId)) return { ok: false, error: 'Evidence item identity is invalid or duplicated' };
    if (!boundedString(candidate.kind, 40) || !ALLOWED_EVIDENCE_KINDS.has(candidate.kind)) return { ok: false, error: 'Evidence item kind is invalid' };
    if (!isRecord(candidate.locator) || !boundedString(candidate.locator.recipeId, 200)) return { ok: false, error: 'Evidence locator is invalid' };
    for (const numericField of ['ordinal', 'row', 'column']) {
      if (candidate.locator[numericField] !== undefined && !validInteger(candidate.locator[numericField], -1, MAX_ELEMENTS)) {
        return { ok: false, error: 'Evidence locator coordinate is invalid' };
      }
    }
    if (candidate.textRange !== undefined) {
      if (!isRecord(candidate.textRange) || !validInteger(candidate.textRange.start, 0, Number.MAX_SAFE_INTEGER) || !validInteger(candidate.textRange.end, 0, Number.MAX_SAFE_INTEGER) || Number(candidate.textRange.end) < Number(candidate.textRange.start)) {
        return { ok: false, error: 'Evidence textRange is invalid' };
      }
    }
    const record = referencedData.get(candidate.evidenceId);
    if (!record) return { ok: false, error: 'Evidence item has no corresponding data record' };
    const content = evidenceContent(record);
    const locator: JsonRecord = { ...candidate.locator };
    if (candidate.kind === 'link' && typeof record.href === 'string') locator.href = record.href;
    if (candidate.kind === 'code' && typeof record.language === 'string') locator.language = record.language;
    if (candidate.kind === 'heading' && typeof record.level === 'number') locator.level = record.level;
    items.push({
      evidenceId: candidate.evidenceId,
      extractionId: payload.extractionId,
      ownership,
      trust,
      kind: candidate.kind,
      locator,
      content,
      contentBytes: Buffer.byteLength(content, 'utf8')
    });
    ids.add(candidate.evidenceId);
  }
  if (referencedData.size !== ids.size) return { ok: false, error: 'Extraction data contains orphan evidence references' };
  const measuredContentBytes = items.reduce((sum, item) => sum + item.contentBytes, 0);
  if (measuredContentBytes > MAX_EVIDENCE_CONTENT_BYTES) return { ok: false, error: 'Extraction evidence content exceeds the server ceiling' };

  return {
    ok: true,
    value: {
      extractionId: payload.extractionId,
      parentCaptureId: captureId,
      capability: envelope.capability,
      ownership,
      trust,
      source: {
        title: sanitizeBrowserText(payload.source.title, 10_000),
        url: sourceUrl,
        origin: sourceOrigin,
        capturedAt: new Date(capturedAt).toISOString()
      },
      data: cleanData,
      evidence: {
        items,
        elementsMatched: items.length,
        contentBytes: measuredContentBytes
      },
      warnings: (payload.warnings as string[]).map(item => sanitizeBrowserText(item, 2_000)),
      truncated: payload.truncated
    }
  };
}

export function buildPhase1ObservationPayload(envelope: ValidatedBrowserEnvelope): ValidationResult<{ title: string; url: string; origin: string; selectedText: string }> {
  if (!envelope.isPhase1) return { ok: false, error: 'Payload is not a Phase 1 observation' };
  const title = sanitizeBrowserText(envelope.payload.title, 10_000);
  const url = sanitizeBrowserUrl(envelope.payload.url);
  const selectedText = sanitizeBrowserText(envelope.payload.selectedText ?? '', 100_000);
  if (!url) return { ok: false, error: 'Observation URL is invalid' };
  const origin = new URL(url).origin;
  if (origin !== envelope.target.expectedOrigin) return { ok: false, error: 'Observation origin does not match the approved target' };
  return { ok: true, value: { title, url, origin, selectedText } };
}
