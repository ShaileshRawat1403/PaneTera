// chrome-extension/operator/guards.js
//
// Thin safety floor. These checks apply even in ungoverned mode. The point is
// not to reproduce the governed pipeline, it is to stop the obvious failure
// where a page convinces the operator to complete a financial action with no
// human intent. A page-acting op against a sensitive origin must carry an
// explicit { confirmed: true } to proceed.
//
// The floor is deliberately shallow and fails open on unresolved URLs: it is a
// floor, not a gate. Real authority control is the governed lane.

// Hosts and host patterns where money can move. Matched against the tab's host.
export const SENSITIVE_HOST_PATTERNS = [
  /(^|\.)paypal\.com$/i,
  /(^|\.)stripe\.com$/i,
  /(^|\.)checkout\.stripe\.com$/i,
  /(^|\.)venmo\.com$/i,
  /(^|\.)wise\.com$/i,
  /(^|\.)coinbase\.com$/i,
  /(^|\.)binance\.com$/i,
  /(^|\.)cash\.app$/i,
  /(^|\.)squareup\.com$/i,
  // Heuristic fallbacks. Broad on purpose; the cost of a false positive is one
  // extra { confirmed: true }, the cost of a false negative is a real payment.
  /bank/i,
  /(^|\.)pay\./i,
  /checkout\./i,
  /billing\./i,
  /wallet/i,
];

// Ops that can act on page content and therefore submit a form or trigger a
// transaction. Navigation, tab management, screenshots, and reads are not here.
export const PAGE_ACTING_OPS = new Set(['click', 'type', 'press_key', 'evaluate']);

/**
 * Is this URL a money-movement surface?
 * @param {string} url
 * @returns {{ sensitive: boolean, host: string }}
 */
export function isSensitiveOrigin(url) {
  let host = '';
  try {
    host = new URL(url).host;
  } catch {
    return { sensitive: false, host: '' };
  }
  const sensitive = SENSITIVE_HOST_PATTERNS.some((re) => re.test(host));
  return { sensitive, host };
}

/**
 * Decide whether an op may proceed under the thin floor.
 * @param {{ op: string, url: string, params?: { confirmed?: boolean } }} input
 * @returns {{ allow: boolean, reason?: string, message?: string, host?: string }}
 */
export function guardAction({ op, url, params }) {
  if (!PAGE_ACTING_OPS.has(op)) return { allow: true };
  if (params && params.confirmed === true) return { allow: true };
  const { sensitive, host } = isSensitiveOrigin(url);
  if (!sensitive) return { allow: true };
  return {
    allow: false,
    reason: 'sensitive-origin',
    host,
    message: `"${op}" targets a sensitive site (${host}). Re-issue with { confirmed: true } to proceed. This floor applies even in ungoverned mode.`,
  };
}
