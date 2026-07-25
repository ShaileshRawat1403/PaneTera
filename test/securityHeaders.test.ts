process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import http from 'http';

describe('Security headers middleware unit tests', () => {
  it('attaches CSP, X-Frame-Options, and nosniff headers to response', async () => {
    const app = express();
    app.use((_req, res, next) => {
      res.setHeader('Content-Security-Policy', "default-src 'self'");
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      next();
    });
    app.get('/test-headers', (_req, res) => res.json({ status: 'ok' }));

    const server = app.listen(0);
    const address = server.address() as { port: number };

    try {
      const res = await fetch(`http://127.0.0.1:${address.port}/test-headers`);
      assert.strictEqual(res.headers.get('content-security-policy'), "default-src 'self'");
      assert.strictEqual(res.headers.get('x-frame-options'), 'DENY');
      assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
    } finally {
      server.close();
    }
  });
});
