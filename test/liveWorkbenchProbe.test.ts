import { expect, test, describe, beforeAll, afterAll } from 'vitest';
import { localAppProbe } from '../server/workbench/localAppProbe';
import http from 'http';

describe('Local App Probe', () => {
  let server: http.Server;
  let port = 0;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/ok') {
        res.writeHead(200);
        res.end('ok');
      } else if (req.url === '/redirect') {
        res.writeHead(302, { Location: '/ok' });
        res.end();
      } else if (req.url === '/redirect-cred') {
        res.writeHead(302, { Location: 'http://user:pass@127.0.0.1:' + port + '/ok' });
        res.end();
      } else if (req.url === '/block-csp') {
        res.writeHead(200, { 'Content-Security-Policy': "frame-ancestors 'none'" });
        res.end('ok');
      } else if (req.url === '/block-xframe') {
        res.writeHead(200, { 'X-Frame-Options': 'DENY' });
        res.end('ok');
      } else {
        res.writeHead(404);
        res.end('not found');
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = (server.address() as import('net').AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  test('returns reachable for normal 200 response', async () => {
    const res = await localAppProbe.probe(`http://127.0.0.1:${port}/ok`);
    expect(res.status).toBe('reachable');
  });

  test('returns reachable for 404 response', async () => {
    const res = await localAppProbe.probe(`http://127.0.0.1:${port}/not-found`);
    expect(res.status).toBe('reachable');
  });

  test('returns redirect for 3xx response', async () => {
    const res = await localAppProbe.probe(`http://127.0.0.1:${port}/redirect`);
    expect(res.status).toBe('redirect');
    expect(res.redirectUrl).toBe(`http://127.0.0.1:${port}/ok`);
  });

  test('detects CSP frame blocking', async () => {
    const res = await localAppProbe.probe(`http://127.0.0.1:${port}/block-csp`);
    expect(res.status).toBe('framing-likely-blocked');
  });

  test('detects X-Frame-Options blocking', async () => {
    const res = await localAppProbe.probe(`http://127.0.0.1:${port}/block-xframe`);
    expect(res.status).toBe('framing-likely-blocked');
  });

  test('returns unavailable for broken port', async () => {
    // Pick an unlikely port
    const res = await localAppProbe.probe(`http://127.0.0.1:23499/ok`);
    expect(res.status).toBe('unavailable');
  });

  test('rejects URLs containing credentials immediately', async () => {
    const res = await localAppProbe.probe(`http://user:pass@127.0.0.1:${port}/ok`);
    expect(res.status).toBe('invalid-configuration');
    expect(res.details).toContain('credentials');
  });

  test('rejects redirects containing credentials', async () => {
    const res = await localAppProbe.probe(`http://127.0.0.1:${port}/redirect-cred`);
    expect(res.status).toBe('invalid-configuration');
    expect(res.details).toContain('credentials');
  });
});
