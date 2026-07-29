// test/contextBrief.test.ts
//
// The Context Brief is the honest form of "a dashboard" in a product whose
// contract lists "a dashboard showing every available metric" as a non-goal.
// What keeps it on the right side of that line is selectivity, so these tests
// assert restraint as hard as they assert content.
//
// Six corrections from review are covered here, each with a test that fails if
// the correction is reverted:
//
//   1. dormant untracked projects never go stale;
//   2. an unreachable project cannot produce an action inside itself;
//   3. attention is bound to its containing project and cannot be redirected;
//   4. every action states its effect rather than encoding it in a string;
//   5. collections stay bounded under large input;
//   6. malformed counters, thresholds and timestamps cannot corrupt the brief.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  type AttentionInput,
  type NextAction,
  type ProjectSnapshot,
  MAX_ATTENTION_SHOWN,
  MAX_RUN_PROJECTS_SHOWN,
  actionableAttention,
  briefNeedsAttention,
  buildContextBrief,
  daysBetween,
  dedupeProjects,
  isTracked,
  normaliseRunCount,
  normaliseStaleAfterDays,
  recommendNext,
  standingOf,
} from '../src/context/contextBrief';

const NOW = new Date('2026-07-21T12:00:00.000Z');

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function project(overrides: Partial<ProjectSnapshot> & { id: string }): ProjectSnapshot {
  return {
    name: overrides.id,
    reachable: true,
    activeRuns: 0,
    attention: [],
    lastTouchedAt: daysAgo(1),
    ...overrides,
  };
}

function attention(reason: AttentionInput['reason'], summary: string = reason): AttentionInput {
  return { reason, summary };
}

/**
 * The project an action points at, if it points at one.
 *
 * Written as a narrow rather than a cast, because reaching for `projectId` on
 * the bare union is exactly the mistake the discriminated union exists to make
 * impossible: `open-project-picker` has no project to point at.
 */
function projectIdOf(next: NextAction | null): string | undefined {
  if (!next) return undefined;
  if (next.kind === 'open-project-picker' || next.kind === 'open-surface') return undefined;
  return next.projectId;
}

/** Every action kind the union permits, so the switch below stays exhaustive. */
const ACTION_KINDS: NextAction['kind'][] = [
  'focus-composer',
  'open-project-picker',
  'open-surface',
  'submit-message',
];

describe('a healthy workspace stays quiet', () => {
  it('produces no attention items when nothing is wrong', () => {
    const brief = buildContextBrief({
      projects: [project({ id: 'alpha' }), project({ id: 'beta' })],
      activeProjectId: null,
      now: NOW,
    });

    assert.deepStrictEqual(brief.attention.items, []);
    assert.strictEqual(brief.attention.total, 0);
    assert.strictEqual(briefNeedsAttention(brief), false);
  });

  it('counts quiet projects rather than listing them', () => {
    const brief = buildContextBrief({
      projects: [project({ id: 'a' }), project({ id: 'b' }), project({ id: 'c' })],
      activeProjectId: null,
      now: NOW,
    });

    assert.strictEqual(brief.quietProjectCount, 3);
    assert.ok(!('quietProjects' in brief), 'quiet projects must not be enumerated');
  });
});

