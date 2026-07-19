import assert from 'assert';
import { localAppProbe } from '../server/workbench/localAppProbe';
import http from 'http';

async function runTests() {
  console.log("Running Local App Probe Tests...");
  let server: http.Server;
  let port = 0;

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

  try {
    let res = await localAppProbe.probe(`http://127.0.0.1:${port}/ok`);
    assert.strictEqual(res.status, 'reachable');

    res = await localAppProbe.probe(`http://127.0.0.1:${port}/not-found`);
    assert.strictEqual(res.status, 'reachable');

    res = await localAppProbe.probe(`http://127.0.0.1:${port}/redirect`);
    assert.strictEqual(res.status, 'redirect');
    assert.strictEqual(res.redirectUrl, `http://127.0.0.1:${port}/ok`);

    res = await localAppProbe.probe(`http://127.0.0.1:${port}/block-csp`);
    assert.strictEqual(res.status, 'framing-likely-blocked');

    res = await localAppProbe.probe(`http://127.0.0.1:${port}/block-xframe`);
    assert.strictEqual(res.status, 'framing-likely-blocked');

    res = await localAppProbe.probe(`http://127.0.0.1:23499/ok`);
    assert.strictEqual(res.status, 'unavailable');

    res = await localAppProbe.probe(`http://user:pass@127.0.0.1:${port}/ok`);
    assert.strictEqual(res.status, 'invalid-configuration');
    assert.ok(res.details!.includes('credentials'));

    res = await localAppProbe.probe(`http://127.0.0.1:${port}/redirect-cred`);
    assert.strictEqual(res.status, 'invalid-configuration');
    assert.ok(res.details!.includes('credentials'));

    console.log("Local App Probe Tests passed.");
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
