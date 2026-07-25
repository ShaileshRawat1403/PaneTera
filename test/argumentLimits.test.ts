process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { checkArgumentLimits } from '../server/rig/canonical';

describe('checkArgumentLimits payload enforcement unit tests', () => {
  it('accepts valid small payloads within depth and size bounds', () => {
    const res = checkArgumentLimits({ a: { b: { c: 'hello' } } });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.error, undefined);
  });

  it('rejects payloads exceeding max size limit of 64 KB', () => {
    const hugeString = 'a'.repeat(70_000);
    const res = checkArgumentLimits({ data: hugeString });
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.error, 'Argument payload exceeds maximum size of 64 KB.');
  });

  it('rejects payloads exceeding max depth limit of 8', () => {
    let deep: any = { depth: 9 };
    for (let i = 0; i < 10; i += 1) {
      deep = { nested: deep };
    }
    const res = checkArgumentLimits(deep);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.error, 'Argument depth exceeds 8 levels or total keys exceed 100.');
  });
});
