import { materializedContextValue } from '../composer/submissionPlan';

const DEFAULT_MAX_BYTES = 80_000;

export interface BrowserEvidenceRecord {
  extractionId?: string;
  parentCaptureId?: string;
  capability?: string;
  source?: { title?: string; url?: string; capturedAt?: string };
  data?: unknown;
  evidence?: { elementsMatched?: number; contentBytes?: number };
  warnings?: unknown;
  truncated?: boolean;
}

function truncateUtf8(value: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  if (encoder.encode(value).byteLength <= maxBytes) return value;
  let low = 0;
  let high = value.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (encoder.encode(value.slice(0, middle)).byteLength <= maxBytes) low = middle;
    else high = middle - 1;
  }
  return `${value.slice(0, low)}\n[TRUNCATED_BY_HEADROOM]`;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Convert a server-sanitised browser extraction into bounded model context. */
export function buildBrowserEvidenceBlock(record: BrowserEvidenceRecord, maxBytes = DEFAULT_MAX_BYTES): string {
  const payload = {
    source: record.source ?? null,
    capability: record.capability ?? null,
    data: record.data ?? null,
    evidence: record.evidence ?? null,
    warnings: Array.isArray(record.warnings) ? record.warnings : [],
    truncated: Boolean(record.truncated),
  };
  const label = record.source?.title || record.source?.url || 'Browser observation';
  const bounded = truncateUtf8(JSON.stringify(payload), maxBytes);
  return `<attached-context trust="untrusted" authority="none" kind="browser-extraction" label="${escapeAttribute(label)}">\n${materializedContextValue(bounded)}\n</attached-context>`;
}

export function firstAttachedWebContext(context: readonly { kind: string; locator: string; label: string }[]) {
  return context.find((item) => item.kind === 'web') ?? null;
}

/** True when an ordinary follow-up clearly refers to the page already open. */
export function shouldInspectActiveWebPreview(input: string): boolean {
  return /\b(?:this|the|current|open)\s+(?:web\s*)?(?:page|site|website)\b|\b(?:browser operator|chrome extension)\b|\b(?:inspect|read|summari[sz]e|explain|analyse|analyze)\s+(?:it|this|the page|the site|the website)\b/i.test(input);
}
