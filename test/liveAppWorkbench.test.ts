import assert from 'assert';
import { parseLiveAppIntent, buildLiveAppWorkbench } from '../server/liveApp';

console.log('Running live app workbench tests...');

// 1. Intent Parser Tests
const validQueries = [
  'inspect soothsayer',
  'show soothsayer live app',
  'open soothsayer workbench',
  'soothsayer status',
  'soothsayer live preview',
  'review soothsayer app',
  'inspect soothsayer  ',
];

for (const q of validQueries) {
  const parsed = parseLiveAppIntent(q);
  assert.ok(parsed !== null, `Should parse intent for: "${q}"`);
  assert.strictEqual(parsed.appName, 'soothsayer', `Should target soothsayer: "${q}"`);
}

const invalidQueries = [
  'hello',
  'inspect websiteops',
  'show flowright status',
  'soothsayer',
  'list files in soothsayer',
];

for (const q of invalidQueries) {
  const parsed = parseLiveAppIntent(q);
  assert.strictEqual(parsed, null, `Should ignore query: "${q}"`);
}

async function runAsyncTests() {
  // 2. Unconfigured tests
  const unconfigured = await buildLiveAppWorkbench('soothsayer', undefined);
  assert.strictEqual(unconfigured.appName, 'Soothsayer');
  assert.strictEqual(unconfigured.configured, false, 'Should be configured: false when URL is unset');
  assert.strictEqual(unconfigured.manifestAvailable, false, 'Should be manifestAvailable: false');
  assert.strictEqual(unconfigured.previewOnly, true, 'Should be previewOnly: true');
  assert.ok(
    unconfigured.warnings.includes('SOOTHSAYER_LIVE_URL is not configured.'),
    'Should contain configuration warning',
  );

  // 3. Configured tests with Mock Fetch
  const originalFetch = globalThis.fetch;

  // Mock fetch to handle base URL and manifest URL fetches
  globalThis.fetch = async (url: string | URL | Request) => {
    const urlStr = String(url);
    if (urlStr === 'http://127.0.0.1:3101') {
      return {
        ok: true,
      } as unknown as Response;
    }
    if (urlStr === 'http://127.0.0.1:3101/api/portal-manifest') {
      return {
        ok: true,
        json: async () => ({
          environment: 'staging',
          version: '1.4.2-beta',
          routes: ['GET /api/workflows', 'POST /api/workflows/run'],
          features: ['flowright-runtime', 'dynamic-console'],
          workflows: ['CMS Publish Workflow'],
          health: { status: 'healthy', dbConnected: true },
        }),
      } as unknown as Response;
    }
    throw new Error(`Unexpected fetch URL: ${urlStr}`);
  };

  try {
    const proposal = await buildLiveAppWorkbench('soothsayer', 'http://127.0.0.1:3101/');
    assert.strictEqual(proposal.configured, true, 'Should be configured: true');
    assert.strictEqual(proposal.urlReachable, true, 'urlReachable should be true');
    assert.strictEqual(proposal.manifestReachable, true, 'manifestReachable should be true');
    assert.strictEqual(proposal.manifestAvailable, true, 'Should be manifestAvailable: true');
    assert.strictEqual(proposal.environment, 'staging');
    assert.strictEqual(proposal.version, '1.4.2-beta');
    assert.strictEqual(proposal.routes.length, 2);
    assert.strictEqual(proposal.features.length, 2);
    assert.strictEqual(proposal.workflows.length, 1);
    assert.ok(proposal.health && proposal.health.status === 'healthy');
    assert.strictEqual(proposal.previewOnly, true);
  } finally {
    globalThis.fetch = originalFetch;
  }

  // 4. Configured tests with Failing fetch
  globalThis.fetch = async (url: string | URL | Request) => {
    throw new Error('Connection refused');
  };

  try {
    const failedProposal = await buildLiveAppWorkbench('soothsayer', 'http://127.0.0.1:9999');
    assert.strictEqual(failedProposal.configured, true);
    assert.strictEqual(failedProposal.urlReachable, false);
    assert.strictEqual(failedProposal.manifestReachable, false);
    assert.strictEqual(failedProposal.manifestAvailable, false);
    assert.ok(
      failedProposal.warnings.some((w) => w.includes('Failed to reach manifest endpoint')),
      'Should contain connection refused warning',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('✓ All live app workbench tests passed!');
}

runAsyncTests().catch((err) => {
  console.error('✗ Tests failed:', err);
  process.exit(1);
});
