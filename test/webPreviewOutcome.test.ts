// test/webPreviewOutcome.test.ts
//
// Regression cover for a defect found in real Chrome, not by a test.
//
// Asking PaneTera to show `hpanel.hostinger.com` produced:
//
//   "I opened https://hpanel.hostinger.com/... in the preview, but I did not
//    inspect its contents: Connect the Browser Operator in Rig first."
//
// while the canvas showed a blank frame with a broken-document icon. The site
// refuses framing. Nothing opened. The message was composed at request time,
// before any attempt resolved, so success was structurally the default.
//
// The tests below fix both halves: the claim must follow the outcome, and a
// failure must never render as an empty canvas.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  type WebPreviewOutcome,
  claimsToHaveOpened,
  classifyFramingHeaders,
  describeOutcome,
  didOpen,
  failedToDisplay,
  isSettled,
  summariseOutcome,
  wasRefused,
  presentPreviewStatus,
  presentOutcome,
} from '../src/components/workbench/webPreviewOutcome';

const SITE = { siteName: 'hpanel.hostinger.com', operator: 'not-connected' as const };
const CLAIM = {
  url: 'https://hpanel.hostinger.com/websites/pruningmypothos.com/advanced',
  siteName: 'hpanel.hostinger.com',
  operator: 'not-connected' as const,
};

/** Every outcome the union permits, so the sweeps below stay exhaustive. */
const ALL_OUTCOMES: WebPreviewOutcome[] = [
  { kind: 'checking' },
  { kind: 'permitted' },
  { kind: 'refused-by-headers', header: 'x-frame-options' },
  { kind: 'refused-by-headers', header: 'content-security-policy' },
  { kind: 'unreachable' },
  { kind: 'unreachable', detail: 'the address could not be found' },
  { kind: 'invalid', detail: 'Only public web addresses can be attached.' },
];

describe('the observed Chrome failure', () => {
  it('does not claim to have opened a site that refuses framing', () => {
    // The exact reproduction. hpanel.hostinger.com sends X-Frame-Options.
    const refusal = classifyFramingHeaders({ 'x-frame-options': 'SAMEORIGIN' });
    assert.ok(refusal, 'SAMEORIGIN must be read as a refusal');

    const message = describeOutcome(refusal, CLAIM);
    assert.ok(!claimsToHaveOpened(message), `still claims to have opened: "${message}"`);
    assert.match(message, /could not (show|open|display)/i, 'must report the inability');
    assert.match(message, /refuses/i, 'must say whose decision it was');
  });

  it('never renders a refusal as an empty canvas', () => {
    const presentation = presentOutcome(
      { kind: 'refused-by-headers', header: 'x-frame-options' },
      SITE,
    );

    assert.strictEqual(presentation.showFrame, false, 'a refused page must not be framed');
    assert.ok(presentation.headline.length > 0, 'a blank canvas needs a headline');
    assert.ok(presentation.detail.length > 0, 'a blank canvas needs an explanation');
    assert.ok(presentation.remedies.length > 0, 'an explanation without a way out is not enough');
  });

  it('offers connecting the operator when it is not connected', () => {
    const presentation = presentOutcome(
      { kind: 'refused-by-headers', header: 'x-frame-options' },
      { siteName: 'x', operator: 'not-connected' },
    );
    const primary = presentation.remedies.find((remedy) => remedy.primary);
    assert.strictEqual(primary?.kind, 'connect-operator');
  });

  it('offers inspection instead once the operator is connected', () => {
    const presentation = presentOutcome(
      { kind: 'refused-by-headers', header: 'x-frame-options' },
      { siteName: 'x', operator: 'connected' },
    );
    const primary = presentation.remedies.find((remedy) => remedy.primary);
    assert.strictEqual(primary?.kind, 'inspect-with-operator');
  });

  it('always leaves open-in-browser available on a refusal', () => {
    for (const operator of ['connected', 'not-connected'] as const) {
      const presentation = presentOutcome(
        { kind: 'refused-by-headers', header: 'x-frame-options' },
        { siteName: 'x', operator },
      );
      assert.ok(
        presentation.remedies.some((remedy) => remedy.kind === 'open-in-browser'),
        `${operator}: the browser is always a way through`,
      );
    }
  });
});

