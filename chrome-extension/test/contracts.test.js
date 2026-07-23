// chrome-extension/test/contracts.test.js
import assert from 'node:assert';
import { getBaseContract, createEvidenceItem } from '../src/extractors/utils.js';

console.log('Running contracts tests...');

// 1. Validate Base Contract Trust & Structural Invariants
const contract = getBaseContract('browser.article.extract');

assert.strictEqual(contract.capability, 'browser.article.extract');
assert.strictEqual(contract.trust.sourceType, 'browser-dom');
assert.strictEqual(contract.trust.trustLevel, 'untrusted');
assert.strictEqual(contract.trust.instructionAuthority, 'none');
assert.strictEqual(typeof contract.extractionId, 'string');
assert.ok(contract.extractionId.length > 10);

// 2. Validate Evidence Item creation
const evidenceItem = createEvidenceItem('text', 'test.recipe.v1', { start: 0, end: 10 }, 0, 1, 2);

assert.strictEqual(evidenceItem.kind, 'text');
assert.strictEqual(evidenceItem.locator.recipeId, 'test.recipe.v1');
assert.strictEqual(evidenceItem.locator.ordinal, 0);
assert.strictEqual(evidenceItem.locator.row, 1);
assert.strictEqual(evidenceItem.locator.column, 2);
assert.strictEqual(typeof evidenceItem.evidenceId, 'string');

console.log('✅ contracts tests passed.');
