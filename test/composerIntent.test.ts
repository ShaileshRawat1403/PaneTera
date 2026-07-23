// test/composerIntent.test.ts
// Proves the composer's central invariant: slash and natural language are two
// doors onto one resolver, not two routers.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  resolveIntent as resolveWithContext,
  DEFAULT_RESOLVER_CONTEXT,
} from '../src/composer/intentResolver';
import type { ResolverContext } from '../src/composer/intentResolver';
import { intentDecision } from '../src/composer/intentTypes';
import { filterSlashCommands, parseSlashInput, SLASH_COMMANDS } from '../src/composer/slashCommands';

/**
 * These suites test resolution, not capability gating. A consumer that supports
 * everything isolates the behaviour under test; capability gating has its own
 * coverage in composerSubmission.test.ts.
 */
const FULL: ResolverContext = {
  ...DEFAULT_RESOLVER_CONTEXT,
  supportedCapabilities: [
    'converse',
    'project',
    'web-surface',
    'live-app',
    'artifact',
    'evidence',
    'run',
    'proposal',
    'rig',
    'headroom',
  ],
};

function resolveIntent(input: string, context: ResolverContext = FULL) {
  return resolveWithContext(input, context);
}

describe('slash and natural language equivalence', () => {
  // Each pair is (slash form, natural form) for a family listed in
  // DUAL_DOOR_FAMILIES. Families absent from that list are slash-only by
  // design, and the contract says so rather than implying a symmetry that does
  // not exist.
  const dualDoorPairs: Array<[string, string, string]> = [
    ['web-surface', '/open https://example.com', 'open https://example.com'],
    ['run', '/run tests', 'run tests'],
    ['project', '/project PaneTera', 'open the project PaneTera'],
    ['artifact', '/inspect App.tsx', 'inspect App.tsx'],
  ];

  for (const [family, slashForm, naturalForm] of dualDoorPairs) {
    it(`produces identical decisions for ${family}`, () => {
      const slash = resolveIntent(slashForm);
      const natural = resolveIntent(naturalForm);

      assert.strictEqual(slash.family, family);
      assert.deepStrictEqual(
        intentDecision(slash),
        intentDecision(natural),
        `${slashForm} and ${naturalForm} must decide identically`,
      );
    });
  }

  it('produces identical decisions for /open <url> and open <url>', () => {
    const slash = resolveIntent('/open https://example.com');
    const natural = resolveIntent('open https://example.com');

    assert.deepStrictEqual(intentDecision(slash), intentDecision(natural));
  });

  it('differs only in assertedBy, confidence, and rawInput', () => {
    const slash = resolveIntent('/open https://example.com');
    const natural = resolveIntent('open https://example.com');

    assert.strictEqual(slash.assertedBy, 'user-slash');
    assert.strictEqual(natural.assertedBy, 'deterministic-matcher');
    assert.strictEqual(slash.confidence, null);
    assert.notStrictEqual(natural.confidence, null);
    assert.notStrictEqual(slash.rawInput, natural.rawInput);
  });

  it('normalises URLs identically through both doors', () => {
    const slash = resolveIntent('/open example.com');
    const natural = resolveIntent('open example.com');

    assert.strictEqual(slash.args.url, 'https://example.com/');
    assert.deepStrictEqual(intentDecision(slash), intentDecision(natural));
  });

  it('rejects credential-bearing URLs through both doors', () => {
    const slash = resolveIntent('/open https://user:pass@example.com');
    const natural = resolveIntent('open https://user:pass@example.com');

    assert.strictEqual(slash.args.url, undefined);
    assert.strictEqual(natural.args.url, undefined);
    // The slash form still asserts the family, so it asks for a URL rather than
    // silently degrading to conversation.
    assert.strictEqual(slash.family, 'web-surface');
    assert.strictEqual(slash.readiness, 'needs-context');
  });
});

