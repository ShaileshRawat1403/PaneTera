import assert from 'node:assert';

console.log('Running token refresh lifecycle tests...');

let accessToken = null;
const refreshToken = 'ref_persisted';
let refreshRequests = 0;

globalThis.chrome = {
  storage: {
    session: {
      get: (_keys, callback) => callback({ accessToken }),
      set: (value, callback) => { accessToken = value.accessToken; callback(); },
    },
    local: {
      get: (keys, callback) => callback(keys.includes('refreshToken')
        ? { refreshToken }
        : { installationId: 'inst-test' }),
      set: (_value, callback) => callback(),
    },
  },
};

globalThis.fetch = async (url, options = {}) => {
  if (url.endsWith('/api/browser/token/refresh')) {
    refreshRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { ok: true, status: 200, json: async () => ({ accessToken: 'tok_restored' }) };
  }
  const authorization = options.headers?.Authorization;
  if (authorization === 'Bearer tok_restored') {
    return { ok: true, status: 200, json: async () => ({ paired: true }) };
  }
  return { ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) };
};

const { request } = await import(`../transport.js?refresh=${Date.now()}`);
const [first, second] = await Promise.all([
  request('/api/browser/session'),
  request('/api/browser/session'),
]);

assert.strictEqual(first.ok, true);
assert.strictEqual(second.ok, true);
assert.strictEqual(accessToken, 'tok_restored');
assert.strictEqual(refreshRequests, 1, 'concurrent status checks must share one token refresh');

delete globalThis.fetch;
delete globalThis.chrome;
console.log('✅ token refresh lifecycle tests passed.');