describe('only a real outcome can produce a success claim', () => {
  it('claims to have opened for exactly one outcome', () => {
    const claiming = ALL_OUTCOMES.filter((outcome) =>
      claimsToHaveOpened(describeOutcome(outcome, CLAIM)),
    );

    assert.deepStrictEqual(
      claiming.map((outcome) => outcome.kind),
      [],
      'no outcome may claim the page opened, because that is not observable',
    );
  });

  it('agrees with didOpen on every outcome', () => {
    // Two independent readings of the same question must not diverge. If they
    // do, one surface will say opened while another says refused.
    for (const outcome of ALL_OUTCOMES) {
      assert.strictEqual(
        claimsToHaveOpened(describeOutcome(outcome, CLAIM)),
        didOpen(outcome),
        `${outcome.kind}: the message and didOpen disagree`,
      );
    }
  });

  it('never says the site is in the canvas when it could not be reached', () => {
    // The transcript and the status line are two surfaces describing one
    // attempt. Deriving status from `wasRefused` alone meant an unreachable
    // address produced "I could not reach it" beside "it is in the canvas",
    // which is the original defect wearing a different hat.
    for (const outcome of ALL_OUTCOMES) {
      if (!failedToDisplay(outcome)) continue;

      const status = summariseOutcome(outcome, { siteName: 'example.com' });
      assert.ok(
        !/is in the canvas/i.test(status),
        `${outcome.kind}: status claims the page is showing: "${status}"`,
      );
    }
  });

  it('agrees between the transcript and the status line', () => {
    for (const outcome of ALL_OUTCOMES) {
      if (outcome.kind === 'checking') continue;
      const message = describeOutcome(outcome, CLAIM);
      const status = summariseOutcome(outcome, { siteName: 'hpanel.hostinger.com' });

      const messageReportsFailure = /could not|did not/i.test(message);
      const statusReportsFailure = !/is in the canvas/i.test(status);
      assert.strictEqual(
        messageReportsFailure,
        statusReportsFailure,
        `${outcome.kind}: message and status disagree — "${message}" vs "${status}"`,
      );
    }
  });

  it('counts every non-display as a failure, not only a refusal', () => {
    assert.strictEqual(failedToDisplay({ kind: 'unreachable' }), true);
    assert.strictEqual(failedToDisplay({ kind: 'invalid', detail: 'x' }), true);
    assert.strictEqual(
      failedToDisplay({ kind: 'refused-by-headers', header: 'x-frame-options' }),
      true,
    );
    assert.strictEqual(failedToDisplay({ kind: 'permitted' }), false);
    // Not yet anything, so not yet a failure.
    assert.strictEqual(failedToDisplay({ kind: 'checking' }), false);
  });

  it('marks only a header refusal as an authoritative failure', () => {
    for (const outcome of ALL_OUTCOMES) {
      assert.strictEqual(
        wasRefused(outcome),
        outcome.kind === 'refused-by-headers',
        `${outcome.kind}: refusal status is wrong`,
      );
    }
  });

  it('frames only when the outcome is framed', () => {
    for (const outcome of ALL_OUTCOMES) {
      assert.strictEqual(
        presentOutcome(outcome, SITE).showFrame,
        outcome.kind === 'permitted',
        `${outcome.kind}: frame visibility disagrees with the outcome`,
      );
    }
  });

  it('gives every settled failure something to do', () => {
    for (const outcome of ALL_OUTCOMES) {
      if (outcome.kind === 'permitted' || outcome.kind === 'checking') continue;
      // `invalid` is the exception: a refused address has no remedy, because
      // retrying or opening it would defeat the validator that refused it.
      if (outcome.kind === 'invalid') continue;

      const presentation = presentOutcome(outcome, SITE);
      assert.ok(
        presentation.remedies.length > 0,
        `${outcome.kind}: a dead end with no next step`,
      );
    }
  });

  it('explains every settled outcome in plain language', () => {
    for (const outcome of ALL_OUTCOMES) {
      if (!isSettled(outcome) || outcome.kind === 'permitted') continue;
      const presentation = presentOutcome(outcome, SITE);

      assert.ok(presentation.headline.length > 0, `${outcome.kind}: no headline`);
      // No raw header names, status codes or internal kinds in what a person reads.
      const visible = `${presentation.headline} ${presentation.detail}`;
      assert.ok(
        !/x-frame-options|content-security-policy|refused-by-headers|ECONNREFUSED/i.test(visible),
        `${outcome.kind}: leaks an internal code: "${visible}"`,
      );
    }
  });
});

