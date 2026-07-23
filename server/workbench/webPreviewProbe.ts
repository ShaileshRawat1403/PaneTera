// server/workbench/webPreviewProbe.ts
//
// Ask a public website, before rendering it, whether it will refuse being shown
// inside PaneTera's canvas.
//
// Why this is server-side: a browser cannot tell you why a cross-origin frame
// failed. Same-origin policy means the page's headers, its document and its
// error state are all unreadable from the embedding side. The frame simply
// renders blank, which is the failure a person saw in Chrome. Reading the
// headers from the server is the only way to know in advance.
//
// What this can and cannot establish is worth stating plainly, because an
// earlier version overclaimed it. A refusal here is authoritative: those headers
// mean the frame will not render. The absence of a refusal is *not* proof that
// it will. A page can still refuse from inside itself through a meta policy or
// a script. So the permissive outcome is named `permitted`, not `framed`, and
// nothing downstream is allowed to read it as "this rendered".

import http from 'http';
import https from 'https';
import { describeWebLinkRejection, resolveWebLink } from '../../src/composer/webLink';
import {
  classifyFramingHeaders,
  type WebPreviewOutcome,
} from '../../src/components/workbench/webPreviewOutcome';
import { describeAddressRefusal, pinnedLookup, resolveSafely } from './addressSafety';

/**
 * Raised from 4s. A real site behind a CDN, on a cold connection, over a slow
 * link, can take longer than four seconds to return headers, and a probe that
 * gives up early reports a working site as unresponsive. This is a header
 * fetch, so the budget can be generous without anyone waiting on a body.
 */
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

/**
 * Plain language for a network failure, covering the codes that actually occur.
 *
 * The previous version handled three and returned `undefined` for everything
 * else, which collapsed every unanticipated failure into an unexplained "did
 * not respond". The fallback now names the code rather than hiding it: a person
 * seeing `ENETUNREACH` at least has something to search for, whereas silence
 * gives them nothing.
 */
function describeNetworkError(error: NodeJS.ErrnoException): string {
  switch (error.code) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return 'the address could not be found';
    case 'ECONNREFUSED':
      return 'the connection was refused';
    case 'ECONNRESET':
      return 'the connection was closed unexpectedly';
    case 'ETIMEDOUT':
    case 'ESOCKETTIMEDOUT':
      return 'the connection timed out';
    case 'ENETUNREACH':
    case 'EHOSTUNREACH':
      return 'the network could not be reached';
    case 'CERT_HAS_EXPIRED':
      return 'the site’s security certificate has expired';
    case 'ERR_TLS_CERT_ALTNAME_INVALID':
      return 'the site’s security certificate did not match its address';
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'SELF_SIGNED_CERT_IN_CHAIN':
      return 'the site’s security certificate is not trusted';
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
      return 'the site’s security certificate could not be verified';
    default:
      return error.code ? `the connection failed (${error.code})` : 'the connection failed';
  }
}

/**
 * Probe a public address.
 *
 * Two independent validations, both required, because this function opens an
 * outbound connection on the user's behalf and is therefore a request-forgery
 * surface if either is missing:
 *
 *   1. `resolveWebLink` refuses the URL text: non-web schemes, embedded
 *      credentials, and literal loopback or private addresses.
 *   2. `resolveSafely` refuses the *destination*: every address the hostname
 *      resolves to is checked, and the connection is pinned to the one that was
 *      validated so a second lookup cannot return something else.
 *
 * Both run again on every redirect hop. A redirect is an attacker-controlled
 * URL, so treating hop two as already-trusted would defeat the checks on hop one.
 */
export async function probeWebPreview(
  rawUrl: string,
  redirectsRemaining = MAX_REDIRECTS,
): Promise<WebPreviewOutcome> {
  const resolved = resolveWebLink(rawUrl);
  if (!resolved.ok) {
    return { kind: 'invalid', detail: describeWebLinkRejection(resolved.reason) };
  }

  if (redirectsRemaining < 0) {
    return { kind: 'unreachable', detail: 'the address redirected too many times' };
  }

  const url = new URL(resolved.url);

  const destination = await resolveSafely(url.hostname);
  if (!destination.safe || !destination.address || !destination.family) {
    return {
      kind: 'invalid',
      detail: describeAddressRefusal(destination.refusal ?? 'unresolvable'),
    };
  }

  // Narrowed once so the pinned lookup below cannot be handed an undefined.
  const destinationAddress = destination.address;
  const destinationFamily = destination.family;
  const client = url.protocol === 'https:' ? https : http;

  return new Promise<WebPreviewOutcome>((resolve) => {
    let settled = false;
    const settle = (outcome: WebPreviewOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    const request = client.get(
      url,
      {
        timeout: TIMEOUT_MS,
        // Pin to the validated address. Node performs no lookup of its own, so
        // the address that was checked is the address that gets connected to.
        lookup: pinnedLookup(destinationAddress, destinationFamily),
        // An explicit minimal allowlist. Incoming headers are never forwarded,
        // so nothing about the user's session reaches a third-party site.
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'PaneTera-Preview-Probe/1.0',
        },
      },
      (response) => {
        // Only the headers matter, and they have all arrived by now. Tear the
        // socket down rather than draining the body: `resume()` downloads the
        // whole response to discard it, which on a large or endless page keeps
        // consuming bandwidth and a socket long after this promise settles.
        const finish = (outcome: WebPreviewOutcome) => {
          response.destroy();
          request.destroy();
          settle(outcome);
        };

        const statusCode = response.statusCode ?? 0;

        if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
          let next: string;
          try {
            next = new URL(response.headers.location, resolved.url).toString();
          } catch {
            return finish({ kind: 'unreachable', detail: 'the redirect was malformed' });
          }
          response.destroy();
          request.destroy();
          // Full re-validation of the new URL and its resolved addresses.
          probeWebPreview(next, redirectsRemaining - 1).then(settle, () =>
            settle({ kind: 'unreachable', detail: 'the redirect could not be followed' }),
          );
          return;
        }

        const refusal = classifyFramingHeaders({
          'x-frame-options': response.headers['x-frame-options'] as string | undefined,
          'content-security-policy': response.headers['content-security-policy'] as
            | string
            | undefined,
        });
        if (refusal) return finish(refusal);

        // A 4xx or 5xx still means the server answered, and the frame will show
        // whatever error page it serves. That is the site's own content, not a
        // PaneTera failure, so it is allowed to render.
        return finish({ kind: 'permitted' });
      },
    );

    request.on('timeout', () => {
      request.destroy();
      console.warn(`[web-preview-probe] timeout after ${TIMEOUT_MS}ms for ${url.hostname}`);
      settle({ kind: 'unreachable', detail: 'the site did not respond in time' });
    });

    request.on('error', (error: NodeJS.ErrnoException) => {
      // The code is logged before it is translated.
      //
      // An earlier version mapped three codes and silently dropped every other
      // one, so any unanticipated failure reached the canvas as a bare "did not
      // respond" with nothing to diagnose it by. That is how a site which
      // demonstrably answers came to be reported as unresponsive, with no way
      // to tell why from either the UI or the logs.
      console.warn(
        `[web-preview-probe] ${url.hostname} failed: ${error.code ?? 'no code'} — ${error.message}`,
      );
      settle({ kind: 'unreachable', detail: describeNetworkError(error) });
    });
  });
}