// Correction 1.
describe('dormant is not the same as stale', () => {
  it('leaves 100 dormant untracked projects completely quiet', () => {
    // The previous rule flagged anything untouched for 14 days, which turned a
    // long project list into 100 attention items. Staleness describes retained
    // understanding decaying, not a directory sitting on disk.
    const projects = Array.from({ length: 100 }, (_, index) =>
      project({ id: `p${index}`, lastTouchedAt: daysAgo(400) }),
    );
    const brief = buildContextBrief({ projects, activeProjectId: null, now: NOW });

    assert.strictEqual(brief.attention.total, 0, 'dormant projects must not raise attention');
    assert.strictEqual(brief.quietProjectCount, 100);
    assert.strictEqual(brief.next?.kind, 'open-project-picker');
  });

  it('does flag the active project when its context has aged', () => {
    const brief = buildContextBrief({
      projects: [project({ id: 'a', name: 'Alpha', lastTouchedAt: daysAgo(30) })],
      activeProjectId: 'a',
      objective: 'Ship it',
      now: NOW,
      staleAfterDays: 14,
    });

    assert.strictEqual(brief.attention.total, 1);
    assert.strictEqual(brief.attention.items[0].reason, 'stale-context');
    assert.match(brief.attention.items[0].summary, /30 days/);
  });

  it('flags a tracked project for each concrete tracking reason', () => {
    for (const reason of ['pinned', 'context-capsule', 'open-objective', 'unfinished-run'] as const) {
      const brief = buildContextBrief({
        projects: [project({ id: 'a', lastTouchedAt: daysAgo(30), trackedBecause: reason })],
        activeProjectId: null,
        now: NOW,
        staleAfterDays: 14,
      });
      assert.strictEqual(brief.attention.total, 1, `${reason} should be tracked`);
    }
  });

  it('treats only the active project and explicitly tracked ones as in play', () => {
    assert.strictEqual(isTracked(project({ id: 'a' }), 'a'), true);
    assert.strictEqual(isTracked(project({ id: 'a' }), 'b'), false);
    assert.strictEqual(isTracked(project({ id: 'a', trackedBecause: 'pinned' }), null), true);
  });

  it('does not flag a tracked project twice when the caller already reported it', () => {
    const brief = buildContextBrief({
      projects: [
        project({
          id: 'a',
          lastTouchedAt: daysAgo(30),
          trackedBecause: 'pinned',
          attention: [attention('stale-context')],
        }),
      ],
      activeProjectId: null,
      now: NOW,
      staleAfterDays: 14,
    });
    assert.strictEqual(brief.attention.total, 1);
  });
});

// Correction 2.
describe('an unreachable project cannot produce an impossible action', () => {
  it('does not recommend answering an ambiguity inside a project it cannot open', () => {
    const brief = buildContextBrief({
      projects: [
        project({
          id: 'gone',
          name: 'Gone',
          reachable: false,
          trackedBecause: 'pinned',
          attention: [attention('ambiguity', 'which branch?')],
        }),
      ],
      activeProjectId: null,
      now: NOW,
    });

    assert.notStrictEqual(brief.attention.items[0]?.reason, 'ambiguity');
    assert.strictEqual(brief.attention.items[0]?.reason, 'missing-capability');
    assert.strictEqual(brief.next?.kind, 'open-surface');
  });

  it('does not surface a failure inside an unreachable project as an action', () => {
    const brief = buildContextBrief({
      projects: [
        project({
          id: 'gone',
          reachable: false,
          trackedBecause: 'pinned',
          attention: [attention('failure')],
        }),
      ],
      activeProjectId: null,
      now: NOW,
    });

    const reasons = brief.attention.items.map((item) => item.reason);
    assert.ok(!reasons.includes('failure'), 'a failure you cannot reach is not actionable');
  });

  it('collapses everything an unreachable project reports into one honest item', () => {
    const items = actionableAttention(
      [
        project({
          id: 'gone',
          reachable: false,
          trackedBecause: 'pinned',
          attention: [attention('failure'), attention('ambiguity'), attention('weak-evidence')],
        }),
      ],
      { activeProjectId: null, now: NOW },
    );

    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].reason, 'missing-capability');
  });

  it('stays silent about an unreachable project that was not in play', () => {
    // A dormant repository being offline is not news.
    const items = actionableAttention(
      [project({ id: 'gone', reachable: false, attention: [attention('failure')] })],
      { activeProjectId: null, now: NOW },
    );
    assert.deepStrictEqual(items, []);
  });

  it('never lets a reachable project’s work be attributed to an unreachable one', () => {
    const brief = buildContextBrief({
      projects: [
        project({ id: 'gone', reachable: false, trackedBecause: 'pinned' }),
        project({ id: 'live', name: 'Live', attention: [attention('approval-pending')] }),
      ],
      activeProjectId: null,
      now: NOW,
    });

    // Approval outranks missing-capability, so the action must land on 'live'.
    assert.strictEqual(projectIdOf(brief.next), 'live');
  });
});

