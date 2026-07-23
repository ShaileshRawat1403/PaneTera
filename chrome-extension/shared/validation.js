// chrome-extension/shared/validation.js

/**
 * Validates whether the expected origin matches the actual URL origin.
 * Returns true if valid, false otherwise.
 */
export function validateOrigin(expectedOrigin, actualUrl) {
  if (!expectedOrigin) return false;
  try {
    const actualOrigin = new URL(actualUrl).origin;
    return expectedOrigin.toLowerCase() === actualOrigin.toLowerCase();
  } catch (e) {
    return false;
  }
}

/**
 * Sanitizes input strings by trimming and scrubbing potential control strings.
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text.trim();
}

function isPrivateIpv4(hostname) {
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

/**
 * Public web targets only. This is the shared admission check for requests
 * arriving from PaneTera and for the extension-owned approval page.
 */
export function normalizePublicHttpUrl(value) {
  if (typeof value !== 'string' || value.length > 20_000) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) return null;
    if (hostname.includes(':') || hostname.startsWith('[') || isPrivateIpv4(hostname)) return null;
    if (/\.(local|internal|lan|home|test)$/.test(hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
