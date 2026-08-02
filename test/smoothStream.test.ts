import assert from 'assert';
import { revealStep } from '../src/hooks/useSmoothStream';

// The reveal accelerates with the backlog: a larger gap between shown and target
// yields a larger step, so the smoothed text catches up when the stream runs
// ahead instead of falling further behind.
function stepScalesWithBacklog() {
  const small = revealStep(0, 12, { divisor: 6 });   // ceil(12/6) = 2
  const large = revealStep(0, 300, { divisor: 6 });  // ceil(300/6) = 50, capped at max
  assert.strictEqual(small, 2, 'a small backlog reveals a few characters');
  assert.ok(large > small, 'a larger backlog reveals more characters per frame');
}

// min and max bound the per-frame step: always at least `min` while behind (so
// progress never stalls) and never more than `max` (so even a huge backlog still
// visibly streams rather than dumping at once).
function stepRespectsMinAndMax() {
  assert.strictEqual(revealStep(0, 1, { min: 1 }), 1, 'reveals at least the minimum');
  assert.strictEqual(revealStep(0, 10_000, { divisor: 6, max: 48 }), 48, 'never exceeds the maximum');
  assert.strictEqual(revealStep(0, 100, { divisor: 4, min: 10, max: 48 }), 25, 'ceil(100/4) sits within [min,max]');
}

// Caught up or over-run: never advances past the target and never goes backward.
function caughtUpIsANoOp() {
  assert.strictEqual(revealStep(50, 50), 50, 'no movement once shown equals target');
  assert.strictEqual(revealStep(60, 50), 50, 'clamps a shown count that overshot the target');
  assert.strictEqual(revealStep(0, 0), 0, 'an empty target reveals nothing');
}

// Iterating the step always converges to the full target in finite frames, and
// only ever moves forward. This is the property the render loop relies on.
function convergesMonotonically() {
  const target = 'The quick brown fox jumps over the lazy dog.'.length; // 44
  let shown = 0;
  let frames = 0;
  let previous = -1;
  while (shown < target) {
    previous = shown;
    shown = revealStep(shown, target);
    assert.ok(shown > previous, 'each frame reveals strictly more while behind');
    frames += 1;
    assert.ok(frames < 1000, 'reveal terminates well within a frame budget');
  }
  assert.strictEqual(shown, target, 'reveal lands exactly on the target length');
}

function main() {
  console.log('Running smooth-stream reveal tests...');
  stepScalesWithBacklog();
  stepRespectsMinAndMax();
  caughtUpIsANoOp();
  convergesMonotonically();
  console.log('Smooth-stream reveal tests passed.');
}

main();