// Correction 3.
describe('attention is bound to the project it was found in', () => {
  it('attaches the containing project’s id during derivation', () => {
    const items = actionableAttention([project({ id: 'alpha', attention: [attention('failure')] })], {
      activeProjectId: null,
      now: NOW,
    });
    assert.strictEqual(items[0].projectId, 'alpha');
  });

  it('overwrites a smuggled project id rather than honouring it', () => {
    // The type carries no id, so this can only arrive through a cast or from
    // untyped JSON. Asserting the field is merely absent would not prove much:
    // what matters is that if one does arrive, derivation overwrites it rather
    // than letting it through and redirecting the action to another project.
    const smuggled = { reason: 'failure', summary: 'x', projectId: 'victim' } as AttentionInput;
    const items = actionableAttention([project({ id: 'alpha', attention: [smuggled] })], {
      activeProjectId: null,
      now: NOW,
    });

    assert.strictEqual(items[0].projectId, 'alpha', 'a nested id redirected the item');
  });

  it('cannot be steered into another project by a smuggled id', () => {
    const smuggled = {
      reason: 'approval-pending',
      summary: 'x',
      projectId: 'victim',
    } as AttentionInput;
    const brief = buildContextBrief({
      projects: [
        project({ id: 'attacker', name: 'Attacker', attention: [smuggled] }),
        project({ id: 'victim', name: 'Victim' }),
      ],
      activeProjectId: null,
      now: NOW,
    });

    assert.strictEqual(projectIdOf(brief.next), 'attacker', 'the action was redirected');
    assert.match(brief.next!.label, /Attacker/);
  });

  it('routes the action to the project the item came from', () => {
    const brief = buildContextBrief({
      projects: [
        project({ id: 'a', name: 'Alpha' }),
        project({ id: 'b', name: 'Beta', attention: [attention('approval-pending')] }),
      ],
      activeProjectId: null,
      now: NOW,
    });
    assert.strictEqual(projectIdOf(brief.next), 'b');
  });
});

// Correction 4.
describe('every action states its effect', () => {
  it('never returns an action without an explicit kind', () => {
    const cases: Array<{ label: string; brief: ReturnType<typeof buildContextBrief> }> = [
      {
        label: 'approval',
        brief: buildContextBrief({
          projects: [project({ id: 'a', attention: [attention('approval-pending')] })],
          activeProjectId: null,
          now: NOW,
        }),
      },
      {
        label: 'missing capability',
        brief: buildContextBrief({
          projects: [project({ id: 'a', attention: [attention('missing-capability')] })],
          activeProjectId: null,
          now: NOW,
        }),
      },
      {
        label: 'weak evidence',
        brief: buildContextBrief({
          projects: [project({ id: 'a', attention: [attention('weak-evidence')] })],
          activeProjectId: null,
          now: NOW,
        }),
      },
      {
        label: 'no project open',
        brief: buildContextBrief({
          projects: [project({ id: 'a' })],
          activeProjectId: null,
          now: NOW,
        }),
      },
      {
        label: 'no objective stated',
        brief: buildContextBrief({
          projects: [project({ id: 'a' })],
          activeProjectId: 'a',
          now: NOW,
        }),
      },
    ];

    for (const { label, brief } of cases) {
      assert.ok(brief.next, `${label}: expected an action`);
      assert.ok(
        ACTION_KINDS.includes(brief.next!.kind),
        `${label}: unknown action kind ${brief.next!.kind}`,
      );
    }
  });

  it('does not use an empty message to mean "focus the composer"', () => {
    const brief = buildContextBrief({
      projects: [project({ id: 'a', name: 'Alpha' })],
      activeProjectId: 'a',
      now: NOW,
    });

    assert.strictEqual(brief.next?.kind, 'focus-composer');
    assert.ok(!('message' in brief.next!), 'focus must not be encoded as an empty message');
  });

  it('does not use a slash string to mean "open the picker"', () => {
    const brief = buildContextBrief({
      projects: [project({ id: 'a' })],
      activeProjectId: null,
      now: NOW,
    });

    assert.strictEqual(brief.next?.kind, 'open-project-picker');
    assert.ok(!('message' in brief.next!), 'the picker must not be encoded as /project');
  });

  it('names the surface it wants opened', () => {
    const brief = buildContextBrief({
      projects: [project({ id: 'a', attention: [attention('missing-capability')] })],
      activeProjectId: null,
      now: NOW,
    });

    assert.strictEqual(brief.next?.kind, 'open-surface');
    assert.strictEqual(
      brief.next!.kind === 'open-surface' ? brief.next!.surface : null,
      'rig',
    );
  });

  it('keeps surfaces surface-scoped rather than project-scoped', () => {
    // Rig, Headroom and Audit are not per-project views. Carrying a project on
    // this variant would invite the renderer to scope them to one, which is the
    // redirection the union exists to prevent.
    for (const reason of ['missing-capability', 'weak-evidence'] as const) {
      const brief = buildContextBrief({
        projects: [project({ id: 'a', attention: [attention(reason)] })],
        activeProjectId: null,
        now: NOW,
      });

      assert.strictEqual(brief.next?.kind, 'open-surface');
      assert.ok(
        !('projectId' in brief.next!),
        `${reason}: a surface action must not carry a project`,
      );
    }
  });

  it('carries a real message only when the effect is submitting one', () => {
    const brief = buildContextBrief({
      projects: [project({ id: 'a', attention: [attention('approval-pending')] })],
      activeProjectId: null,
      now: NOW,
    });

    assert.strictEqual(brief.next?.kind, 'submit-message');
    const message = brief.next!.kind === 'submit-message' ? brief.next!.message : '';
    assert.ok(message.length > 0, 'a submit action must carry something to submit');
  });

  it('recommends nothing at all when there is nothing to recommend', () => {
    const next = recommendNext([], {
      projects: [project({ id: 'a' })],
      activeProjectId: 'a',
      objective: 'Ship the thing',
    });
    assert.strictEqual(next, null);
  });

  it('recommends nothing in an empty workspace', () => {
    const next = recommendNext([], { projects: [], activeProjectId: null });
    assert.strictEqual(next, null);
  });

  it('returns one action, never a menu', () => {
    const brief = buildContextBrief({
      projects: [
        project({ id: 'a', attention: [attention('approval-pending')] }),
        project({ id: 'b', attention: [attention('failure')] }),
        project({ id: 'c', attention: [attention('ambiguity')] }),
      ],
      activeProjectId: null,
      now: NOW,
    });
    assert.ok(!Array.isArray(brief.next), 'next must be a single action');
  });
});

