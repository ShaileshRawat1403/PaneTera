// src/components/workbench/webPreviewOutcome.ts
//
// What PaneTera actually established when it tried to show a public web page,
// and what it is allowed to say about it.
//
// This exists because of a defect found in real Chrome. Asking PaneTera to show
// `hpanel.hostinger.com` produced "I opened <url> in the preview" while the
// canvas showed a blank frame with a broken-document icon. The site refuses
// framing. Nothing had opened. The claim was composed at request time, before
// any attempt resolved, so success was structurally the default.
//
// The first fix replaced that with a header probe, and then overclaimed in a
// subtler way: absence of a blocking header became `framed`, which downstream
// read as "it rendered". It does not mean that. Headers can permit framing
// while the page refuses from inside itself through a meta policy or a script.
//
// Hence the vocabulary here, which is the whole point of the module:
//
//   refused-by-headers  authoritative. The frame will not render.
//   permitted           headers do not refuse. Says nothing about rendering.
//
// There is deliberately no outcome meaning "confirmed rendered", because from
// inside an embedding page that fact is not observable across origins. Rather
// than infer it, PaneTera does not claim it. What it claims instead is the
// thing it genuinely did: it placed the page in the canvas.

/** What a probe established. */
export type WebPreviewOutcome =
  /** No attempt has resolved yet. */
  | { kind: 'checking' }
  /**
   * Headers do not refuse framing.
   *
   * Not a promise that the page rendered. Named `permitted` rather than
   * `framed` so that nothing downstream can read it as one.
   */
  | { kind: 'permitted' }
  /** The site's headers refuse embedding. Authoritative. */
  | { kind: 'refused-by-headers'; header: 'x-frame-options' | 'content-security-policy' }
  /** The address did not respond. */
  | { kind: 'unreachable'; detail?: string }
  /** The address, or the destination it resolved to, was refused before dialling. */
  | { kind: 'invalid'; detail: string };

/** Whether Browser Operator can be offered as a way through. */
export type OperatorAvailability = 'connected' | 'not-connected';

export interface PreviewRemedy {
  label: string;
  kind: 'open-in-browser' | 'inspect-with-operator' | 'connect-operator' | 'retry';
  primary: boolean;
}

export interface PreviewPresentation {
  headline: string;
  detail: string;
  remedies: PreviewRemedy[];
  /** Whether the frame should be rendered at all. */
  showFrame: boolean;
}

/** Did we establish that the page rendered? Never, and that is on purpose. */
export function didOpen(_outcome: WebPreviewOutcome): false {
  return false;
}

/** Did the headers refuse? A site's explicit decision, distinct from a failure to reach it. */
export function wasRefused(outcome: WebPreviewOutcome): boolean {
  return outcome.kind === 'refused-by-headers';
}

/**
 * Did the page fail to appear, for any reason?
 *
 * Distinct from `wasRefused`, and this distinction was a defect before it was a
 * function. Status was derived from `wasRefused` alone, so an unreachable or
 * invalid address produced a transcript line saying PaneTera could not open the
 * page beside a status line saying the site was in the canvas. Two surfaces
 * describing the same attempt in opposite terms is the original bug wearing a
 * different hat.
 *
 * `checking` is not a failure. It is not anything yet.
 */
export function failedToDisplay(outcome: WebPreviewOutcome): boolean {
  return (
    outcome.kind === 'refused-by-headers' ||
    outcome.kind === 'unreachable' ||
    outcome.kind === 'invalid'
  );
}

/**
 * The short status line for an attempt.
 *
 * Derived from the same outcome as the transcript message, so the two cannot
 * disagree.
 */
export function summariseOutcome(
  outcome: WebPreviewOutcome,
  context: { siteName: string },
): string {
  switch (outcome.kind) {
    case 'checking':
      return `Opening ${context.siteName}…`;
    case 'permitted':
      return `${context.siteName} is in the canvas, ready to view.`;
    case 'refused-by-headers':
      return `${context.siteName} refuses to be displayed here.`;
    case 'unreachable':
      return `Could not reach ${context.siteName}.`;
    case 'invalid':
      return `${context.siteName} was refused.`;
  }
}

/** Is this a settled result, or still in flight? */
export function isSettled(outcome: WebPreviewOutcome): boolean {
  return outcome.kind !== 'checking';
}

/**
 * Classify framing headers.
 *
 * `SAMEORIGIN` counts as refusal because PaneTera is never the same origin as a
 * public website. Treating it as permissive would predict a frame that then
 * renders blank, which is the original defect restated as a header rule.
 */
export function classifyFramingHeaders(headers: {
  'x-frame-options'?: string;
  'content-security-policy'?: string;
}): Extract<WebPreviewOutcome, { kind: 'refused-by-headers' }> | null {
  const xFrame = (headers['x-frame-options'] ?? '').toUpperCase();
  if (xFrame.includes('DENY') || xFrame.includes('SAMEORIGIN')) {
    return { kind: 'refused-by-headers', header: 'x-frame-options' };
  }

  const csp = (headers['content-security-policy'] ?? '').toLowerCase();
  const ancestors = /frame-ancestors\s+([^;]*)/.exec(csp);
  if (ancestors) {
    // Only a source that is exactly `*` permits any embedder. Testing whether
    // the value *contains* an asterisk read `frame-ancestors https://*.example`
    // as global permission, when a host wildcard does not match PaneTera's
    // localhost origin at all and still yields a blank frame.
    //
    // Every other value is an allowlist that will not name PaneTera, so it
    // refuses. Erring this way costs a degraded state with remedies on a page
    // that might have framed; erring the other way costs a blank canvas, which
    // is the defect this module exists for.
    const sources = ancestors[1].trim().split(/\s+/).filter(Boolean);
    const permitsAnyEmbedder = sources.includes('*');
    if (!permitsAnyEmbedder) {
      return { kind: 'refused-by-headers', header: 'content-security-policy' };
    }
  }

  return null;
}

