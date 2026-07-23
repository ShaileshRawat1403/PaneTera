// test/paneSizing.test.ts
// The canvas is the authoritative surface, and the contract puts a floor under
// it:
//
//   "At workstation widths the canvas receives at least 60% of usable width."
//
// That floor was previously not enforced. The conversation pane capped at 55%
// of the viewport and the nested project explorer at 48%, each chosen
// independently. Because the explorer lives inside the canvas, the two limits
// composed: at 1280px a person could leave the authoritative surface 19px wide,
// and both widths persisted to localStorage.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  CANVAS_MIN_SHARE,
  WORKSTATION_MIN_VIEWPORT,
  canvasShare,
  clampPaneWidth,
  maxConversationWidth,
  maxNestedPaneWidth,
} from '../src/components/workstation/paneSizing';

const DIVIDER = 7;
const CONVERSATION = { min: 280, absoluteMax: 640, dividerWidth: DIVIDER };
const EXPLORER = { min: 260, absoluteMax: 680, nestedMaxShare: 0.5 };

/** Common workstation widths, including the two that previously failed. */
const VIEWPORTS = [1024, 1280, 1366, 1440, 1512, 1728, 1920, 2560];

describe('the canvas keeps its contractual share', () => {
  for (const viewport of VIEWPORTS) {
    it(`holds the floor at ${viewport}px`, () => {
      const conversation = maxConversationWidth(viewport, CONVERSATION);
      const share = canvasShare(viewport, conversation, DIVIDER);
      assert.ok(
        share >= CANVAS_MIN_SHARE - 0.001,
        `canvas share ${(share * 100).toFixed(1)}% is below the ${CANVAS_MIN_SHARE * 100}% floor`,
      );
    });
  }

  it('rejects the widths that previously violated it', () => {
    // 1280 gave 49% and 1440 gave 55% under the old independent caps.
    for (const viewport of [1280, 1440]) {
      const conversation = maxConversationWidth(viewport, CONVERSATION);
      assert.ok(conversation < 640, 'the old 640px cap breached the floor here');
      assert.ok(canvasShare(viewport, conversation, DIVIDER) >= CANVAS_MIN_SHARE - 0.001);
    }
  });

  it('still allows the absolute maximum where the floor permits it', () => {
    // At wide viewports the 60% rule is not the binding constraint, so the
    // conversation should reach its intended maximum rather than be starved.
    assert.strictEqual(maxConversationWidth(1728, CONVERSATION), 640);
    assert.strictEqual(maxConversationWidth(2560, CONVERSATION), 640);
  });

  it('counts the divider against the budget', () => {
    const withDivider = maxConversationWidth(1280, CONVERSATION);
    const without = maxConversationWidth(1280, { ...CONVERSATION, dividerWidth: 0 });
    assert.ok(withDivider < without, 'the divider is usable width the canvas does not get');
  });

  it('never returns less than the minimum', () => {
    for (const viewport of [320, 640, 800, 1024]) {
      assert.ok(maxConversationWidth(viewport, CONVERSATION) >= CONVERSATION.min);
    }
  });

  it('relaxes the floor below workstation width rather than crushing the conversation', () => {
    // The contract says conversation becomes contextual at narrow widths. Until
    // that lands, the floor is not claimed rather than quietly broken.
    const narrow = WORKSTATION_MIN_VIEWPORT - 1;
    const conversation = maxConversationWidth(narrow, CONVERSATION);
    assert.ok(conversation >= CONVERSATION.min);
  });
});

describe('a nested pane is budgeted against the canvas, not the viewport', () => {
  it('leaves the canvas real content at every workstation width', () => {
    for (const viewport of VIEWPORTS) {
      const conversation = maxConversationWidth(viewport, CONVERSATION);
      const canvas = viewport - conversation - DIVIDER;
      const explorer = maxNestedPaneWidth(canvas, EXPLORER);
      const content = canvas - explorer;

      assert.ok(
        content >= canvas * 0.5 - 1,
        `at ${viewport}px the canvas kept only ${content.toFixed(0)}px of ${canvas.toFixed(0)}px`,
      );
      assert.ok(content > 300, `at ${viewport}px the canvas content was ${content.toFixed(0)}px`);
    }
  });

  it('reproduces the old failure as a guard', () => {
    // The previous rule was viewport-relative, so the explorer could take more
    // than the canvas had. Budgeting against the canvas makes that impossible.
    const viewport = 1280;
    const oldExplorerCap = Math.max(300, Math.min(680, viewport * 0.48));
    const conversation = maxConversationWidth(viewport, CONVERSATION);
    const canvas = viewport - conversation - DIVIDER;
    const explorer = maxNestedPaneWidth(canvas, EXPLORER);

    assert.ok(oldExplorerCap > canvas * 0.5, 'the old cap exceeded half the canvas');
    assert.ok(explorer <= canvas * 0.5 + 1, 'the new cap does not');
  });

  it('never returns less than its minimum', () => {
    assert.ok(maxNestedPaneWidth(100, EXPLORER) >= EXPLORER.min);
  });
});

describe('clamping', () => {
  it('bounds within range', () => {
    assert.strictEqual(clampPaneWidth(500, 280, 640), 500);
    assert.strictEqual(clampPaneWidth(100, 280, 640), 280);
    assert.strictEqual(clampPaneWidth(900, 280, 640), 640);
  });

  it('falls back to the minimum for any non-finite value', () => {
    // A corrupted localStorage entry must not produce a NaN width, and it must
    // not blow the pane open either. Minimum is the safe direction to fail.
    assert.strictEqual(clampPaneWidth(Number.NaN, 280, 640), 280);
    assert.strictEqual(clampPaneWidth(Number.POSITIVE_INFINITY, 280, 640), 280);
    assert.strictEqual(clampPaneWidth(Number.NEGATIVE_INFINITY, 280, 640), 280);
  });

  it('survives a max below the min', () => {
    assert.strictEqual(clampPaneWidth(500, 280, 100), 280);
  });

  it('rounds to whole pixels', () => {
    assert.strictEqual(clampPaneWidth(400.6, 280, 640), 401);
  });
});

describe('canvasShare', () => {
  it('measures what the canvas actually receives', () => {
    assert.strictEqual(canvasShare(1000, 400, 0), 0.6);
    assert.strictEqual(canvasShare(0, 100, 0), 0);
  });
});
