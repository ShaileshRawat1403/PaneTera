process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateToolArguments } from '../server/rig/canonical';

describe('validateToolArguments schema validation unit tests', () => {
  it('passes valid arguments against required fields and correct data types', () => {
    const schema = {
      type: 'object',
      required: ['filepath', 'count'],
      properties: {
        filepath: { type: 'string' },
        count: { type: 'number' },
        verbose: { type: 'boolean' },
      },
    };

    const res = validateToolArguments(schema, { filepath: '/tmp/test.txt', count: 42, verbose: true });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.error, undefined);
  });

  it('rejects arguments when a required field is missing', () => {
    const schema = {
      type: 'object',
      required: ['filepath'],
      properties: {
        filepath: { type: 'string' },
      },
    };

    const res = validateToolArguments(schema, {});
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error, 'Missing required field: filepath');
  });

  it('rejects arguments when field data types do not match schema declaration', () => {
    const schema = {
      type: 'object',
      properties: {
        port: { type: 'number' },
      },
    };

    const res = validateToolArguments(schema, { port: '8080' });
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error, "Field 'port' must be a number");
  });
});
