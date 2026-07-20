// src/components/singleFire.ts
// A synchronous once-only guard.
//
// Extracted so the approval latch can be tested without a DOM, and so the
// component uses the tested code path rather than a parallel copy of it.
//
// The hazard it closes: `setSubmitting(true)` does not take effect until React
// commits, so two clicks dispatched inside the same tick both read the old
// state and both fire. A ref mutates synchronously, so the second call sees the
// latch already closed.
//
// This is a UI guard, not a correctness boundary. Backend idempotency remains
// the real protection against a duplicated action.

export interface Latch {
  current: boolean;
}

/**
 * Run `action` only if `latch` has not already been closed, closing it first.
 *
 * The latch is closed *before* the action runs, so an action that throws still
 * cannot be re-entered.
 */
export function singleFire(latch: Latch, action: () => void): void {
  if (latch.current) return;
  latch.current = true;
  action();
}
