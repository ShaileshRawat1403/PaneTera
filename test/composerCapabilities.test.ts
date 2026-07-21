// test/composerCapabilities.test.ts
// Capability declaration, executor dispatch, and application name resolution.
//
// The invariant under test: a capability cannot be claimed without the handler
// that performs it, so `ready` can never reach a missing executor.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { capabilitiesFrom, executePlan } from '../src/composer/capabilities';
import type { ExecutablePlan, PlanExecutors } from '../src/composer/capabilities';
import { describeResolution, resolveAppName } from '../src/composer/appRegistry';
import { resolveIntent, DEFAULT_RESOLVER_CONTEXT } from '../src/composer/intentResolver';
import { planSubmission } from '../src/composer/submissionPlan';

describe('capabilities derive from executors', () => {
  it('claims nothing when no executors are supplied', () => {
    assert.deepStrictEqual(capabilitiesFrom({}), []);
  });

  it('does not claim web-surface without all three handlers', () => {
    assert.ok(!capabilitiesFrom({ webOpen: () => {} }).includes('web-surface'));
    assert.ok(!capabilitiesFrom({ webOpen: () => {}, webClose: () => {} }).includes('web-surface'));
    assert.ok(
      capabilitiesFrom({ webOpen: () => {}, webClose: () => {}, webReload: () => {} }).includes(
        'web-surface',
      ),
    );
  });

  it('claims converse and artifact together from one chat handler', () => {
    const claimed = capabilitiesFrom({ chat: () => {} });
    assert.ok(claimed.includes('converse'));
    assert.ok(claimed.includes('artifact'));
  });

  it('claims live-app only with a handler', () => {
    assert.ok(!capabilitiesFrom({}).includes('live-app'));
    assert.ok(capabilitiesFrom({ openLiveApp: () => {} }).includes('live-app'));
  });

  it('claims Rig and Headroom only when their real surfaces have handlers', () => {
    assert.ok(!capabilitiesFrom({}).includes('rig'));
    assert.ok(!capabilitiesFrom({}).includes('headroom'));
    const claimed = capabilitiesFrom({ openRig: () => {}, openHeadroom: () => {} });
    assert.ok(claimed.includes('rig'));
    assert.ok(claimed.includes('headroom'));
  });
});

describe('every ready plan reaches an executor', () => {
  // The property that made the previous design unsafe: a declared capability
  // with no handler behind it. Here the declaration is computed, so this holds
  // by construction, and the test pins it against future edits.
  const executors: PlanExecutors = {
    webOpen: () => {},
    webClose: () => {},
    webReload: () => {},
    selectProject: () => {},
    openLiveApp: () => {},
    clearContext: () => {},
    openHeadroom: () => {},
    openRig: () => {},
    chat: () => {},
  };

  const context = {
    ...DEFAULT_RESOLVER_CONTEXT,
    hasWorkspace: true,
    hasOpenWebPreview: true,
    includedContextCount: 1,
    supportedCapabilities: capabilitiesFrom(executors),
  };

  const inputs = [
    '/open example.com',
    'close the website',
    'reload',
    '/project PaneTera',
    '/open Soothsayer',
    '/clear-context',
    '/headroom',
    '/rig',
    'hello there',
    'what does the git history show',
  ];

  for (const input of inputs) {
    it(`dispatches "${input}" to a handler`, async () => {
      const intent = resolveIntent(input, context);
      // Asserted rather than tolerated. Silently accepting a blocked plan would
      // let a regression that turns a ready action into a refusal pass a test
      // named "every ready plan reaches an executor".
      assert.strictEqual(
        intent.readiness,
        'ready',
        `${input} should resolve to ready with every executor supplied`,
      );

      const plan = planSubmission({ intent, context: [], material: {} });
      assert.notStrictEqual(plan.kind, 'blocked', `${input} produced a blocked plan`);

      const outcome = await executePlan(plan as ExecutablePlan, executors);
      assert.strictEqual(outcome.kind, 'executed', `${input} produced an unhandled plan`);
    });
  }

  it('reports unhandled rather than throwing when a handler is missing', async () => {
    const outcome = await executePlan({ kind: 'web-close' }, {});
    assert.strictEqual(outcome.kind, 'unhandled');
  });
});

describe('application name resolution', () => {
  const apps = [
    { appId: 'soothsayer-local', name: 'Soothsayer' },
    { appId: 'flowright-dev', name: 'Flowright' },
  ];

  it('resolves a display name to its registered id', () => {
    // The original defect: `Soothsayer` was passed straight through as an id.
    const resolution = resolveAppName('Soothsayer', apps);
    assert.strictEqual(resolution.kind, 'resolved');
    assert.ok(resolution.kind === 'resolved' && resolution.appId === 'soothsayer-local');
  });

  it('resolves case-insensitively', () => {
    const resolution = resolveAppName('soothsayer', apps);
    assert.ok(resolution.kind === 'resolved' && resolution.appId === 'soothsayer-local');
  });

  it('resolves an exact registered id', () => {
    const resolution = resolveAppName('flowright-dev', apps);
    assert.ok(resolution.kind === 'resolved' && resolution.appId === 'flowright-dev');
  });

  it('absorbs punctuation and spacing differences', () => {
    const resolution = resolveAppName('sooth sayer', [
      { appId: 'soothsayer-local', name: 'Sooth-Sayer' },
    ]);
    assert.ok(resolution.kind === 'resolved' && resolution.appId === 'soothsayer-local');
  });

  it('reports ambiguity instead of picking the first candidate', () => {
    const resolution = resolveAppName('sooth', [
      { appId: 'soothsayer-local', name: 'Soothsayer Local' },
      { appId: 'soothsayer-prod', name: 'Soothsayer Prod' },
    ]);
    assert.strictEqual(resolution.kind, 'ambiguous');
    assert.ok(resolution.kind === 'ambiguous' && resolution.candidates.length === 2);
  });

  it('prefers an exact match over a longer prefix match', () => {
    const resolution = resolveAppName('Soothsayer', [
      { appId: 'soothsayer', name: 'Soothsayer' },
      { appId: 'soothsayer-extra', name: 'Soothsayer Extra' },
    ]);
    assert.ok(resolution.kind === 'resolved' && resolution.appId === 'soothsayer');
  });

  it('reports not-found with what is available', () => {
    const resolution = resolveAppName('nonexistent', apps);
    assert.strictEqual(resolution.kind, 'not-found');
    assert.ok(resolution.kind === 'not-found' && resolution.available.includes('Soothsayer'));
  });

  it('handles an empty registry honestly', () => {
    const resolution = resolveAppName('Soothsayer', []);
    assert.strictEqual(resolution.kind, 'not-found');
    assert.ok(describeResolution(resolution).includes('no applications are registered'));
  });

  it('never resolves to a name that was merely typed', () => {
    const resolution = resolveAppName('Soothsayer', apps);
    assert.ok(resolution.kind === 'resolved' && resolution.appId !== 'Soothsayer');
  });
});
