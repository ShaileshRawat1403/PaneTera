process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createTypedRigError, type TypedRigError } from '../server/rig/types';

describe('TypedRigError schema unit tests', () => {
  it('creates structured typed errors for authorization, validation, and not-found', () => {
    const authErr = createTypedRigError('authorization', 'Unauthorized proposal claim.');
    assert.strictEqual(authErr.kind, 'authorization');
    assert.strictEqual(authErr.message, 'Unauthorized proposal claim.');

    const notFoundErr = createTypedRigError('not-found', 'Connection missing.', { connectionId: 'c-1' });
    assert.strictEqual(notFoundErr.kind, 'not-found');
    assert.deepStrictEqual(notFoundErr.details, { connectionId: 'c-1' });

    const valErr: TypedRigError = createTypedRigError('validation', 'Invalid schema payload.', null, 'ERR_INVALID_SCHEMA');
    assert.strictEqual(valErr.kind, 'validation');
    assert.strictEqual(valErr.code, 'ERR_INVALID_SCHEMA');
  });
});
