// chrome-extension/test/production-probes.test.js
import assert from 'node:assert';
import { redactText, sanitizeUrl, redactObject } from '../shared/redactor.js';
import { performCaptureWithAdapters } from '../messageRouting.js';
import { buildDeterministicZip } from '../scripts/zip.js';
import fs from 'node:fs';

console.log('Running production-path probe regression tests...');

// 1. Probe 1: Selection text with sk- credential is redacted before envelope creation
const secretSelection = 'Please check my secret key sk-abcdef1234567890abcdef1234567890 for API access';
const mockAdapters = {
  chromeApi: {
    runtime: { id: 'ext-probe-123' },
    scripting: {
      executeScript: async ({ func, files }) => {
        if (files) {
          return [{ frameId: 0, documentId: 'doc-probe-100', result: null }];
        }
        if (func) {
          // Extractor or revalidation call
          return [{
            frameId: 0,
            documentId: 'doc-probe-100',
            result: {
              title: 'Secret Page Title with sk-123456789012345678901234567890',
              url: 'https://example.com/path?token=secret123',
              origin: 'https://example.com',
              selectedText: secretSelection,
              readyState: 'complete'
            }
          }];
        }
      }
    },
    notifications: { create: () => {} }
  },
  transport: {
    request: async (path, options) => {
      const payload = JSON.parse(options.body);
      // Validate that selectionText, title, and URL are redacted in the transmitted envelope!
      assert.strictEqual(payload.payload.selectedText.includes('sk-abcdef'), false, 'Transmitted selectionText MUST NOT contain raw sk- credential');
      assert.strictEqual(payload.payload.selectedText.includes('[REDACTED_CREDENTIAL]'), true, 'Transmitted selectionText MUST contain redaction marker');
      assert.strictEqual(payload.payload.title.includes('sk-123456'), false, 'Transmitted title MUST NOT contain raw sk- credential');
      assert.strictEqual(payload.payload.url.includes('secret123'), false, 'Transmitted URL MUST NOT contain raw query token');
      return { ok: true, json: async () => ({ captureId: 'cap-probe-1' }) };
    }
  },
  validateOrigin: () => true
};

await performCaptureWithAdapters({
  tab: { id: 1, url: 'https://example.com/path?token=secret123' },
  trigger: 'context-menu',
  selectionText: secretSelection,
  capability: 'browser.selection.observe'
}, mockAdapters);
console.log('✅ Probe 1 (Selection text secret redaction) passed.');

// 2. Probe 2: Declared maxOutputBytes breach is rejected at client before dispatch
const mockAdaptersBreach = {
  ...mockAdapters,
  transport: {
    request: async () => {
      assert.fail('Network request MUST NOT be made when payload breaches declared maxOutputBytes ceiling');
    }
  }
};

let breachCaught = false;
try {
  // Synthesize a payload that exceeds 10,000 bytes when constraints.maxOutputBytes is 10,000
  const largeTitle = 'A'.repeat(15000);
  const breachMockAdapters = {
    ...mockAdaptersBreach,
    chromeApi: {
      ...mockAdaptersBreach.chromeApi,
      scripting: {
        executeScript: async () => [{
          frameId: 0,
          documentId: 'doc-breach-100',
          result: { title: largeTitle, url: 'https://example.com/', origin: 'https://example.com', readyState: 'complete' }
        }]
      }
    }
  };
  await performCaptureWithAdapters({
    tab: { id: 1, url: 'https://example.com/' },
    trigger: 'popup',
    capability: 'browser.page.observe'
  }, breachMockAdapters);
} catch (err) {
  breachCaught = true;
  assert.ok(err.message.includes('breaches effective limit'), 'Should throw breach error');
}
assert.strictEqual(breachCaught, true, 'Client must refuse dispatch when declared ceiling is breached');
console.log('✅ Probe 2 (Declared maxOutputBytes breach refusal) passed.');

// 3. Probe 3: Same-origin URL navigation policy rejection (/a -> /b)
let navCaught = false;
try {
  let callCount = 0;
  const navMockAdapters = {
    ...mockAdapters,
    chromeApi: {
      ...mockAdapters.chromeApi,
      scripting: {
        executeScript: async ({ func, files }) => {
          callCount++;
          if (files) return [{ frameId: 0, documentId: 'doc-nav-1', result: null }];
          if (callCount === 2) {
            // Extractor returns URL /page-a
            return [{ frameId: 0, documentId: 'doc-nav-1', result: { title: 'Page A', url: 'https://example.com/page-a', origin: 'https://example.com', readyState: 'complete' } }];
          } else {
            // Revalidation returns URL /page-b (same origin, different URL!)
            return [{ frameId: 0, documentId: 'doc-nav-1', result: { url: 'https://example.com/page-b', origin: 'https://example.com', readyState: 'complete' } }];
          }
        }
      }
    }
  };

  await performCaptureWithAdapters({
    tab: { id: 1, url: 'https://example.com/page-a' },
    trigger: 'popup',
    capability: 'browser.page.observe'
  }, navMockAdapters);
} catch (err) {
  navCaught = true;
  assert.ok(err.message.includes('Exact URL mismatch policy breach'), 'Should reject URL navigation');
}
assert.strictEqual(navCaught, true, 'Same-origin URL navigation (/a -> /b) must be rejected prior to dispatch');
console.log('✅ Probe 3 (Same-origin URL navigation policy rejection) passed.');

