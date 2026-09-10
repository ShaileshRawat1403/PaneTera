// test/creativeObservation.test.ts

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toObservationResponse } from '../server/creative/observation';

const NOW = new Date('2026-09-10T08:00:00.000Z');

describe('toObservationResponse', () => {
  it('stamps observedAt only when the bridge returned state', () => {
    assert.deepEqual(
      toObservationResponse({ success: true, data: { objects: [] } }, NOW),
      { connection: 'connected', observedAt: '2026-09-10T08:00:00.000Z', data: { objects: [] } },
    );
  });

  it('reports a refused socket as a normal disconnected state', () => {
    const response = toObservationResponse({
      success: false,
      error: 'Could not connect to Blender on 127.0.0.1:9871 (connect ECONNREFUSED 127.0.0.1:9871)',
    }, NOW);
    assert.equal(response.connection, 'disconnected');
    assert.equal(response.observedAt, undefined);
    assert.equal(response.data, undefined);
  });

  it('reports timeouts, unreadable replies, and empty successes as errors', () => {
    for (const result of [
      { success: false, error: 'Connection to live Blender bridge timed out. Ensure panetera_blender_bridge.py is running in Blender.' },
      { success: false, error: 'Invalid JSON received from Blender: SyntaxError' },
      { success: true },
      { success: false },
    ]) {
      const response = toObservationResponse(result, NOW);
      assert.equal(response.connection, 'error', JSON.stringify(result));
      assert.equal(response.observedAt, undefined);
      assert.ok(response.error);
    }
  });
});
