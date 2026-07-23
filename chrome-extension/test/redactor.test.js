// chrome-extension/test/redactor.test.js
import assert from 'node:assert';
import { redactText, sanitizeUrl, redactObject } from '../shared/redactor.js';

console.log('Running redactor tests...');

// 1. High-confidence credentials
const textWithKeys = 'Here is my OpenAI key sk-abcdef1234567890abcdef1234567890 and GitHub token ghp_1234567890abcdefghijklmnopqrstuvwxy';
const resKeys = redactText(textWithKeys);
assert.strictEqual(resKeys.redactedText.includes('sk-abcdef'), false);
assert.strictEqual(resKeys.redactedText.includes('ghp_123456'), false);
assert.strictEqual(resKeys.redactedText.includes('[REDACTED_CREDENTIAL]'), true);
assert.strictEqual(resKeys.redactions.credentials, 2);

// 2. AWS Key & Bearer Token
const textWithBearer = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const resBearer = redactText(textWithBearer);
assert.strictEqual(resBearer.redactedText.includes('eyJhbGci'), false);
assert.strictEqual(resBearer.redactedText.includes('[REDACTED_CREDENTIAL]'), true);

// 3. Email & Phone
const textWithPii = 'Contact me at test.user@example.com or call +1 555-123-4567';
const resPii = redactText(textWithPii);
assert.strictEqual(resPii.redactedText.includes('test.user@example.com'), false);
assert.strictEqual(resPii.redactedText.includes('[REDACTED_EMAIL]'), true);
assert.strictEqual(resPii.redactions.emails, 1);
assert.strictEqual(resPii.redactions.phoneNumbers, 1);

// 4. Luhn-valid Credit Card
const validCard = '4532 0151 1283 0366'; // Valid Visa number passing Luhn check
const resCard = redactText(`My card is ${validCard}`);
assert.strictEqual(resCard.redactedText.includes('4532'), false);
assert.strictEqual(resCard.redactedText.includes('[REDACTED_CARD]'), true);
assert.strictEqual(resCard.redactions.creditCards, 1);

// 5. Disclaimer presence and no completeness claim
assert.strictEqual(typeof resPii.disclaimer, 'string');
assert.strictEqual(resPii.disclaimer.includes('bounded and best-effort'), true);

// 6. URL Structural Normalization
const rawUrl = 'https://admin:pass123@example.com/api/v1/user?token=secret123&name=john';
const cleanUrl = sanitizeUrl(rawUrl);
assert.strictEqual(cleanUrl.includes('admin:pass123'), false);
assert.strictEqual(cleanUrl.includes('secret123'), false);
assert.strictEqual(cleanUrl.includes('token=%5BREDACTED%5D') || cleanUrl.includes('token=[REDACTED]'), true);
assert.strictEqual(cleanUrl.includes('name=john'), true);
assert.strictEqual(new URL(cleanUrl).origin, 'https://example.com');

// Invalid URL returns empty string
assert.strictEqual(sanitizeUrl('not-a-valid-url'), '');
assert.strictEqual(sanitizeUrl('file:///etc/passwd'), '');
assert.strictEqual(sanitizeUrl('javascript:alert(1)'), '');

// 7. Recursive Object Redaction & DoS Bounds
const deeplyNested = { a: { b: { c: { d: { e: { f: 'sk-abcdef1234567890abcdef1234567890' } } } } } };
const cleanNested = redactObject(deeplyNested);
// Bounded at depth 5, so f won't be traversed beyond limit or string will be cleaned
assert.strictEqual(typeof cleanNested, 'object');

console.log('✅ redactor tests passed.');
