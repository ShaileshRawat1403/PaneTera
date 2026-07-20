// src/composer/webLink.ts
// Attaching a public web address as a reference.
//
// A web link in the tray is a *name*, not a capture. PaneTera has not fetched
// the page, read it, or observed it; the user typed an address and PaneTera
// wrote it down. Everything here exists to keep that claim honest:
//
//   - origin is 'user-input', never 'browser-observation';
//   - materialization is 'reference', so no content travels;
//   - freshness is 'not-measured', because nothing was ever measured;
//   - authority stays 'none', as for every context item.
//
// Attaching a link deliberately does not open the preview. Opening a surface is
// an intent (`/open`), and the `+` menu adds context rather than acting.

import { extractWebPreviewRequest, isPublicWebPreviewUrl } from '../utils/webPreviewIntent';

export type WebLinkRejection =
  | 'empty'
  | 'malformed'
  | 'unsupported-scheme'
  | 'credentials-present'
  | 'not-public';

export type WebLinkResult =
  | { ok: true; url: string; label: string }
  | { ok: false; reason: WebLinkRejection };

/**
 * Validate and normalise a typed address.
 *
 * Reuses the public web-preview validator rather than re-deriving the rules, so
 * an address refused as a preview is refused as context by the same logic. The
 * rejection reason is classified here only to explain the refusal; the decision
 * itself belongs to the shared validator.
 */
export function resolveWebLink(input: string): WebLinkResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };

  // Classify before validating so the message can name the actual problem
  // rather than always saying "not a public address".
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    const scheme = trimmed.slice(0, trimmed.indexOf(':')).toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      return { ok: false, reason: 'unsupported-scheme' };
    }
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/\s/.test(trimmed)) {
    return { ok: false, reason: 'unsupported-scheme' };
  }

  // Userinfo is `user@` or `user:pass@` before the host. Matching only the
  // colon form missed `https://user@example.com`, which is still a credential
  // in the address and still must not be attached.
  const afterScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const authority = afterScheme.split(/[/?#]/, 1)[0] ?? '';
  if (authority.includes('@')) {
    return { ok: false, reason: 'credentials-present' };
  }

  const request = extractWebPreviewRequest(trimmed);
  if (!request) {
    // The validator refuses loopback, private ranges, link-local and internal
    // suffixes as well as malformed input. Separate the two so the message says
    // which it was.
    //
    // Classified against the authority rather than the whole string: these
    // patterns are anchored, so `http://127.0.0.1` would not match a `^`-bound
    // dotted-quad test and a refused private address would be reported as
    // malformed.
    const host = authority.replace(/:\d+$/, '');
    const looksAddressLike =
      /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
      /^localhost$/i.test(host) ||
      /^\[[0-9a-f:.]+\]$/i.test(host) ||
      /\.[a-z]{2,}$/i.test(host);
    return { ok: false, reason: looksAddressLike ? 'not-public' : 'malformed' };
  }

  // Belt and braces: the extractor already applies this, but the tray should
  // never receive an address that has not passed the public check directly.
  if (!isPublicWebPreviewUrl(request.url)) return { ok: false, reason: 'not-public' };

  return { ok: true, url: request.url, label: request.name };
}

/** Plain-language explanation for a refused address. */
export function describeWebLinkRejection(reason: WebLinkRejection): string {
  switch (reason) {
    case 'empty':
      return 'Enter a web address.';
    case 'unsupported-scheme':
      return 'Only http and https addresses can be attached.';
    case 'credentials-present':
      return 'Addresses containing a username or password cannot be attached.';
    case 'not-public':
      return 'Only public web addresses can be attached. Local and private addresses are refused.';
    case 'malformed':
    default:
      return 'That does not look like a web address.';
  }
}
