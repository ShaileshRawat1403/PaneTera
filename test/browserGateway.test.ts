// test/browserGateway.test.ts
import express from 'express';
import assert from 'assert';
import http from 'http';
import { browserRouter } from '../server/browserGateway';
import { BrowserEvidenceStore, setBrowserEvidenceStoreForTest } from '../server/browserEvidenceStore';
import { sanitizeBrowserUrl, validateBrowserEnvelope } from '../server/browserGatewayValidation';

console.log('Running Browser Operator Gateway unit tests...');

const PORT = 4099;
const MASTER_TOKEN = 'test-master-token-abc';
process.env.PORTAL_TOKEN = MASTER_TOKEN;

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
  const allowed = new Set(['browser.page.observe']);
  const now = Date.now();
  const validEnvelope = {
    protocolVersion: '1.0', capabilityVersion: '1.0', transactionId: 'tx-validator', idempotencyKey: 'idem-validator',
    issuedAt: new Date(now).toISOString(), expiresAt: new Date(now + 30_000).toISOString(), capability: 'browser.page.observe',
    riskLevel: 'inspect', approval: { required: false, status: 'not-required', grantId: null },
    target: { tabId: 1, frameId: 0, expectedOrigin: 'https://example.com' },
    constraints: { maxElements: 1, maxOutputBytes: 10_000, timeoutMs: 5_000 },
    payload: { title: 'Example', url: 'https://example.com/', selectedText: '' }
  };
  assert.ok(validateBrowserEnvelope(validEnvelope, allowed, now).ok, 'canonical envelope should validate');
  assert.ok(!validateBrowserEnvelope({ ...validEnvelope, issuedAt: new Date(now - 6 * 60_000).toISOString() }, allowed, now).ok, 'stale issuedAt must fail');
  assert.ok(!validateBrowserEnvelope({ ...validEnvelope, constraints: { ...validEnvelope.constraints, maxOutputBytes: 0 } }, allowed, now).ok, 'zero byte constraint must fail');
  assert.ok(!validateBrowserEnvelope({ ...validEnvelope, idempotencyKey: '' }, allowed, now).ok, 'empty idempotency key must fail');
  assert.strictEqual(sanitizeBrowserUrl('https://user:pass@example.com/?token=raw-secret'), 'https://example.com/?token=%5BREDACTED%5D');

  await startServer();
  const testStore = new BrowserEvidenceStore();
  setBrowserEvidenceStoreForTest(testStore);

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

    const oversizedIdentityResp = await fetch(`http://127.0.0.1:${PORT}/api/browser/pairing/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, runtimeId: 'x'.repeat(101), installationId: 'inst-test-id' })
    });
    assert.strictEqual(oversizedIdentityResp.status, 400, 'oversized extension identities must be rejected');

    // 2. Exchange with invalid code
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

    const statusResp = await fetch(`http://127.0.0.1:${PORT}/api/browser/pairing/status`, {
      headers: { 'Authorization': `Bearer ${MASTER_TOKEN}` }
    });
    assert.strictEqual(statusResp.status, 200, 'Rig should read Browser Operator connection status');
    const pairingStatus = await statusResp.json() as { sessions: Array<{ sessionId: string; installationId: string }>; pending: boolean };
    assert.strictEqual(pairingStatus.sessions.length, 1);
    assert.strictEqual(pairingStatus.sessions[0]?.installationId, 'inst-test-id');
    assert.ok(!JSON.stringify(pairingStatus).includes(accessToken), 'Portal status must not expose extension tokens');

    // 4. Post Phase 1 observation
    let obsPayload = {
      protocolVersion: "1.0",
      capabilityVersion: "1.0",
      transactionId: "tx-test-123",
      idempotencyKey: "idem-test-123",
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30000).toISOString(),
      capability: "browser.page.observe",
      riskLevel: "inspect",
      approval: { required: false, status: 'not-required', grantId: null },
      constraints: { maxElements: 1, maxOutputBytes: 10000, timeoutMs: 5000 },
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

    // Verify session ID in provenance is NOT raw access token
    const observations = testStore.getObservations();
    assert.strictEqual(observations.length, 1);
    const firstObs = observations[0];
    assert.ok(firstObs && firstObs.ownership && firstObs.ownership.sourceSessionId, 'Observation ownership sourceSessionId should exist');
    assert.notStrictEqual(firstObs.ownership.sourceSessionId, accessToken, 'Access token must NEVER be stored in provenance');
    assert.ok(firstObs.ownership.sourceSessionId.startsWith('sess-'), 'Session ID in provenance must be independent sess- UUID');

    // 5. Post Phase 2 article extraction
    let phase2Payload = {
      protocolVersion: "1.0",
      capabilityVersion: "1.0",
      transactionId: "tx-test-456",
      idempotencyKey: "idem-test-456",
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30000).toISOString(),
      capability: "browser.article.extract",
      riskLevel: "inspect",
      approval: { required: false, status: 'not-required', grantId: null },
      constraints: { maxElements: 5000, maxOutputBytes: 2000000, timeoutMs: 5000 },
      target: {
        tabId: 99,
        frameId: 0,
        expectedOrigin: "https://example.com"
      },
      payload: {
        extractionId: "ext-uuid-789",
        parentCaptureId: "cap-uuid-123",
        capability: "browser.article.extract",
        source: {
          title: "Extracted Article sk-abcdefghijklmnopqrstuvwxyz123456",
          url: "https://user:pass@example.com/article-path?token=raw-secret",
          origin: "https://example.com",
          capturedAt: new Date().toISOString()
        },
        trust: {
          sourceType: "browser-dom",
          trustLevel: "untrusted",
          instructionAuthority: "none"
        },
        data: { evidenceId: 'ev-1', textContent: "Clean article text" },
        evidence: {
          items: [{ evidenceId: "ev-1", kind: "text", locator: { recipeId: "test" } }],
          elementsMatched: 999,
          contentBytes: 999999
        },
        warnings: [],
        truncated: false
      }
    };

    let p2Resp = await fetch(`http://127.0.0.1:${PORT}/api/browser/observations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(phase2Payload)
    });
    assert.strictEqual(p2Resp.status, 200, 'Phase 2 article extraction post should return 200');
    const storedExtraction = testStore.getExtractions()[0];
    assert.ok(storedExtraction, 'Phase 2 extraction should be stored');
    assert.strictEqual(storedExtraction.source.url.includes('raw-secret'), false, 'server must redact source URL secrets');
    assert.strictEqual(storedExtraction.source.url.includes('user:pass'), false, 'server must strip source URL credentials');
    assert.strictEqual(storedExtraction.source.title.includes('sk-abc'), false, 'server must redact source title credentials');
    assert.strictEqual(storedExtraction.evidence.items[0].content, 'Clean article text', 'server must enrich locator evidence with canonical content');
    assert.strictEqual(storedExtraction.evidence.items[0].contentBytes, Buffer.byteLength('Clean article text'));
    assert.strictEqual(storedExtraction.evidence.elementsMatched, 1, 'server must overwrite client evidence counts');
    assert.strictEqual(storedExtraction.evidence.contentBytes, Buffer.byteLength('Clean article text'), 'server must recompute evidence bytes');

    // 6. Test origin mismatch
    let badObsPayload = {
      ...obsPayload,
      idempotencyKey: 'idem-mismatch-' + Date.now(),
      target: {
        ...obsPayload.target,
        expectedOrigin: "https://hacker.com"
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

    // 7. Malformed payload rejection (missing source)
    let malformedPayload = {
      ...phase2Payload,
      idempotencyKey: 'idem-malformed-' + Date.now(),
      payload: {
        extractionId: "ext-1",
        capability: "browser.article.extract"
        // missing source object
      }
    };
    let malformedResp = await fetch(`http://127.0.0.1:${PORT}/api/browser/observations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(malformedPayload)
    });
    assert.strictEqual(malformedResp.status, 400, 'Malformed payload should return 400 Bad Request');

    const correctedRetry = {
      ...phase2Payload,
      idempotencyKey: malformedPayload.idempotencyKey,
      transactionId: 'tx-corrected-retry',
      payload: { ...phase2Payload.payload, extractionId: 'ext-corrected-retry' }
    };
    const correctedResp = await fetch(`http://127.0.0.1:${PORT}/api/browser/observations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify(correctedRetry)
    });
    assert.strictEqual(correctedResp.status, 200, 'a rejected request must not burn its idempotency key');

    const orphanPayload = {
      ...phase2Payload,
      transactionId: 'tx-orphan-evidence',
      idempotencyKey: 'idem-orphan-evidence',
      payload: {
        ...phase2Payload.payload,
        extractionId: 'ext-orphan-evidence',
        data: { evidenceId: 'different-id', textContent: 'orphaned' }
      }
    };
    const orphanResp = await fetch(`http://127.0.0.1:${PORT}/api/browser/observations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify(orphanPayload)
    });
    assert.strictEqual(orphanResp.status, 400, 'evidence without a matching data record must be rejected');

    // 8. Revocation test
    let deleteResp = await fetch(`http://127.0.0.1:${PORT}/api/browser/session`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    assert.strictEqual(deleteResp.status, 200, 'Session deletion should return 200');

    // 9. Rig can revoke a browser connection without possessing its extension token.
    const secondStart = await fetch(`http://127.0.0.1:${PORT}/api/browser/pairing/start`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${MASTER_TOKEN}` }
    });
    const secondCode = ((await secondStart.json()) as { code: string }).code;
    const secondExchange = await fetch(`http://127.0.0.1:${PORT}/api/browser/pairing/exchange`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: secondCode, runtimeId: 'ext-test-id', installationId: 'inst-admin-revoke' })
    });
    const secondTokens = await secondExchange.json() as { accessToken: string };
    const secondStatus = await fetch(`http://127.0.0.1:${PORT}/api/browser/pairing/status`, {
      headers: { 'Authorization': `Bearer ${MASTER_TOKEN}` }
    });
    const secondSessions = (await secondStatus.json()) as { sessions: Array<{ sessionId: string; installationId: string }> };
    const adminSession = secondSessions.sessions.find((session) => session.installationId === 'inst-admin-revoke');
    assert.ok(adminSession, 'second browser session should be visible to Rig');
    const adminRevoke = await fetch(`http://127.0.0.1:${PORT}/api/browser/pairing/sessions/${adminSession.sessionId}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${MASTER_TOKEN}` }
    });
    assert.strictEqual(adminRevoke.status, 200, 'Rig should revoke the browser connection');
    const revokedSession = await fetch(`http://127.0.0.1:${PORT}/api/browser/session`, {
      headers: { 'Authorization': `Bearer ${secondTokens.accessToken}` }
    });
    assert.strictEqual(revokedSession.status, 401, 'revoked extension token must stop working');

    const cancellableStart = await fetch(`http://127.0.0.1:${PORT}/api/browser/pairing/start`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${MASTER_TOKEN}` }
    });
    assert.strictEqual(cancellableStart.status, 200);
    const cancelPending = await fetch(`http://127.0.0.1:${PORT}/api/browser/pairing/pending`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${MASTER_TOKEN}` }
    });
    assert.strictEqual(cancelPending.status, 200, 'Rig should cancel an unfinished browser request');
    const cancelledStatus = await fetch(`http://127.0.0.1:${PORT}/api/browser/pairing/status`, {
      headers: { 'Authorization': `Bearer ${MASTER_TOKEN}` }
    });
    assert.strictEqual(((await cancelledStatus.json()) as { pending: boolean }).pending, false);

    console.log('✓ All Browser Operator Gateway unit tests passed!');
  } catch (err: any) {
    console.error('FAIL:', err);
    process.exitCode = 1;
  } finally {
    setBrowserEvidenceStoreForTest(undefined);
    await stopServer();
  }
}

runTests();
