// test/preconditionDigest.test.ts
//
// Tests for state-bound precondition validation in creative application mutations.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePreconditionDigest } from '../bridges/blender/src/schemas';

describe('Precondition State Digest Validation', () => {
  it('passes when expected digest matches live digest', () => {
    const digest = 'sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069';
    const res = validatePreconditionDigest(digest, digest);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.reason, undefined);
  });

  it('fails when expected digest does not match live digest (stale detection)', () => {
    const expected = 'sha256:expected-digest-v1';
    const live = 'sha256:live-digest-v2-user-modified';
    const res = validatePreconditionDigest(expected, live);
    assert.strictEqual(res.valid, false);
    assert.ok(res.reason?.includes('Stale state detected'));
  });

  it('fails when expected digest is undefined or missing', () => {
    const live = 'sha256:live-digest-v1';
    const res = validatePreconditionDigest(undefined, live);
    assert.strictEqual(res.valid, false);
    assert.ok(res.reason?.includes('requires an expectedStateDigest'));
  });
});