describe('slash asserts family, never readiness', () => {
  it('keeps /run at needs-approval', () => {
    const envelope = resolveIntent('/run tests');
    assert.strictEqual(envelope.family, 'run');
    assert.strictEqual(envelope.readiness, 'needs-approval');
    assert.ok(envelope.missing.some((requirement) => requirement.kind === 'approval'));
  });

  it('never returns ready for a run, whatever the argument', () => {
    for (const input of ['/run tests', '/run npm test', '/run anything at all']) {
      assert.notStrictEqual(resolveIntent(input).readiness, 'ready');
    }
  });

  it('asks the smallest useful clarification when an argument is missing', () => {
    const envelope = resolveIntent('/open');
    assert.strictEqual(envelope.family, 'web-surface');
    assert.strictEqual(envelope.readiness, 'needs-context');
    assert.deepStrictEqual(
      envelope.missing.map((requirement) => requirement.kind),
      ['url'],
    );
  });

  it('does not turn a missing URL into a workspace error', () => {
    const envelope = resolveIntent('/open', { ...FULL, hasWorkspace: true });
    assert.strictEqual(envelope.family, 'web-surface');
    assert.notStrictEqual(envelope.family, 'artifact');
  });
});

describe('honest degraded states', () => {
  it('reports needs-capability for surfaces the consumer cannot handle', () => {
    // Resolved against a consumer that supports only conversation, which is
    // what "the surface does not exist yet" actually means now.
    const conversationOnly: ResolverContext = {
      ...DEFAULT_RESOLVER_CONTEXT,
      supportedCapabilities: ['converse'],
    };
    for (const input of ['/evidence', '/rig', '/run tests', '/open Soothsayer']) {
      const envelope = resolveIntent(input, conversationOnly);
      assert.strictEqual(envelope.readiness, 'needs-capability', input);
      assert.strictEqual(envelope.surface, null, input);
    }
  });

  it('routes an unknown slash command to conversational help, not a new family', () => {
    const envelope = resolveIntent('/nonsense');
    assert.strictEqual(envelope.family, 'converse');
    assert.strictEqual(envelope.args.action, 'help');
    assert.strictEqual(envelope.assertedBy, 'user-slash');
  });

  it('routes a non-URL /open argument to a registered application', () => {
    // `/open` covers registered applications too, so an application name must
    // not be reported as a missing URL.
    const envelope = resolveIntent('/open Soothsayer');
    assert.strictEqual(envelope.family, 'live-app');
    assert.strictEqual(envelope.args.target, 'Soothsayer');
    // Ready here because FULL declares live-app support. Against a consumer
    // without it, the same input is needs-capability.
    assert.strictEqual(envelope.readiness, 'ready');
  });

  it('opens a registered live preview from ordinary language', () => {
    const envelope = resolveIntent('start live preview for Soothsayer');
    assert.strictEqual(envelope.family, 'live-app');
    assert.strictEqual(envelope.args.target, 'Soothsayer');
    assert.strictEqual(envelope.readiness, 'ready');
  });

  it('asks which application when a live preview request has no target', () => {
    const envelope = resolveIntent('open live preview');
    assert.strictEqual(envelope.family, 'live-app');
    assert.strictEqual(envelope.readiness, 'needs-clarification');
  });

  it('reports nothing to clear when the tray is empty', () => {
    const envelope = resolveIntent('/clear-context');
    assert.strictEqual(envelope.family, 'headroom');
    assert.strictEqual(envelope.readiness, 'needs-context');
  });

  it('is ready to clear when context exists', () => {
    const envelope = resolveIntent('/clear-context', {
      ...FULL,
      includedContextCount: 2,
    });
    assert.strictEqual(envelope.readiness, 'ready');
    assert.strictEqual(envelope.args.action, 'clear');
  });
});