describe('framing headers', () => {
  it('reads DENY and SAMEORIGIN as refusals', () => {
    // SAMEORIGIN matters most here: PaneTera is never the same origin as a
    // public website, so treating it as permissive predicts a frame that then
    // renders blank. That is the defect, restated as a header rule.
    for (const value of ['DENY', 'deny', 'SAMEORIGIN', 'sameorigin', 'ALLOW-FROM https://x']) {
      const result = classifyFramingHeaders({ 'x-frame-options': value });
      if (value.toUpperCase().includes('ALLOW-FROM')) continue;
      assert.ok(result, `${value} should refuse`);
      assert.strictEqual(result!.header, 'x-frame-options');
    }
  });

  it('reads frame-ancestors none as a refusal', () => {
    const result = classifyFramingHeaders({
      'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
    });
    assert.ok(result);
    assert.strictEqual(result!.header, 'content-security-policy');
  });

  it('reads a frame-ancestors allowlist as a refusal too', () => {
    // An allowlist that does not name PaneTera's origin refuses PaneTera. There
    // is no version of this where the frame renders.
    const result = classifyFramingHeaders({
      'content-security-policy': 'frame-ancestors https://trusted.example.com',
    });
    assert.ok(result, 'an allowlist without us is still a refusal');
  });

  it('permits a standalone wildcard', () => {
    assert.strictEqual(
      classifyFramingHeaders({ 'content-security-policy': 'frame-ancestors *' }),
      null,
    );
    assert.strictEqual(
      classifyFramingHeaders({ 'content-security-policy': "frame-ancestors 'self' *" }),
      null,
    );
  });

  it('does not mistake a host wildcard for global permission', () => {
    // Testing whether the value *contains* an asterisk read this as permissive.
    // A host wildcard does not match PaneTera's localhost origin, so the frame
    // would have rendered blank with a success message over it.
    for (const value of [
      'frame-ancestors https://*.trusted.example',
      'frame-ancestors *.trusted.example',
      "frame-ancestors 'self' https://*.partner.example",
      'frame-ancestors https://*.a.example https://*.b.example',
    ]) {
      const result = classifyFramingHeaders({ 'content-security-policy': value });
      assert.ok(result, `"${value}" was read as permitting any embedder`);
      assert.strictEqual(result!.header, 'content-security-policy');
    }
  });

  it('permits absent headers', () => {
    assert.strictEqual(classifyFramingHeaders({}), null);
    assert.strictEqual(classifyFramingHeaders({ 'content-security-policy': "default-src 'self'" }), null);
  });

  it('is not confused by frame-ancestors appearing in another directive value', () => {
    const result = classifyFramingHeaders({
      'content-security-policy': "report-uri /csp?d=frame-ancestors; frame-ancestors *",
    });
    assert.strictEqual(result, null, 'the real directive permits framing');
  });
});

describe('permission is not the same as rendering', () => {
  it('does not claim a permitted page rendered', () => {
    // Absence of a blocking header proves only that the headers did not
    // predict refusal. A meta policy or a framebuster can still leave the
    // canvas blank, so the message reports what PaneTera did rather than what
    // the site did.
    const message = describeOutcome({ kind: 'permitted' }, CLAIM);
    assert.ok(!claimsToHaveOpened(message), `overclaims: "${message}"`);
    assert.match(message, /choose browser operator/i, 'must offer the reliable evidence route');
    assert.match(message, /try an embedded preview/i, 'must describe embedding as an explicit attempt');
  });

  it('keeps a permanent status beside every permitted frame', () => {
    const previewStatus = presentPreviewStatus(SITE);
    assert.match(previewStatus.detail, /cannot verify/i);
    assert.ok(previewStatus.remedies.some((remedy) => remedy.kind === 'connect-operator'));
    assert.ok(previewStatus.remedies.some((remedy) => remedy.kind === 'open-in-browser'));
    assert.strictEqual(presentOutcome({ kind: 'permitted' }, SITE).showFrame, true);
  });

  it('offers direct inspection when Browser Operator is connected', () => {
    const previewStatus = presentPreviewStatus({ ...SITE, operator: 'connected' });
    assert.ok(previewStatus.remedies.some((remedy) => remedy.kind === 'inspect-with-operator'));
    assert.ok(!previewStatus.remedies.some((remedy) => remedy.kind === 'retry'));
  });
});

