// chrome-extension/test/message-routing.test.js
import assert from 'node:assert';
import { handleExtensionMessage } from '../messageRouting.js';

console.log('Running message-routing tests...');

// Mock adapters
let mockTokens = { accessToken: null, refreshToken: null };
let pendingPairing = null;
let badgeText = '';
const notifications = new Map();
let openedApprovalUrl = '';
const mockAdapters = {
  storage: {
    getInstallationId: async () => 'inst-test-1234',
    getAccessToken: async () => mockTokens.accessToken,
    setAccessToken: async (token) => { mockTokens.accessToken = token; },
    setRefreshToken: async (token) => { mockTokens.refreshToken = token; },
    clearTokens: async () => { mockTokens.accessToken = null; mockTokens.refreshToken = null; },
    getPendingPairing: async () => pendingPairing,
    setPendingPairing: async (value) => { pendingPairing = value; },
    clearPendingPairing: async () => { pendingPairing = null; }
  },
  transport: {
    request: async (path, options) => {
      if (path.includes('/pairing/exchange')) {
        const body = JSON.parse(options.body);
        if (body.code.replace(/-/g, '') === '12345678') {
          return {
            ok: true,
            json: async () => ({ accessToken: 'tok_test_access', refreshToken: 'ref_test_refresh' })
          };
        }
        return { ok: false, json: async () => ({ error: 'Invalid pairing code' }) };
      }
      if (path.includes('/api/browser/session')) {
        if (options?.method === 'DELETE') {
          return { ok: true, json: async () => ({ success: true }) };
        }
        // Mirror transport.request's reload recovery: a persisted refresh
        // token restores the session-scoped access token before retry.
        if (!mockTokens.accessToken && mockTokens.refreshToken) {
          mockTokens.accessToken = 'tok_refreshed_after_reload';
        }
        if (mockTokens.accessToken) {
          return { ok: true, json: async () => ({ runtimeId: 'runtime-123', installationId: 'inst-123' }) };
        }
        return { ok: false, status: 401 };
      }
      return { ok: false, status: 404 };
    }
  },
  chromeApi: {
    runtime: {
      id: 'ext-runtime-id-123',
      getURL: (path) => `chrome-extension://ext-runtime-id-123/${path}`
    },
    action: {
      setBadgeText: async ({ text }) => { badgeText = text; },
      setBadgeBackgroundColor: async () => undefined
    },
    notifications: {
      create: async (id, options) => { notifications.set(id, options); },
      clear: async (id) => notifications.delete(id)
    },
    tabs: {
      create: async ({ url }) => { openedApprovalUrl = url; return { id: 99, url }; },
      query: async () => [{ id: 1, url: 'https://example.com/test' }]
    }
  },
  validateOrigin: () => true
};

// 1. Unknown message type
await handleExtensionMessage({ type: 'unknown-action' }, mockAdapters, (res) => {
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, 'Unknown message type');
});

// 2. Check status when disconnected
await handleExtensionMessage({ type: 'check-status' }, mockAdapters, (res) => {
  assert.strictEqual(res.paired, false);
});

// 3. Local UI can deliver a pending pairing offer, but another page cannot.
await handleExtensionMessage({ type: 'offer-pairing', code: '1234-5678' }, mockAdapters, (res) => {
  assert.strictEqual(res.success, false);
}, { url: 'https://example.com/' });
assert.strictEqual(pendingPairing, null);

await handleExtensionMessage({ type: 'offer-pairing', code: '1234-5678' }, mockAdapters, (res) => {
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.pending, true);
}, { url: 'http://127.0.0.1:5173/' });
assert.strictEqual(pendingPairing.code, '1234-5678');
assert.strictEqual(badgeText, '1');
assert.strictEqual(openedApprovalUrl, 'chrome-extension://ext-runtime-id-123/pairing.html');

await handleExtensionMessage({ type: 'check-status' }, mockAdapters, (res) => {
  assert.strictEqual(res.paired, false);
  assert.strictEqual(res.pendingPairing.code, '1234-5678');
});

// 4. Approval uses the delivered code without exposing tokens to the page.
await handleExtensionMessage({ type: 'approve-pending-pairing' }, mockAdapters, (res) => {
  assert.strictEqual(res.success, true);
});
assert.strictEqual(pendingPairing, null);
assert.strictEqual(badgeText, '');
assert.ok(!notifications.has('panetera-pairing-request'));
assert.strictEqual(mockTokens.accessToken, 'tok_test_access');

// Reset to exercise the manual fallback too.
mockTokens = { accessToken: null, refreshToken: null };

// 5. Pairing with manually entered valid code
await handleExtensionMessage({ type: 'pair', code: '12345678' }, mockAdapters, (res) => {
  assert.strictEqual(res.success, true);
  assert.strictEqual(mockTokens.accessToken, 'tok_test_access');
  assert.strictEqual(mockTokens.refreshToken, 'ref_test_refresh');
});

// 6. Check status when connected
await handleExtensionMessage({ type: 'check-status' }, mockAdapters, (res) => {
  assert.strictEqual(res.paired, true);
  assert.strictEqual(res.session.installationId, 'inst-123');
});

// 6b. Reloading the unpacked extension clears chrome.storage.session but must
// recover from the refresh token kept in chrome.storage.local.
mockTokens.accessToken = null;
await handleExtensionMessage({ type: 'check-status' }, mockAdapters, (res) => {
  assert.strictEqual(res.paired, true);
});
assert.strictEqual(mockTokens.accessToken, 'tok_refreshed_after_reload');

// 7. Disconnect
await handleExtensionMessage({ type: 'disconnect' }, mockAdapters, (res) => {
  assert.strictEqual(res.success, true);
  assert.strictEqual(mockTokens.accessToken, null);
});

// 8. Cancelling in Rig clears the pending approval and toolbar attention.
await handleExtensionMessage({ type: 'offer-pairing', code: '1234-5678' }, mockAdapters, () => {}, { url: 'http://localhost:5173/' });
await handleExtensionMessage({ type: 'dismiss-pending-pairing' }, mockAdapters, (res) => {
  assert.strictEqual(res.success, true);
});
assert.strictEqual(pendingPairing, null);
assert.strictEqual(badgeText, '');

console.log('✅ message-routing tests passed.');
