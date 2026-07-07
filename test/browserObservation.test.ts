process.env.NODE_ENV = 'test';
process.env.PORTAL_TOKEN = 'test-verification-token';

import assert from 'assert';
import http from 'http';
import { parseWorkflowIntent } from '../server/workflowIntents';

console.log('Running browser observation and security tests...');

const PORT = 4567;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function makePostRequest(path: string, payload: any, token = 'test-verification-token'): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      `${BASE_URL}${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Content-Length': Buffer.byteLength(data)
        }
      },
      (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode || 0,
              body: body ? JSON.parse(body) : null
            });
          } catch (e) {
            resolve({ status: res.statusCode || 0, body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTests() {
  const { app, latestObservations } = await import('../server/index');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, '127.0.0.1', () => resolve()));

  try {
    // 1. Accepts valid observation payload
    const validPayload = {
      source: 'chrome-observation',
      url: 'https://example.com/visible-page',
      title: 'A Safe Page',
      observedAt: new Date().toISOString(),
      domOutline: [
        { role: 'heading', text: 'Safe Heading', level: 1 },
        { role: 'button', text: 'Click Me' }
      ],
      screenshotDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    };

    const resValid = await makePostRequest('/api/browser-observation', validPayload);
    assert.strictEqual(resValid.status, 200, 'Valid observation must be accepted');
    assert.strictEqual(resValid.body?.type, 'BrowserObservation');
    assert.strictEqual(resValid.body?.data?.title, 'A Safe Page');
    assert.strictEqual(latestObservations.length, 1);

    // 2. Rejects request with missing token / invalid token
    const resNoToken = await makePostRequest('/api/browser-observation', validPayload, 'bad-token');
    assert.strictEqual(resNoToken.status, 401, 'Request with bad token must be rejected with 401');

    // 3. Rejects payload containing "cookies" key
    const payloadWithCookies = {
      ...validPayload,
      cookies: 'session=xyz'
    };
    const resCookies = await makePostRequest('/api/browser-observation', payloadWithCookies);
    assert.strictEqual(resCookies.status, 400, 'Payload with cookies must be rejected');

    const payloadWithCookieLikeKey = {
      ...validPayload,
      session_cookie_value: 'abc'
    };
    const resCookieLikeKey = await makePostRequest('/api/browser-observation', payloadWithCookieLikeKey);
    assert.strictEqual(resCookieLikeKey.status, 400, 'Payload with cookie-like key names must be rejected');

    // 4. Rejects payload with nested suspicious keys (token)
    const payloadWithNestedToken = {
      ...validPayload,
      domOutline: [
        { role: 'heading', text: 'Safe' }
      ],
      customMetadata: {
        someToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
      }
    };
    const resNestedToken = await makePostRequest('/api/browser-observation', payloadWithNestedToken);
    assert.strictEqual(resNestedToken.status, 400, 'Payload with nested token key must be rejected');

    // 5. Rejects payload with suspicious values (sk- key, Bearer, etc)
    const payloadWithSkKey = {
      ...validPayload,
      title: 'sk-1234567890abcdef'
    };
    const resSkKey = await makePostRequest('/api/browser-observation', payloadWithSkKey);
    assert.strictEqual(resSkKey.status, 400, 'Payload with sk- prefix value must be rejected');

    const payloadWithUpperSkKey = {
      ...validPayload,
      title: 'SK-1234567890abcdef'
    };
    const resUpperSkKey = await makePostRequest('/api/browser-observation', payloadWithUpperSkKey);
    assert.strictEqual(resUpperSkKey.status, 400, 'Payload with uppercase SK- prefix value must be rejected');

    // 6. Rejects oversized screenshot (over 1.5MB)
    const hugeBase64 = 'data:image/png;base64,' + 'A'.repeat(1.6 * 1024 * 1024);
    const payloadOversized = {
      ...validPayload,
      screenshotDataUrl: hugeBase64
    };
    const resOversized = await makePostRequest('/api/browser-observation', payloadOversized);
    assert.ok(resOversized.status === 400 || resOversized.status === 413, 'Oversized screenshot must be rejected');

    // 7. Caps domOutline to 80 entries and truncates text items to 300 chars
    const lotsOfItems = Array.from({ length: 120 }, (_, i) => ({
      role: 'text',
      text: `Item ${i}: ` + 'X'.repeat(400)
    }));
    const payloadCapping = {
      ...validPayload,
      domOutline: lotsOfItems
    };
    const resCapping = await makePostRequest('/api/browser-observation', payloadCapping);
    assert.strictEqual(resCapping.status, 200);
    assert.strictEqual(resCapping.body.data.domOutline.length, 80, 'DOM outline must be capped to 80 items');
    assert.strictEqual(resCapping.body.data.domOutline[0].text.length, 300, 'Each text item must be capped to 300 chars');

    // 8. Drops unsupported roles and password inputs from the observation outline
    const payloadWithUnsafeOutline = {
      ...validPayload,
      domOutline: [
        { role: 'script', text: 'console.log("no")' },
        { role: 'input', text: 'password' },
        { role: 'heading', text: 'Visible Heading', level: 1 }
      ]
    };
    const resUnsafeOutline = await makePostRequest('/api/browser-observation', payloadWithUnsafeOutline);
    assert.strictEqual(resUnsafeOutline.status, 200);
    assert.deepStrictEqual(
      resUnsafeOutline.body.data.domOutline,
      [{ role: 'heading', text: 'Visible Heading', level: 1 }],
      'Observation should keep only allowed roles and drop password inputs',
    );

    // 9. Retrieval check: "show latest browser observation"
    const chatRes = await makePostRequest('/api/chat', { query: 'show latest browser observation' });
    assert.strictEqual(chatRes.status, 200);
    assert.strictEqual(chatRes.body.uiComponent?.type, 'BrowserObservation');
    assert.strictEqual(chatRes.body.uiComponent?.data?.title, 'A Safe Page');

    // 10. Core developer queries check
    const checkCommit = parseWorkflowIntent('check my commit for regressions');
    assert.strictEqual(checkCommit, null, 'Core dev commands should not be parsed by workflow gateway');

    const verifyFlow = parseWorkflowIntent('run npm run verify in flowright');
    assert.strictEqual(verifyFlow, null);

    const gitStatus = parseWorkflowIntent('git status in flowright');
    assert.strictEqual(gitStatus, null);

    const soothsayerUi = parseWorkflowIntent('show soothsayer ui');
    assert.strictEqual(soothsayerUi?.kind, 'soothsayer-workbench');

    const blog = parseWorkflowIntent('write a blog post about pothos pruning mistakes');
    assert.strictEqual(blog?.kind, 'contentops-draft');

    console.log('✓ All browser observation and security tests passed!');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('✗ Tests failed:', err);
  process.exit(1);
});
