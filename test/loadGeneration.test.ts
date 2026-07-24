// test/loadGeneration.test.ts
//
// Tests for the Headroom load ordering coordinator. The coordinator owns the guarded
// commit/error operation, so these tests prove the complete boundary: an older run,
// whether it succeeds or errors, must not commit or fail after a newer run has
// settled. Testing it here — rather than by racing loads through the component — is
// deliberate: in the real App a token or session change remounts the panel, so a
// component test that changed the session id would exercise a remount, not
// same-boundary ordering.

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createLoadGeneration } from '../src/components/headroom/loadGeneration';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('the load generation coordinator commits only the latest run', () => {
  it('refuses an older run that SUCCEEDS after a newer one committed', async () => {
    const g = createLoadGeneration();
    const events: string[] = [];
    const older = deferred<string>();
    const newer = deferred<string>();
    const oldRun = g.run(() => older.promise, { commit: (v) => events.push(`commit:${v}`), fail: () => events.push('fail:old') });
    const newRun = g.run(() => newer.promise, { commit: (v) => events.push(`commit:${v}`), fail: () => events.push('fail:new') });
    // Newer settles first and commits; older settles last and must be refused.
    newer.resolve('new');
    await newRun;
    older.resolve('old');
    await oldRun;
    assert.deepStrictEqual(events, ['commit:new'], 'only the newer run committed');
  });

  it('refuses an older run that ERRORS after a newer one committed', async () => {
    const g = createLoadGeneration();
    const events: string[] = [];
    const older = deferred<string>();
    const newer = deferred<string>();
    const oldRun = g.run(() => older.promise, { commit: () => events.push('commit:old'), fail: () => events.push('fail:old') });
    const newRun = g.run(() => newer.promise, { commit: (v) => events.push(`commit:${v}`), fail: () => events.push('fail:new') });
    newer.resolve('new');
    await newRun;
    older.reject(new Error('older failed late'));
    await oldRun;
    assert.deepStrictEqual(events, ['commit:new'], 'the older run neither committed nor failed');
  });

  it('does not invoke fail when commit throws (exactly one handler)', async () => {
    const g = createLoadGeneration();
    const events: string[] = [];
    let propagated = false;
    try {
      await g.run(() => Promise.resolve('x'), {
        commit: () => { events.push('commit'); throw new Error('render blew up'); },
        fail: () => { events.push('fail'); },
      });
    } catch { propagated = true; }
    assert.deepStrictEqual(events, ['commit'], 'commit ran and fail did not');
    assert.strictEqual(propagated, true, 'the error from commit propagates out of run, not into fail');
  });

  it('lets the latest run commit or fail normally when there is no overlap', async () => {
    const g = createLoadGeneration();
    const ok: string[] = [];
    await g.run(() => Promise.resolve('a'), { commit: (v) => ok.push(`commit:${v}`), fail: () => ok.push('fail') });
    const bad: string[] = [];
    await g.run(() => Promise.reject(new Error('x')), { commit: () => bad.push('commit'), fail: () => bad.push('fail') });
    assert.deepStrictEqual(ok, ['commit:a'], 'a lone success commits');
    assert.deepStrictEqual(bad, ['fail'], 'a lone error fails');
  });
});