// Correction 5.
describe('collections stay bounded', () => {
  it('shows a bounded slice of attention and reports the true total', () => {
    const projects = Array.from({ length: 40 }, (_, index) =>
      project({ id: `p${index}`, attention: [attention('failure')] }),
    );
    const brief = buildContextBrief({ projects, activeProjectId: null, now: NOW });

    assert.strictEqual(brief.attention.items.length, MAX_ATTENTION_SHOWN);
    assert.strictEqual(brief.attention.total, 40, 'the count must stay honest');
  });

  it('shows the most blocking items within the bound, not an arbitrary slice', () => {
    const projects = [
      ...Array.from({ length: 20 }, (_, index) =>
        project({ id: `low${index}`, attention: [attention('weak-evidence')] }),
      ),
      project({ id: 'urgent', attention: [attention('approval-pending')] }),
    ];
    const brief = buildContextBrief({ projects, activeProjectId: null, now: NOW });

    assert.strictEqual(brief.attention.items[0].reason, 'approval-pending');
  });

  it('bounds the running projects it names', () => {
    const projects = Array.from({ length: 30 }, (_, index) =>
      project({ id: `p${index}`, activeRuns: 1 }),
    );
    const brief = buildContextBrief({ projects, activeProjectId: null, now: NOW });

    assert.strictEqual(brief.now.projectsWithRuns.items.length, MAX_RUN_PROJECTS_SHOWN);
    assert.strictEqual(brief.now.projectsWithRuns.total, 30);
    assert.strictEqual(brief.now.activeRunCount, 30);
  });

  it('stays silent across a large healthy workspace', () => {
    const projects = Array.from({ length: 200 }, (_, index) => project({ id: `p${index}` }));
    const brief = buildContextBrief({ projects, activeProjectId: null, now: NOW });

    assert.strictEqual(brief.attention.total, 0);
    assert.strictEqual(brief.quietProjectCount, 200);
    assert.deepStrictEqual(brief.now.projectsWithRuns.items, []);
  });
});