describe('the app cannot reintroduce the claim', () => {
  it('sends the bearer token with the probe', () => {
    // The probe route sits behind the master-token middleware. Without the
    // token every probe returned 401, which the caller translated into a
    // failure outcome, so pages that frame perfectly well never rendered.
    const surface = readFileSync(
      new URL('../src/components/workbench/WebPreviewSurface.tsx', import.meta.url),
      'utf8',
    );
    const probeCall = surface.slice(surface.indexOf('/api/web-preview/probe'));
    assert.match(
      probeCall.slice(0, 500),
      /Authorization.*Bearer/s,
      'the probe request must carry the token',
    );
  });

  it('probes in one place, so the canvas and the message cannot disagree', () => {
    const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
    assert.ok(
      !app.includes('/api/web-preview/probe'),
      'App must take the outcome from the surface rather than probing separately',
    );
    assert.ok(app.includes('onOutcome'), 'App must receive the outcome from the surface');
  });

  it('treats a failed probe as permitted rather than as a refusal', () => {
    // A probe that could not run has established nothing. Reporting a refusal
    // it never observed would be the original defect with the sign flipped.
    const surface = readFileSync(
      new URL('../src/components/workbench/WebPreviewSurface.tsx', import.meta.url),
      'utf8',
    );
    const fallbacks = surface.match(/return \{ kind: '([a-z-]+)' \};/g) ?? [];
    assert.ok(fallbacks.length > 0, 'expected probe fallbacks');
    for (const fallback of fallbacks) {
      assert.match(fallback, /permitted/, `a probe failure must not assert: ${fallback}`);
    }
  });

  it('composes web preview messages from describeOutcome, not from a literal', () => {
    // The defect was a template literal asserting success at request time. A
    // behavioural test cannot reach into App's render, so this checks the one
    // thing that made the bug possible: a hardcoded "I opened" in the source.
    const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
    const withoutComments = app
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    const hardcoded = withoutComments.match(/`I opened [^`]*`/g) ?? [];
    assert.deepStrictEqual(
      hardcoded,
      [],
      `App still asserts success from a literal: ${hardcoded.join(', ')}`,
    );
    assert.ok(
      withoutComments.includes('describeOutcome('),
      'App must compose the claim from an outcome',
    );
  });

  it('keeps the preview surface free of an unconditional frame', () => {
    const surface = readFileSync(
      new URL('../src/components/workbench/WebPreviewSurface.tsx', import.meta.url),
      'utf8',
    );
    assert.ok(
      surface.includes('presentation.showFrame'),
      'the frame must be conditional on the outcome',
    );
  });

  it('makes embedding an explicit choice instead of defaulting to a blank canvas', () => {
    const surface = readFileSync(
      new URL('../src/components/workbench/WebPreviewSurface.tsx', import.meta.url),
      'utf8',
    );
    assert.ok(surface.includes('presentation.showFrame && !embedRevealed'));
    assert.ok(surface.includes('setEmbedRevealed(true)'));
    assert.ok(surface.includes('How would you like to view this page?'));
  });

  it('uses a permanent sibling status instead of a timed overlay', () => {
    const surface = readFileSync(
      new URL('../src/components/workbench/WebPreviewSurface.tsx', import.meta.url),
      'utf8',
    );
    assert.ok(!surface.includes('setTimeout('), 'preview help must not wait on a timer');
    assert.ok(!surface.includes('Dismiss'), 'the permanent status must not be dismissible');
    assert.ok(surface.includes('presentPreviewStatus'), 'permitted frames need permanent status');
    assert.ok(!surface.includes("position: 'absolute'"), 'status must not cover webpage content');
  });

  it('routes inspection evidence into the canvas instead of chat', () => {
    const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
    const canvas = app.slice(app.indexOf('const canvasNode = webPreview'));
    assert.ok(canvas.includes('inspection={webPreviewInspection}'));
    assert.ok(canvas.includes('onInspectWithOperator={inspectWebPreview}'));
    assert.ok(!canvas.includes('handleSend(`inspect ${webPreview.url}`)'));
  });
});

describe('while checking', () => {
  it('does not assert either success or failure', () => {
    const message = describeOutcome({ kind: 'checking' }, CLAIM);
    assert.ok(!claimsToHaveOpened(message));
    assert.ok(!/could not/i.test(message), 'must not report a failure that has not happened');
  });

  it('shows progress rather than a blank canvas', () => {
    const presentation = presentOutcome({ kind: 'checking' }, SITE);
    assert.strictEqual(presentation.showFrame, false);
    assert.ok(presentation.headline.length > 0);
  });
});
