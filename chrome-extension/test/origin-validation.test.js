// chrome-extension/test/origin-validation.test.js
import assert from 'node:assert';
import { normalizePublicHttpUrl, validateOrigin } from '../shared/validation.js';

console.log('Running origin-validation tests...');

// 1. Exact origin match
assert.strictEqual(validateOrigin('https://example.com', 'https://example.com/page?query=1'), true);

// 2. Case-insensitive match
assert.strictEqual(validateOrigin('HTTPS://EXAMPLE.COM', 'https://example.com/'), true);

// 3. Mismatched host
assert.strictEqual(validateOrigin('https://example.com', 'https://attacker.com/page'), false);

// 4. Mismatched scheme (http vs https)
assert.strictEqual(validateOrigin('https://example.com', 'http://example.com/'), false);

// 5. Invalid / unparsable actual URL
assert.strictEqual(validateOrigin('https://example.com', 'not-a-valid-url'), false);

// 6. Missing / empty parameters
assert.strictEqual(validateOrigin('', 'https://example.com'), false);
assert.strictEqual(validateOrigin(null, 'https://example.com'), false);
assert.strictEqual(validateOrigin(undefined, 'https://example.com'), false);

// 7. about:blank and data: URIs
assert.strictEqual(validateOrigin('https://example.com', 'about:blank'), false);
assert.strictEqual(validateOrigin('https://example.com', 'data:text/html,<h1>hi</h1>'), false);

assert.strictEqual(normalizePublicHttpUrl('https://example.com/article'), 'https://example.com/article');
for (const refused of [
  'http://localhost:5173/',
  'http://127.0.0.1/',
  'http://10.0.0.1/',
  'http://169.254.1.1/',
  'http://172.16.0.1/',
  'http://192.168.1.1/',
  'http://100.64.0.1/',
  'https://user@example.com/',
  'file:///etc/passwd',
]) {
  assert.strictEqual(normalizePublicHttpUrl(refused), null, refused);
}

console.log('✅ origin-validation tests passed.');