// Correction 6.
describe('malformed input fails quiet rather than loudly wrong', () => {
  it('never produces a negative or fractional run total', () => {
    const brief = buildContextBrief({
      projects: [
        project({ id: 'a', activeRuns: -5 }),
        project({ id: 'b', activeRuns: 2.7 }),
        project({ id: 'c', activeRuns: Number.NaN }),
        project({ id: 'd', activeRuns: Number.POSITIVE_INFINITY }),
      ],
      activeProjectId: null,
      now: NOW,
    });

    assert.ok(brief.now.activeRunCount >= 0, 'run totals cannot go negative');
    assert.ok(Number.isInteger(brief.now.activeRunCount), 'run totals must be whole');
    assert.strictEqual(brief.now.activeRunCount, 2);
  });

  it('normalises run counts individually', () => {
    assert.strictEqual(normaliseRunCount(-1), 0);
    assert.strictEqual(normaliseRunCount(2.9), 2);
    assert.strictEqual(normaliseRunCount(Number.NaN), 0);
    assert.strictEqual(normaliseRunCount(Number.POSITIVE_INFINITY), 0);
    assert.strictEqual(normaliseRunCount('3' as unknown), 0);
  });

  it('does not let a bad threshold make everything instantly stale', () => {
    for (const bad of [0, -14, Number.NaN, Number.POSITIVE_INFINITY]) {
      const brief = buildContextBrief({
        projects: [project({ id: 'a', lastTouchedAt: daysAgo(1), trackedBecause: 'pinned' })],
        activeProjectId: null,
        now: NOW,
        staleAfterDays: bad,
      });
      assert.strictEqual(brief.attention.total, 0, `threshold ${bad} made a fresh project stale`);
    }
  });

  it('normalises thresholds individually', () => {
    assert.strictEqual(normaliseStaleAfterDays(0), 14);
    assert.strictEqual(normaliseStaleAfterDays(-3), 14);
    assert.strictEqual(normaliseStaleAfterDays(Number.NaN), 14);
    assert.strictEqual(normaliseStaleAfterDays(7), 7);
  });

  it('never floors a fractional threshold to zero', () => {
    // 0.5 passed the `value <= 0` guard and then floored to 0, at which point
    // `idle >= 0` held for everything and a one-hour-old project was reported
    // as "Not opened for 0 days." Guarding the input is not enough; the output
    // has to be constrained too.
    for (const fraction of [0.5, 0.1, 0.999]) {
      assert.ok(
        normaliseStaleAfterDays(fraction) >= 1,
        `threshold ${fraction} normalised to ${normaliseStaleAfterDays(fraction)}`,
      );
    }
  });

  it('does not call a one-hour-old project stale under a fractional threshold', () => {
    const brief = buildContextBrief({
      projects: [
        project({
          id: 'fresh',
          lastTouchedAt: new Date(NOW.getTime() - 60 * 60 * 1000).toISOString(),
          trackedBecause: 'pinned',
        }),
      ],
      activeProjectId: null,
      now: NOW,
      staleAfterDays: 0.5,
    });

    assert.strictEqual(brief.attention.total, 0, 'a fresh project was reported stale');
  });

  it('never emits a zero-day staleness summary', () => {
    for (const threshold of [0.5, 0.01, 1]) {
      const brief = buildContextBrief({
        projects: [project({ id: 'a', lastTouchedAt: daysAgo(0), trackedBecause: 'pinned' })],
        activeProjectId: null,
        now: NOW,
        staleAfterDays: threshold,
      });
      for (const item of brief.attention.items) {
        assert.ok(
          !/Not opened for 0 days/.test(item.summary),
          `threshold ${threshold} produced "${item.summary}"`,
        );
      }
    }
  });

  it('treats a future timestamp as zero age, not as an error or instant staleness', () => {
    assert.strictEqual(daysBetween(new Date(NOW.getTime() + 5 * 86400000).toISOString(), NOW), 0);

    const brief = buildContextBrief({
      projects: [
        project({
          id: 'a',
          lastTouchedAt: new Date(NOW.getTime() + 90 * 86400000).toISOString(),
          trackedBecause: 'pinned',
        }),
      ],
      activeProjectId: null,
      now: NOW,
      staleAfterDays: 14,
    });
    assert.strictEqual(brief.attention.total, 0);
  });

  it('treats an unparseable or absent timestamp as unknown, not stale', () => {
    assert.strictEqual(daysBetween(undefined, NOW), null);
    assert.strictEqual(daysBetween('not a date', NOW), null);

    const brief = buildContextBrief({
      projects: [project({ id: 'a', lastTouchedAt: undefined, trackedBecause: 'pinned' })],
      activeProjectId: null,
      now: NOW,
    });
    assert.strictEqual(brief.attention.total, 0);
  });

  it('counts a duplicated project once', () => {
    const brief = buildContextBrief({
      projects: [
        project({ id: 'a', activeRuns: 1 }),
        project({ id: 'a', activeRuns: 1 }),
        project({ id: 'a', activeRuns: 1 }),
      ],
      activeProjectId: null,
      now: NOW,
    });

    assert.strictEqual(brief.now.activeRunCount, 1, 'a duplicate id must not inflate the total');
    assert.strictEqual(brief.now.projectsWithRuns.total, 1);
  });

  it('does not raise the same attention twice for a duplicated project', () => {
    const brief = buildContextBrief({
      projects: [
        project({ id: 'a', attention: [attention('failure')] }),
        project({ id: 'a', attention: [attention('failure')] }),
      ],
      activeProjectId: null,
      now: NOW,
    });
    assert.strictEqual(brief.attention.total, 1);
  });

  it('dedupes on first occurrence', () => {
    const unique = dedupeProjects([
      project({ id: 'a', name: 'first' }),
      project({ id: 'a', name: 'second' }),
      project({ id: 'b', name: 'other' }),
    ]);
    assert.deepStrictEqual(
      unique.map((p) => p.name),
      ['first', 'other'],
    );
  });

  it('does not mutate the caller’s snapshots', () => {
    const projects = [project({ id: 'a', lastTouchedAt: daysAgo(90), trackedBecause: 'pinned' })];
    buildContextBrief({ projects, activeProjectId: null, now: NOW, staleAfterDays: 14 });
    assert.deepStrictEqual(projects[0].attention, [], 'input must not be written to');
  });

  it('returns a fresh attention array, never one of the project’s own', () => {
    // Asserting only that the input is unchanged would be vacuous, since the
    // derivation always allocates. What can regress is a shortcut returning a
    // project's array directly, which would then be sorted in place.
    const projects = [
      project({ id: 'a', attention: [attention('weak-evidence'), attention('failure')] }),
    ];
    const items = actionableAttention(projects, { activeProjectId: null, now: NOW });

    assert.notStrictEqual(items, projects[0].attention as unknown, 'result is aliased to the input');
    assert.deepStrictEqual(
      projects[0].attention.map((item) => item.reason),
      ['weak-evidence', 'failure'],
      'the caller’s order was disturbed',
    );
  });
});

