// test/operatorContext.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { selectActiveCapsule, formatHeadroomContext, headroomContextBlock } from '../server/operatorContext';
import type { HeadroomCapsule } from '../server/headroom/store';

function capsule(p: Partial<HeadroomCapsule> & { capsuleId: string }): HeadroomCapsule {
  return {
    capsuleId: p.capsuleId,
    title: p.title ?? 'Untitled',
    projectId: p.projectId ?? null,
    objective: p.objective ?? null,
    decisions: p.decisions ?? [],
    assumptions: p.assumptions ?? [],
    unresolvedQuestions: p.unresolvedQuestions ?? [],
    changedUnderstanding: p.changedUnderstanding ?? [],
    context: [],
    envelopeIds: [],
    createdAt: p.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: p.updatedAt ?? '2026-01-01T00:00:00.000Z',
    annotations: [],
  };
}

describe('selectActiveCapsule', () => {
  it('returns null for no capsules', () => {
    assert.strictEqual(selectActiveCapsule([]), null);
  });
  it('picks the most recently updated capsule', () => {
    const a = capsule({ capsuleId: 'a', updatedAt: '2026-01-01T00:00:00.000Z' });
    const b = capsule({ capsuleId: 'b', updatedAt: '2026-06-01T00:00:00.000Z' });
    const c = capsule({ capsuleId: 'c', updatedAt: '2026-03-01T00:00:00.000Z' });
    assert.strictEqual(selectActiveCapsule([a, b, c])!.capsuleId, 'b');
  });
});

describe('formatHeadroomContext', () => {
  it('returns empty string for null or an empty capsule', () => {
    assert.strictEqual(formatHeadroomContext(null), '');
    assert.strictEqual(formatHeadroomContext(capsule({ capsuleId: 'x' })), '');
  });

  it('formats objective, decisions, assumptions, and open questions with a clear label', () => {
    const block = formatHeadroomContext(capsule({
      capsuleId: 'x', title: 'Ship RC',
      objective: 'Close the P0 blockers',
      decisions: ['gate on test:core', 'tag v0.9.0-rc1'],
      assumptions: ['single-user local'],
      unresolvedQuestions: ['fix FINDING-001?'],
    }));
    assert.match(block, /\[HEADROOM CONTEXT — active capsule "Ship RC"\]/);
    assert.match(block, /Objective: Close the P0 blockers/);
    assert.match(block, /- gate on test:core/);
    assert.match(block, /Assumptions:\n- single-user local/);
    assert.match(block, /Unresolved questions:\n- fix FINDING-001\?/);
  });

  it('bounds list length and total size', () => {
    const many = Array.from({ length: 50 }, (_, i) => `decision ${i}`);
    const block = formatHeadroomContext(capsule({ capsuleId: 'x', objective: 'o', decisions: many }));
    // Only the first 12 items are included.
    assert.ok(block.includes('decision 0'));
    assert.ok(!block.includes('decision 20'));
  });

  it('falls back to capsuleId when the title is blank', () => {
    const block = formatHeadroomContext(capsule({ capsuleId: 'cap-123', title: '  ', objective: 'o' }));
    assert.match(block, /active capsule "cap-123"/);
  });
});

describe('headroomContextBlock', () => {
  it('selects and formats in one step, empty when no capsules', () => {
    assert.strictEqual(headroomContextBlock([]), '');
    const block = headroomContextBlock([capsule({ capsuleId: 'x', objective: 'do the thing', updatedAt: '2026-09-01T00:00:00.000Z' })]);
    assert.match(block, /Objective: do the thing/);
  });
});
