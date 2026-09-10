// test/creativeRoutes.test.ts
//
// The creative observation routers are read-only. Mutations to Blender and
// REAPER must travel the Rig proposal → approval → invocation path, so no
// direct action route may exist on either router.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { blenderRouter } from '../server/creative/blenderRoutes';
import { reaperRouter } from '../server/creative/reaperRoutes';

function routeMethods(router: express.Router): string[] {
  const stack = (router as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }).stack;
  return stack.flatMap((layer) => layer.route
    ? Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${layer.route!.path}`)
    : []);
}

describe('creative observation routes', () => {
  let server: Server;
  let base = '';

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/blender', blenderRouter);
    app.use('/api/reaper', reaperRouter);
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('exposes only GET observation routes', () => {
    assert.deepEqual(routeMethods(blenderRouter), ['GET /status', 'GET /scene']);
    assert.deepEqual(routeMethods(reaperRouter), ['GET /status', 'GET /scene', 'GET /peaks']);
  });

  for (const app of ['blender', 'reaper']) {
    it(`POST /api/${app}/action no longer exists`, async () => {
      const response = await fetch(`${base}/api/${app}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: `${app}.anything`, params: {} }),
      });
      assert.equal(response.status, 404);
    });
  }
});
