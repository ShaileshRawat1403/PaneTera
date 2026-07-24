// src/components/headroom/loadGeneration.ts
//
// The ordering coordinator for overlapping Headroom loads. It owns the guarded
// commit/error operation itself: `run` takes the async work and the commit/fail
// handlers, and invokes exactly one of them only if this run is still the latest when
// the work settles. An older, slower load — whether it succeeds or errors — is
// refused, so it can never overwrite newer data or drop a stale banner over it.
//
// Owning commit/fail here (rather than exposing a raw isStale() the caller must
// remember to check) means the boundary is proven by this module's own tests:
// deleting the guard makes those tests fail, not just a helper's unit test.

export interface LoadGeneration {
  /**
   * Run `work`; if this run is still the latest when it settles, invoke `commit`
   * with its result (or `fail` with its error). Otherwise invoke neither.
   */
  run<T>(work: () => Promise<T>, handlers: { commit: (result: T) => void; fail: (error: unknown) => void }): Promise<void>;
}

export function createLoadGeneration(): LoadGeneration {
  let current = 0;
  return {
    async run<T>(work: () => Promise<T>, handlers: { commit: (result: T) => void; fail: (error: unknown) => void }): Promise<void> {
      const generation = current + 1;
      current = generation;
      // Catch only rejection from work(); capture the outcome and dispatch the handler
      // OUTSIDE the try, so a throw from commit() can never be miscaught and also
      // invoke fail(). Exactly one handler runs, and only for the latest run.
      let outcome: { ok: true; value: T } | { ok: false; error: unknown };
      try {
        outcome = { ok: true, value: await work() };
      } catch (error) {
        outcome = { ok: false, error };
      }
      if (generation !== current) return; // superseded by a newer run; invoke neither handler
      if (outcome.ok) handlers.commit(outcome.value);
      else handlers.fail(outcome.error);
    },
  };
}
