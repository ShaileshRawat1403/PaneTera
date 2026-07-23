const MAX_VISIBLE_TEXT = 40_000;
const MAX_SCREENSHOT_DATA_URL = 1_500_000;

export interface BrowserEvidenceRecord {
  captureId?: string;
  extractionId?: string;
  capability?: string;
  title?: string;
  url?: string;
  capturedAt?: string;
  selectedText?: string;
  source?: {
    title?: string;
    url?: string;
    capturedAt?: string;
  };
  data?: unknown;
  evidence?: {
    elementsMatched?: number;
    contentBytes?: number;
  };
  warnings?: unknown;
  truncated?: boolean;
}

/**
 * The identifier that ties this evidence back to the trail, and which kind it
 * is. A capture id and an extraction id are not the same thing, so the kind
 * travels with the value rather than being flattened away — the surface labels
 * it accurately instead of calling an extraction id a capture id.
 */
export type EvidenceIdKind = 'capture' | 'extraction';

export interface BrowserEvidenceViewModel {
  title: string;
  url: string;
  capturedAt: string | null;
  capability: string;
  text: string;
  screenshotDataUrl: string | null;
  elementsMatched: number | null;
  /** Bytes the extraction reported, for the provenance strip. */
  contentBytes: number | null;
  /** The audit handle, with its kind so it can be labelled correctly. */
  evidenceId: string | null;
  evidenceIdKind: EvidenceIdKind | null;
  warnings: string[];
  truncated: boolean;
}

/**
 * Sensitive query-parameter substrings.
 *
 * Mirrored from the authoritative server sanitiser in
 * `server/browserGatewayValidation.ts`, including its substring matching: a
 * parameter is sensitive if its name *contains* one of these, so `access_token`
 * matches `token` and `x-api-key` matches `key`. An earlier version of this
 * frontend policy used exact matching, which was strictly weaker than the
 * server and could miss a param the server would strip.
 *
 * These two lists, plus the one in `server/headroom/store.ts`, should be one
 * shared module rather than three copies. Tracked as a follow-up; kept in sync
 * by hand until then, erring toward the server's broader policy.
 */
const SENSITIVE_PARAM_SUBSTRINGS = [
  'token',
  'key',
  'auth',
  'api_key',
  'apikey',
  'secret',
  'password',
  'passwd',
  'session',
  'access_token',
  'refresh_token',
  'credential',
];

/**
 * A display-safe form of a URL, with sensitive query values and any embedded
 * credentials redacted.
 *
 * This exists because the evidence pipeline deliberately strips values like
 * `token`, `auth`, `key` and `session`, and a surface that renders an
 * unredacted URL would put back exactly what the pipeline removed. Applied to
 * every address this surface shows, so the redaction cannot be undone by the
 * display. The parameter name is kept and its value replaced, so a person can
 * see a secret was present without the secret itself.
 */
export function redactSensitiveUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    if (parsed.username || parsed.password) {
      parsed.username = '';
      parsed.password = '';
    }
    for (const key of [...parsed.searchParams.keys()]) {
      const name = key.toLowerCase();
      if (SENSITIVE_PARAM_SUBSTRINGS.some((candidate) => name.includes(candidate))) {
        parsed.searchParams.set(key, 'redacted');
      }
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function boundedText(value: unknown): string {
  if (typeof value !== 'string') return '';
  if (value.length <= MAX_VISIBLE_TEXT) return value;
  return `${value.slice(0, MAX_VISIBLE_TEXT)}\n\n[Evidence truncated for display]`;
}

function safeScreenshot(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_SCREENSHOT_DATA_URL) return null;
  return /^data:image\/(?:png|jpeg|webp);base64,/i.test(value) ? value : null;
}

/** Convert a server-sanitised browser record into a bounded canvas model. */
export function browserEvidenceViewModel(record: BrowserEvidenceRecord): BrowserEvidenceViewModel {
  const payload = objectValue(record.data);
  const source = record.source ?? {};
  const selectedText = boundedText(record.selectedText);
  const articleText = boundedText(payload?.textContent);
  const excerpt = boundedText(payload?.excerpt);
  const fallbackData = !articleText && !selectedText && record.data !== undefined
    ? boundedText(JSON.stringify(record.data, null, 2))
    : '';
  const text = articleText || selectedText || excerpt || fallbackData;
  const warnings = Array.isArray(record.warnings)
    ? [...new Set(record.warnings.filter((item): item is string => typeof item === 'string'))].slice(0, 20)
    : [];
  const matched = record.evidence?.elementsMatched;
  const bytes = record.evidence?.contentBytes;

  // A capture id and an extraction id are different things. Prefer the capture
  // id and record which kind was found, so the surface can label it truthfully
  // rather than calling every id a "Capture ID".
  const captureId = boundedText(record.captureId).slice(0, 200);
  const extractionId = boundedText(record.extractionId).slice(0, 200);
  const evidenceId = captureId || extractionId || null;
  const evidenceIdKind: EvidenceIdKind | null = captureId ? 'capture' : extractionId ? 'extraction' : null;

  return {
    title: boundedText(source.title || record.title || payload?.title) || 'Browser evidence',
    // Redacted, not merely scheme-checked. The address is displayed, so it must
    // not reintroduce the secrets the pipeline stripped.
    url: redactSensitiveUrl(source.url || record.url),
    capturedAt: source.capturedAt || record.capturedAt || null,
    capability: record.capability || 'browser.page.observe',
    text,
    screenshotDataUrl: safeScreenshot(payload?.screenshotDataUrl),
    elementsMatched: typeof matched === 'number' && Number.isFinite(matched) ? matched : null,
    contentBytes: typeof bytes === 'number' && Number.isFinite(bytes) && bytes >= 0 ? bytes : null,
    evidenceId,
    evidenceIdKind,
    warnings,
    truncated: Boolean(record.truncated) || text.endsWith('[Evidence truncated for display]'),
  };
}
