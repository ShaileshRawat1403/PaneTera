// server/redactionPolicy.ts
//
// The single canonical answer to "is this query parameter sensitive?".
//
// This policy had drifted into copies: the browser envelope sanitiser, the
// headroom locator redactor, the frontend evidence surface, and the audit
// scrubber each carried their own list, and they disagreed. The audit copy
// missed a bare `key`, which the authoritative browser sanitiser has always
// treated as sensitive, so a `?key=…` credential survived into audit records.
//
// Two rules, because one is not enough. Most names are caught by substring, so a
// prefixed or suffixed form is still sensitive: `key` covers `api_key` and
// `x-api-key`, `token` covers `access_token`, `signature` covers
// `X-Amz-Signature`. But two names are too short and too common to match
// anywhere: `code` would swallow `zipcode` and `language_code`, and `sig` would
// swallow `design` and `signal`. Those are matched exactly instead, so a signed
// link's `?code=` and `?sig=` are caught while an ordinary field is not.
//
// The substring set is a superset of the previous authoritative list, so nothing
// that was redacted before is permitted now; the change only widens what is
// caught.

export const SENSITIVE_SUBSTRINGS: readonly string[] = [
  'token',
  'key',
  'auth',
  'secret',
  'password',
  'passwd',
  'pwd',
  'credential',
  'session',
  'cookie',
  'bearer',
  'signature',
];

/**
 * Ambiguous short names, matched exactly rather than as substrings.
 *
 * These are query-parameter concepts (an OAuth authorization code, a request
 * signature), so they classify query names, not arbitrary object keys where a
 * `code` is far more likely to be a benign status.
 */
export const SENSITIVE_EXACT_QUERY: readonly string[] = ['code', 'sig'];

/** Whether a URL query parameter name should have its value redacted. */
export function isSensitiveParamName(name: string): boolean {
  const lowered = name.toLowerCase();
  if (SENSITIVE_SUBSTRINGS.some((candidate) => lowered.includes(candidate))) return true;
  return SENSITIVE_EXACT_QUERY.includes(lowered);
}

/**
 * Whether an audit object key's value should be redacted.
 *
 * Deliberately narrower than the query rule: it uses only the substring set, not
 * the exact query names, so an audit field called `code` or `status_code`
 * survives while a `password` or `apiKey` field does not.
 */
export function isSensitiveObjectKey(name: string): boolean {
  const lowered = name.toLowerCase();
  return SENSITIVE_SUBSTRINGS.some((candidate) => lowered.includes(candidate));
}