describe('slash parsing and filtering', () => {
  it('treats a bare slash as an incomplete token', () => {
    const parsed = parseSlashInput('/');
    assert.deepStrictEqual(parsed, { name: '', rest: '', complete: false });
  });

  it('marks the token settled once a space follows', () => {
    assert.strictEqual(parseSlashInput('/open ')?.complete, true);
    assert.strictEqual(parseSlashInput('/open')?.complete, false);
  });

  it('returns null for non-slash input', () => {
    assert.strictEqual(parseSlashInput('open example.com'), null);
  });

  it('shows the whole vocabulary for an empty query', () => {
    assert.strictEqual(filterSlashCommands('').length, SLASH_COMMANDS.length);
  });

  it('filters by name and summary', () => {
    assert.ok(filterSlashCommands('open').some((command) => command.name === 'open'));
    assert.ok(filterSlashCommands('approval').some((command) => command.name === 'run'));
  });
});

describe('ordinary conversation is not hijacked', () => {
  it('leaves a passing mention of a domain as conversation', () => {
    const envelope = resolveIntent('what is the architecture of example.com?');
    assert.strictEqual(envelope.family, 'converse');
    assert.strictEqual(envelope.readiness, 'ready');
  });

  it('does not treat a plain question as a workspace request', () => {
    const envelope = resolveIntent('how are you today?');
    assert.strictEqual(envelope.family, 'converse');
  });

  // AGENTS.md records this failure explicitly: real work prompts must not be
  // swallowed by local matchers. These are the phrasings a loose selector would
  // wrongly capture.
  it('does not treat questions about running as run requests', () => {
    for (const input of [
      'how do I run the tests',
      'why does the build run twice',
      'can you run through the architecture with me',
      'should I run migrations before deploying',
    ]) {
      assert.notStrictEqual(resolveIntent(input).family, 'run', `"${input}" must not be a run`);
    }
  });

  it('does not treat a mid-sentence verb as a command', () => {
    for (const input of [
      'check my commit for regressions',
      'the running total looks wrong',
      'I want to inspect this later, remind me',
    ]) {
      const envelope = resolveIntent(input);
      assert.notStrictEqual(envelope.family, 'run');
      assert.notStrictEqual(envelope.family, 'project');
    }
  });
});

describe('web surface actions', () => {
  // Phrasings are the ones the existing web-preview matcher supports. The
  // resolver reuses that matcher rather than growing a second vocabulary.
  it('closes only when a preview is open', () => {
    const withPreview = resolveIntent('close the website', {
      ...FULL,
      hasOpenWebPreview: true,
    });
    assert.strictEqual(withPreview.family, 'web-surface');
    assert.strictEqual(withPreview.args.action, 'close');
    assert.strictEqual(withPreview.readiness, 'ready');
  });

  it('reports honestly when there is nothing to close', () => {
    const without = resolveIntent('close the website', FULL);
    assert.strictEqual(without.family, 'web-surface');
    assert.strictEqual(without.readiness, 'needs-context');
  });

  it('reloads only when a preview is open', () => {
    const withPreview = resolveIntent('reload', {
      ...FULL,
      hasOpenWebPreview: true,
    });
    assert.strictEqual(withPreview.args.action, 'reload');
    assert.strictEqual(withPreview.readiness, 'ready');
  });
});

describe('rejected addresses are refused, not reinterpreted', () => {
  it('keeps a credential-bearing URL as a refused web surface', () => {
    const envelope = resolveIntent('/open https://user:pass@example.com');
    assert.strictEqual(envelope.family, 'web-surface');
    assert.strictEqual(envelope.args.url, undefined);
  });

  it('keeps a non-web scheme as a refused web surface', () => {
    const envelope = resolveIntent('/open file:///etc/passwd');
    assert.strictEqual(envelope.family, 'web-surface');
    assert.notStrictEqual(envelope.family, 'live-app');
  });

  it('keeps a private address as a refused web surface', () => {
    const envelope = resolveIntent('/open http://192.168.1.1/admin');
    assert.strictEqual(envelope.family, 'web-surface');
    assert.strictEqual(envelope.args.url, undefined);
  });

  it('still routes a plain application name to live-app', () => {
    assert.strictEqual(resolveIntent('/open Soothsayer').family, 'live-app');
  });
});
