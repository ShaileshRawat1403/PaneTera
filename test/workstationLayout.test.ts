// test/workstationLayout.test.ts
//
// The narrow-viewport layout decisions, tested without a DOM. The constraint
// from the handoff that is easy to violate by accident: the composer must never
// be hidden as a side effect. The layout never auto-switches to the canvas, so a
// person only ever leaves the composer by pressing Canvas, and the persistent
// switch returns them in one action. Stranding is therefore structural, not a
// rule that second-guesses the person.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { WORKSTATION_MIN_VIEWPORT } from '../src/components/workstation/paneSizing';
import {
  STACKED_BELOW_VIEWPORT,
  isStackedWidth,
  shouldSignalCanvas,
} from '../src/components/workstation/workstationLayout';

describe('the stacking boundary', () => {
  it('shares the workstation threshold rather than picking a second number', () => {
    // Two statements about one boundary. If these drift apart, a width could be
    // stacked while the canvas floor still claims to apply, or vice versa.
    assert.strictEqual(STACKED_BELOW_VIEWPORT, WORKSTATION_MIN_VIEWPORT);
  });

  it('stacks below the threshold and splits at or above it', () => {
    assert.strictEqual(isStackedWidth(STACKED_BELOW_VIEWPORT - 1), true);
    assert.strictEqual(isStackedWidth(STACKED_BELOW_VIEWPORT), false);
    assert.strictEqual(isStackedWidth(STACKED_BELOW_VIEWPORT + 1), false);
  });

  it('covers the widths that matter', () => {
    for (const narrow of [320, 375, 414, 600, 768, 900, 1023]) {
      assert.strictEqual(isStackedWidth(narrow), true, `${narrow} should stack`);
    }
    for (const wide of [1024, 1280, 1440, 1920]) {
      assert.strictEqual(isStackedWidth(wide), false, `${wide} should split`);
    }
  });

  it('treats a zero or negative width as not stacked', () => {
    // A degenerate measurement must not flip the layout into a narrow mode that
    // then reads a nonsense width. Splitting is the safe default.
    assert.strictEqual(isStackedWidth(0), false);
    assert.strictEqual(isStackedWidth(-100), false);
  });
});

describe('the canvas signal', () => {
  it('signals when content waits on the plane the person is not viewing', () => {
    assert.strictEqual(shouldSignalCanvas('conversation', true), true);
  });

  it('does not signal the plane the person is already viewing', () => {
    assert.strictEqual(shouldSignalCanvas('canvas', true), false);
  });

  it('does not signal an empty canvas', () => {
    assert.strictEqual(shouldSignalCanvas('conversation', false), false);
    assert.strictEqual(shouldSignalCanvas('canvas', false), false);
  });

  it('is an availability hint, not an unread flag', () => {
    // It stays true across repeated glances back to the conversation, because
    // "there is something over there" remains true. This is deliberate: the
    // alternative is unseen-state tracking the shell has no honest source for.
    assert.strictEqual(shouldSignalCanvas('conversation', true), true);
    assert.strictEqual(shouldSignalCanvas('conversation', true), true);
  });
});

describe('the composer is never hidden by the layout itself', () => {
  it('never signals in a way that would pull focus to the canvas', () => {
    // The signal is a quiet availability hint, never an instruction. The layout
    // has no path that moves to the canvas on its own; only an explicit tap
    // does, which is what keeps the composer from being hidden without the
    // person asking. The strongest statement this pure module can make is that
    // the signal never fires on the plane the person is already viewing.
    assert.strictEqual(shouldSignalCanvas('canvas', true), false);
  });
});