describe('what am I working on', () => {
  it('names the active project and its objective', () => {
    const brief = buildContextBrief({
      projects: [project({ id: 'alpha', name: 'Ansolo Builder' })],
      activeProjectId: 'alpha',
      objective: 'Ship the onboarding flow',
      now: NOW,
    });

    assert.deepStrictEqual(brief.working, {
      projectId: 'alpha',
      name: 'Ansolo Builder',
      objective: 'Ship the onboarding flow',
    });
  });

  it('is null when no project is open', () => {
    const brief = buildContextBrief({
      projects: [project({ id: 'alpha' })],
      activeProjectId: null,
      now: NOW,
    });
    assert.strictEqual(brief.working, null);
  });

  it('does not invent an objective that was never stated', () => {
    const brief = buildContextBrief({
      projects: [project({ id: 'alpha' })],
      activeProjectId: 'alpha',
      now: NOW,
    });
    assert.strictEqual(brief.working?.objective, null);
  });
});

describe('what is happening now', () => {
  it('sums runs across projects and names only those with runs', () => {
    const brief = buildContextBrief({
      projects: [
        project({ id: 'alpha', name: 'Alpha', activeRuns: 2 }),
        project({ id: 'beta', name: 'Beta', activeRuns: 0 }),
        project({ id: 'gamma', name: 'Gamma', activeRuns: 1 }),
      ],
      activeProjectId: null,
      now: NOW,
    });

    assert.strictEqual(brief.now.activeRunCount, 3);
    assert.deepStrictEqual(brief.now.projectsWithRuns.items, ['Alpha', 'Gamma']);
  });
});