function remediesFor(operator: OperatorAvailability, includeRetry: boolean): PreviewRemedy[] {
  const operatorRemedy: PreviewRemedy =
    operator === 'connected'
      ? { label: 'Inspect with Browser Operator', kind: 'inspect-with-operator', primary: true }
      : { label: 'Connect Browser Operator in Rig', kind: 'connect-operator', primary: true };

  const remedies: PreviewRemedy[] = [
    operatorRemedy,
    { label: 'Open in browser', kind: 'open-in-browser', primary: false },
  ];
  if (includeRetry) remedies.push({ label: 'Try again', kind: 'retry', primary: false });
  return remedies;
}

/**
 * How to present an outcome.
 *
 * Every failing branch returns at least one remedy. A degraded state that
 * explains the problem and offers nothing is only marginally better than the
 * blank frame it replaced.
 */
export function presentOutcome(
  outcome: WebPreviewOutcome,
  context: { siteName: string; operator: OperatorAvailability },
): PreviewPresentation {
  switch (outcome.kind) {
    case 'checking':
      return {
        headline: 'Checking the address',
        detail: `Finding out whether ${context.siteName} can be shown here.`,
        remedies: [],
        showFrame: false,
      };

    case 'permitted':
      return { headline: '', detail: '', remedies: [], showFrame: true };

    case 'refused-by-headers':
      return {
        headline: 'This site refuses to be embedded',
        detail:
          `${context.siteName} tells browsers not to display it inside another page, ` +
          'so it cannot be shown in the canvas. This is the site’s decision, not a fault ' +
          'in PaneTera or in the address.',
        remedies: remediesFor(context.operator, false),
        showFrame: false,
      };

    case 'unreachable':
      return {
        headline: 'Could not reach this address',
        detail: outcome.detail
          ? `${context.siteName} did not respond: ${outcome.detail}.`
          : `${context.siteName} did not respond.`,
        remedies: [
          { label: 'Try again', kind: 'retry', primary: true },
          { label: 'Open in browser', kind: 'open-in-browser', primary: false },
        ],
        showFrame: false,
      };

    case 'invalid':
      return {
        headline: 'This address was refused',
        detail: `${outcome.detail}, so PaneTera did not open it.`,
        remedies: [],
        showFrame: false,
      };
  }
}

/**
 * What to offer over a frame that may be showing nothing.
 *
 * Phrased as an explicit limit rather than a finding about the page, because
 * PaneTera does not know whether the frame rendered. Claiming a refusal it has
 * not observed would be the original defect with the sign flipped.
 */
export function presentPreviewStatus(
  context: { siteName: string; operator: OperatorAvailability },
): { detail: string; remedies: PreviewRemedy[] } {
  return {
    detail:
      `PaneTera cannot verify whether ${context.siteName} rendered in this cross-origin frame. ` +
      'Use Browser Operator for readable, approval-gated evidence.',
    remedies: remediesFor(context.operator, false),
  };
}

/**
 * What the assistant is permitted to say.
 *
 * Note what the permitted case does *not* say. It reports that the page was
 * placed in the canvas, which PaneTera did and can verify, rather than that the
 * page opened, which it cannot. The difference looks pedantic until a site
 * refuses from inside itself and the canvas is blank underneath the sentence.
 */
export function describeOutcome(
  outcome: WebPreviewOutcome,
  context: { url: string; siteName: string; operator: OperatorAvailability },
): string {
  switch (outcome.kind) {
    case 'checking':
      return `Opening ${context.url}…`;

    case 'permitted':
      return (
        `I prepared ${context.url} in the canvas as an untrusted web source. ` +
        'I have not read its contents. Choose Browser Operator for readable evidence, ' +
        'try an embedded preview, or open it in your browser.'
      );

    case 'refused-by-headers':
      return (
        `I could not show ${context.url} in the preview: the site refuses to be displayed ` +
        'inside another page. ' +
        (context.operator === 'connected'
          ? 'I can inspect it with Browser Operator instead, or you can open it in your browser.'
          : 'Connect Browser Operator in Rig to inspect it, or open it in your browser.')
      );

    case 'unreachable':
      return `I could not reach ${context.url}${outcome.detail ? `: ${outcome.detail}` : ''}.`;

    case 'invalid':
      return `I did not open ${context.url}: ${outcome.detail}.`;
  }
}

/**
 * Guard for the specific regression this module exists for.
 *
 * Matches any assertion that the page opened or was displayed, so the claim and
 * the outcome can be checked against each other in a test rather than only by
 * reading the code.
 */
export function claimsToHaveOpened(message: string): boolean {
  return /\bI (opened|displayed|loaded|showed)\b/.test(message);
}
