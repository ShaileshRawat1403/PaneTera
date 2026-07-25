process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeRigError } from '../src/rig/inspect';

describe('normalizeRigError client normalization unit tests', () => {
  it('normalizes legacy version: 1 string errors to server-error kind', () => {
    const err = normalizeRigError('Connection is not active.');
    assert.strictEqual(err.kind, 'server-error');
    assert.strictEqual(err.message, 'Connection is not active.');
  });

  it('parses version: 2 structured TypedRigError objects correctly', () => {
    const payload = {
      version: 2,
      error: {
        kind: 'authorization',
        message: 'External capabilities cannot be made automatic.',
        code: 'ERR_PERMISSION_DENIED',
      },
    };
    const err = normalizeRigError(payload);
    assert.strictEqual(err.kind, 'authorization');
    assert.strictEqual(err.message, 'External capabilities cannot be made automatic.');
    assert.strictEqual(err.code, 'ERR_PERMISSION_DENIED');
  });

  it('handles null/undefined gracefully with safe fallback', () => {
    const errNull = normalizeRigError(null);
    assert.strictEqual(errNull.kind, 'server-error');
    assert.strictEqual(errNull.message, 'An unknown error occurred.');
  });
});
