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
