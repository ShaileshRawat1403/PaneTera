// test/browserGateway.test.ts
import express from 'express';
import assert from 'assert';
import http from 'http';
import { browserRouter, observations } from '../server/browserGateway';

console.log('Running Browser Operator Gateway unit tests...');

const PORT = 4099;
const MASTER_TOKEN = 'test-master-token-abc';
process.env.PORTAL_TOKEN = MASTER_TOKEN;

// Setup a mock express server mounting the browser router
const app = express();
app.use(express.json());
app.use('/api/browser', browserRouter);

let server: http.Server;

function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(PORT, '127.0.0.1', () => {
      resolve();
    });
  });
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}

async function runTests() {
  await startServer();

  try {
    // 1. Generate pairing code (Requires Master Token)
    let startResp = await fetch(`http://127.0.0.1:${PORT}/api/browser/pairing/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MASTER_TOKEN}`
      }
    });
    assert.strictEqual(startResp.status, 200, 'Pairing start should return 200');
    const startData = await startResp.json() as { code: string };
    const code = startData.code;
    assert.ok(code, 'Pairing start should return a code');
    assert.strictEqual(code.length, 9, 'Pairing code should be 8 chars with a dash');

    // 2. Exchange with invalid code to verify attempt increment
    let exchangeResp = await fetch(`http://127.0.0.1:${PORT}/api/browser/pairing/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: 'WRONG-CODE',
        runtimeId: 'ext-test-id',
        installationId: 'inst-test-id'
      })
    });
    assert.strictEqual(exchangeResp.status, 400, 'Invalid pairing code should return 400');
    const exchangeErr = await exchangeResp.json() as { error: string };
    assert.strictEqual(exchangeErr.error, 'Invalid pairing code');

    // 3. Exchange with valid code
    let validExchangeResp = await fetch(`http://127.0.0.1:${PORT}/api/browser/pairing/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: code,
        runtimeId: 'ext-test-id',
        installationId: 'inst-test-id'
      })
    });
    assert.strictEqual(validExchangeResp.status, 200, 'Valid pairing code should return 200');
    const tokens = await validExchangeResp.json() as { accessToken: string; refreshToken: string };
    assert.ok(tokens.accessToken, 'Should return accessToken');
    assert.ok(tokens.refreshToken, 'Should return refreshToken');

    const accessToken = tokens.accessToken;

    // 4. Try posting an observation with correct origin
    let obsPayload = {
      protocolVersion: "1.0",
      capabilityVersion: "1.0",
      transactionId: "tx-test-123",
      idempotencyKey: "idem-test-123",
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30000).toISOString(),
      capability: "browser.page.observe",
      riskLevel: "inspect",
      target: {
        tabId: 99,
        frameId: 0,
        expectedOrigin: "https://example.com"
      },
      payload: {
        title: "Example Title",
        url: "https://example.com/test-path",
        selectedText: "Hello Selection"
      }
    };

    let obsResp = await fetch(`http://127.0.0.1:${PORT}/api/browser/observations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(obsPayload)
    });
    assert.strictEqual(obsResp.status, 200, 'Valid observation post should return 200');
    const obsResult = await obsResp.json() as any;
    assert.strictEqual(obsResult.status, 'completed', 'Status should be completed');
    assert.ok(obsResult.data.captureId, 'Should return a captureId');

    // 5. Try posting an observation with mismatching origin to test security guard
    let badObsPayload = {
      ...obsPayload,
      target: {
        ...obsPayload.target,
        expectedOrigin: "https://hacker.com" // Mismatch origin
      }
    };
    let badObsResp = await fetch(`http://127.0.0.1:${PORT}/api/browser/observations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(badObsPayload)
    });
    assert.strictEqual(badObsResp.status, 400, 'Mismatching origin should return 400 Bad Request');
    const badObsErr = await badObsResp.json() as { error: string };
    assert.ok(badObsErr.error.includes('mismatch'), 'Should return origin mismatch error');

    // 6. Test polling of observations list
    let pollResp = await fetch(`http://127.0.0.1:${PORT}/api/browser/observations`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    assert.strictEqual(pollResp.status, 200, 'Poll observations should return 200');
    const list = await pollResp.json() as any[];
    assert.strictEqual(list.length, 1, 'Should have exactly 1 observation');
    assert.strictEqual(list[0].selectedText, 'Hello Selection', 'Observation text should match');

    // 7. Test cursor polling
    let futureCursor = new Date(Date.now() + 10000).toISOString();
    let pollCursorResp = await fetch(`http://127.0.0.1:${PORT}/api/browser/observations?after=${futureCursor}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    const cursorList = await pollCursorResp.json() as any[];
    assert.strictEqual(cursorList.length, 0, 'Cursor poll for future timestamp should return empty list');

    // 8. Revocation test
    let deleteResp = await fetch(`http://127.0.0.1:${PORT}/api/browser/session`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    assert.strictEqual(deleteResp.status, 200, 'Session deletion should return 200');

    // Subsequent observation request should fail with 401
    let failedObsResp = await fetch(`http://127.0.0.1:${PORT}/api/browser/observations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(obsPayload)
    });
    assert.strictEqual(failedObsResp.status, 401, 'Request with revoked token should return 401');

    console.log('✓ All Browser Operator Gateway unit tests passed!');
  } catch (err: any) {
    console.error('FAIL:', err);
    await stopServer();
    process.exit(1);
  }

  await stopServer();
}

runTests();
