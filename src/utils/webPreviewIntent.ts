export interface WebPreviewRequest {
  url: string;
  name: string;
}

export type WebPreviewIntent =
  | { kind: 'open'; request: WebPreviewRequest }
  | { kind: 'clarify' }
  | { kind: 'close' }
  | { kind: 'reload' }
  | null;

const PREVIEW_VERB = /\b(open|show|view|preview|browse|visit|load|display)\b/i;
const EXPLICIT_URL = /\bhttps?:\/\/[^\s<>"']+/i;
const BARE_DOMAIN = /\b(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<>"']*)?/i;
const WEB_SURFACE_NOUN = /\b(web\s?page|website|site|url|link|browser preview)\b/i;
const CLOSE_VERB = /\b(close|dismiss|hide|remove|stop showing)\b/i;
const RELOAD_VERB = /\b(reload|refresh)\b/i;

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) {
    return false;
  }

  const [first, second] = octets;
  return first === 0
    || first === 10
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 100 && second >= 64 && second <= 127);
}

export function isPublicWebPreviewUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) return false;
    if (hostname.includes(':') || hostname.startsWith('[') || isPrivateIpv4(hostname)) return false;
    if (/\.(local|internal|lan|home|test)$/.test(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function resolvePublicWebPreviewSandbox(value: string, portalOrigin: string): string | null {
  if (!isPublicWebPreviewUrl(value)) return null;
  try {
    if (new URL(value).origin === new URL(portalOrigin).origin) return null;
  } catch {
    return null;
  }
  return 'allow-scripts allow-forms allow-popups allow-same-origin';
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[),.!?;:]+$/, '');
}

export function extractWebPreviewRequest(message: string): WebPreviewRequest | null {
  const trimmed = message.trim();
  const explicitMatch = trimmed.match(EXPLICIT_URL)?.[0];
  const domainMatch = explicitMatch ? null : trimmed.match(BARE_DOMAIN)?.[0];
  const candidate = explicitMatch || domainMatch;

  if (!candidate) return null;

  const messageIsOnlyUrl = stripTrailingPunctuation(trimmed) === stripTrailingPunctuation(candidate);
  if (!messageIsOnlyUrl && !PREVIEW_VERB.test(trimmed)) return null;

  try {
    const normalized = stripTrailingPunctuation(candidate);
    const url = new URL(/^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`);
    if (!isPublicWebPreviewUrl(url.toString())) return null;

    return {
      url: url.toString(),
      name: url.hostname.replace(/^www\./, ''),
    };
  } catch {
    return null;
  }
}

export function resolveWebPreviewIntent(message: string, hasOpenPreview = false): WebPreviewIntent {
  const request = extractWebPreviewRequest(message);
  if (request) return { kind: 'open', request };

  const trimmed = message.trim();
  if (hasOpenPreview && RELOAD_VERB.test(trimmed) && (WEB_SURFACE_NOUN.test(trimmed) || /^(reload|refresh)( it)?[.!]?$/i.test(trimmed))) {
    return { kind: 'reload' };
  }
  if (CLOSE_VERB.test(trimmed) && WEB_SURFACE_NOUN.test(trimmed)) return { kind: 'close' };
  if (PREVIEW_VERB.test(trimmed) && WEB_SURFACE_NOUN.test(trimmed)) return { kind: 'clarify' };
  return null;
}
