// test/rigArgumentValidation.test.ts
//
// Proposal-time validation applies to every Rig tool, so it must not reject
// arguments that real MCP schemas allow. It checks required fields and simple
// top-level types; richer JSON Schema features pass through to the connector.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateProposedArguments } from '../server/rig/canonical';

const SCHEMA = {
  type: 'object',
  required: ['count', 'mode', 'target', 'shape', 'label', 'note', 'choice'],
  properties: {
    count: { type: 'integer' },
    mode: { type: 'string', enum: ['fast', 'safe'] },
    target: { anyOf: [{ type: 'string' }, { type: 'number' }] },
    shape: { oneOf: [{ type: 'object' }, { type: 'string' }] },
    label: { type: ['string', 'null'] },
    note: { type: 'string', nullable: true },
    choice: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
};

describe('proposal argument validation passes real schema features through', () => {
  it('accepts integer, enum, anyOf, oneOf and nullable union values', () => {
    for (const args of [
      { count: 3, mode: 'safe', target: 42, shape: { width: 1 }, label: 'x', note: 'y', choice: 'a' },
      { count: 0, mode: 'fast', target: 'id-7', shape: 'square', label: null, note: null, choice: null },
    ]) {
      const result = validateProposedArguments(SCHEMA, args);
      assert.equal(result.ok, true, JSON.stringify(result));
    }
  });

  it('still rejects an absent required field, and null where null is not allowed', () => {
    const absent = validateProposedArguments(SCHEMA, { count: 3, mode: 'safe', target: 1, shape: 's', note: null, choice: null });
    assert.deepEqual(absent, { ok: false, error: 'Missing required field: label' });

    const strict = { type: 'object', required: ['name'], properties: { name: { type: 'string' } } };
    assert.deepEqual(validateProposedArguments(strict, { name: null }), { ok: false, error: 'Missing required field: name' });
    assert.deepEqual(validateProposedArguments(strict, { name: 7 }), { ok: false, error: "Field 'name' must be a string" });
  });
});
