// test/appObservation.test.ts

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAppObservation } from '../src/utils/appObservation';

function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return respond();
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('fetchAppObservation', () => {
  it('authenticates the observation request', async () => {
    const { impl, calls } = fakeFetch(() => json({ connection: 'disconnected', error: 'Could not connect to Blender' }));
    await fetchAppObservation('/api/blender/scene', 'secret-token', impl);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/blender/scene');
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, 'Bearer secret-token');
  });

  it('passes a connected observation through with its observation time', async () => {
    const { impl } = fakeFetch(() => json({ connection: 'connected', observedAt: '2026-09-10T08:00:00.000Z', data: { objects: [] } }));
    assert.deepEqual(await fetchAppObservation('/api/blender/scene', 't', impl), {
      connection: 'connected',
      observedAt: '2026-09-10T08:00:00.000Z',
      data: { objects: [] },
      error: undefined,
    });
  });

  it('reports rejected, failed, and malformed requests as errors without an observation time', async () => {
    const cases: Array<() => Response | Promise<Response>> = [
      () => json({ error: 'Invalid or missing token' }, 401),
      () => { throw new Error('network down'); },
      () => new Response('not json', { status: 200 }),
      () => json({ success: true, data: {} }),
    ];
    for (const respond of cases) {
      const { impl } = fakeFetch(respond);
      const observation = await fetchAppObservation('/api/reaper/scene', 't', impl);
      assert.equal(observation.connection, 'error');
      assert.equal(observation.observedAt, undefined);
      assert.ok(observation.error);
    }
  });
});