// 3b. Sensitive query changes must not collapse under URL redaction.
let secretQueryNavigationCaught = false;
try {
  let callCount = 0;
  const secretNavAdapters = {
    ...mockAdapters,
    chromeApi: {
      ...mockAdapters.chromeApi,
      scripting: {
        executeScript: async ({ files }) => {
          callCount++;
          if (files) return [{ frameId: 0, documentId: 'doc-token-nav', result: null }];
          if (callCount === 2) {
            return [{ frameId: 0, documentId: 'doc-token-nav', result: { url: 'https://example.com/page?token=first-secret', origin: 'https://example.com', readyState: 'complete' } }];
          }
          if (callCount === 3) {
            return [{ frameId: 0, documentId: 'doc-token-nav', result: { title: 'Page', url: 'https://example.com/page?token=%5BREDACTED%5D', origin: 'https://example.com', readyState: 'complete' } }];
          }
          return [{ frameId: 0, documentId: 'doc-token-nav', result: { url: 'https://example.com/page?token=second-secret', origin: 'https://example.com', readyState: 'complete' } }];
        }
      }
    },
    transport: { request: async () => assert.fail('changed raw URL identity must prevent dispatch') }
  };
  await performCaptureWithAdapters({
    tab: { id: 1, url: 'https://example.com/page?token=first-secret' },
    trigger: 'popup',
    capability: 'browser.page.observe'
  }, secretNavAdapters);
} catch (error) {
  secretQueryNavigationCaught = true;
  assert.ok(error.message.includes('Exact URL mismatch policy breach'));
  assert.strictEqual(error.message.includes('first-secret'), false, 'identity errors must not disclose raw URLs');
  assert.strictEqual(error.message.includes('second-secret'), false, 'identity errors must not disclose raw URLs');
}
assert.strictEqual(secretQueryNavigationCaught, true, 'different sensitive query values must remain different document identities');
console.log('✅ Probe 3b (Sensitive-query navigation rejection) passed.');

let missingDocumentIdCaught = false;
try {
  const noDocumentIdAdapters = {
    ...mockAdapters,
    chromeApi: {
      ...mockAdapters.chromeApi,
      scripting: {
        executeScript: async ({ files }) => [{ frameId: 0, result: files ? null : { title: 'Page', url: 'https://example.com/', origin: 'https://example.com', readyState: 'complete' } }]
      }
    },
    transport: { request: async () => assert.fail('capture without document identity must not dispatch') }
  };
  await performCaptureWithAdapters({ tab: { id: 1, url: 'https://example.com/' }, trigger: 'popup' }, noDocumentIdAdapters);
} catch (error) {
  missingDocumentIdCaught = true;
  assert.ok(error.message.includes('Document identity mismatch'));
}
assert.strictEqual(missingDocumentIdCaught, true, 'all capture stages must provide the same documentId');

await assert.rejects(
  performCaptureWithAdapters({ tab: { id: 1, url: 'file:///tmp/private.txt' }, trigger: 'popup' }, mockAdapters),
  /cannot be captured/
);
console.log('✅ Probe 3c (Document identity and protocol refusal) passed.');

// 4. Probe 4: Deep object traversal sentinel replacement
const deepSecret = { level1: { level2: { level3: { level4: { level5: { level6: { secretKey: 'sk-abcdef1234567890abcdef1234567890' } } } } } } };
const redactedDeep = redactObject(deepSecret);
const jsonString = JSON.stringify(redactedDeep);
assert.strictEqual(jsonString.includes('sk-abcdef'), false, 'Deeply nested secret MUST NOT be present');
assert.strictEqual(jsonString.includes('[TRUNCATED_MAX_DEPTH]'), true, 'Max depth overflow MUST return bounded sentinel');
console.log('✅ Probe 4 (Deep object truncation sentinel replacement) passed.');

// 5. Probe 5: Repeated packaging hash verification. Timestamp inspection and
// delayed-build reproducibility are covered by reproducible-build.test.js.
const zipRes1 = buildDeterministicZip();
const zipRes2 = buildDeterministicZip();
assert.strictEqual(zipRes1.hash, zipRes2.hash, 'Zip hashes must match byte-for-byte');
console.log('✅ Probe 5 (Repeated packaging hash verification) passed.');

console.log('✅ All production-path probe regression tests passed!');
