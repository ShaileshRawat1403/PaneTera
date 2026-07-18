import assert from 'assert';
import { normalizeNewlines, hashCanonicalText, toCanonicalEvidenceText } from '../server/evidence/evidenceCanonicalizer';

async function runTests() {
  console.log('Running Evidence Canonicalizer tests...');
  
  // CRLF and LF hash identically
  const crlf = 'Hello\r\nWorld\r\n';
  const lf = 'Hello\nWorld\n';
  
  const hash1 = hashCanonicalText(normalizeNewlines(crlf));
  const hash2 = hashCanonicalText(normalizeNewlines(lf));
  assert.strictEqual(hash1.contentHash, hash2.contentHash, 'CRLF and LF must hash identically');

  // leading whitespace is preserved
  const leading = '  Hello World';
  assert.strictEqual(hashCanonicalText(normalizeNewlines(leading)).contentHash, hashCanonicalText('  Hello World').contentHash);

  // trailing whitespace is preserved
  const trailing = 'Hello World  ';
  assert.strictEqual(hashCanonicalText(normalizeNewlines(trailing)).contentHash, hashCanonicalText('Hello World  ').contentHash);

  // repeated spaces are preserved
  const repeated = 'Hello    World';
  assert.strictEqual(hashCanonicalText(normalizeNewlines(repeated)).contentHash, hashCanonicalText('Hello    World').contentHash);

  // tabs are preserved
  const tabs = 'Hello\tWorld';
  assert.strictEqual(hashCanonicalText(normalizeNewlines(tabs)).contentHash, hashCanonicalText('Hello\tWorld').contentHash);

  // changing any preserved whitespace changes the hash
  assert.notStrictEqual(hashCanonicalText(' Hello World').contentHash, hashCanonicalText('Hello World').contentHash);
  assert.notStrictEqual(hashCanonicalText('Hello World ').contentHash, hashCanonicalText('Hello World').contentHash);
  assert.notStrictEqual(hashCanonicalText('Hello  World').contentHash, hashCanonicalText('Hello World').contentHash);
  assert.notStrictEqual(hashCanonicalText('Hello\tWorld').contentHash, hashCanonicalText('Hello World').contentHash);

  console.log('Evidence Canonicalizer tests passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