describe('attention ordering', () => {
  it('orders the most blocking condition first', () => {
    const items = actionableAttention(
      [
        project({ id: 'a', attention: [attention('weak-evidence')] }),
        project({ id: 'b', attention: [attention('failure')] }),
        project({ id: 'c', attention: [attention('approval-pending')] }),
        project({ id: 'd', attention: [attention('ambiguity')] }),
      ],
      { activeProjectId: null, now: NOW },
    );

    assert.deepStrictEqual(
      items.map((item) => item.reason),
      ['approval-pending', 'failure', 'ambiguity', 'weak-evidence'],
    );
  });

  it('puts a pending approval above a failure', () => {
    // An approval is blocked on a decision only the person can make. A failure
    // has already happened and is not waiting on them.
    const items = actionableAttention(
      [
        project({ id: 'a', attention: [attention('failure')] }),
        project({ id: 'b', attention: [attention('approval-pending')] }),
      ],
      { activeProjectId: null, now: NOW },
    );
    assert.strictEqual(items[0].reason, 'approval-pending');
  });
});

describe('standing', () => {
  it('reports unavailable before attention, because you cannot act on it', () => {
    const dead = project({ id: 'dead', reachable: false, attention: [attention('failure')] });
    assert.strictEqual(standingOf(dead), 'unavailable');
  });

  it('distinguishes active, quiet, and needing attention', () => {
    assert.strictEqual(standingOf(project({ id: 'a', activeRuns: 1 })), 'active');
    assert.strictEqual(standingOf(project({ id: 'b' })), 'quiet');
    assert.strictEqual(
      standingOf(project({ id: 'c', attention: [attention('ambiguity')] })),
      'needs-attention',
    );
  });

  it('does not count a project with attention as quiet', () => {
    const brief = buildContextBrief({
      projects: [
        project({ id: 'a' }),
        project({ id: 'b', attention: [attention('failure')] }),
        project({ id: 'c', reachable: false }),
      ],
      activeProjectId: null,
      now: NOW,
    });
    assert.strictEqual(brief.quietProjectCount, 1);
  });

  it('does not count a stale project as quiet at the same time it raises it', () => {
    // Staleness is derived, so nothing writes to the snapshot when a project
    // goes stale. Reading the raw snapshot made the same project appear in the
    // attention list and in the quiet count simultaneously.
    const brief = buildContextBrief({
      projects: [project({ id: 'a', lastTouchedAt: daysAgo(90), trackedBecause: 'pinned' })],
      activeProjectId: null,
      now: NOW,
      staleAfterDays: 14,
    });

    assert.strictEqual(brief.attention.total, 1);
    assert.strictEqual(brief.quietProjectCount, 0, 'a project cannot be quiet and need attention');
  });

  it('keeps the two counts disjoint across a mixed workspace', () => {
    const brief = buildContextBrief({
      projects: [
        project({ id: 'quiet1' }),
        project({ id: 'quiet2' }),
        project({ id: 'stale', lastTouchedAt: daysAgo(90), trackedBecause: 'pinned' }),
        project({ id: 'failing', attention: [attention('failure')] }),
        project({ id: 'running', activeRuns: 2 }),
      ],
      activeProjectId: null,
      now: NOW,
      staleAfterDays: 14,
    });

    const projectsNeedingAttention = new Set(brief.attention.items.map((item) => item.projectId));
    assert.strictEqual(projectsNeedingAttention.size, 2, 'stale and failing both need attention');
    assert.strictEqual(brief.quietProjectCount, 2, 'only the two genuinely idle projects are quiet');
  });
});

describe('the brief refuses to become a dashboard', () => {
  it('exposes only the four contractual answers plus a quiet count', () => {
    const brief = buildContextBrief({
      projects: [project({ id: 'a' })],
      activeProjectId: 'a',
      objective: 'x',
      now: NOW,
    });

    assert.deepStrictEqual(Object.keys(brief).sort(), [
      'attention',
      'next',
      'now',
      'quietProjectCount',
      'suggestions',
      'working',
    ]);
  });
});
