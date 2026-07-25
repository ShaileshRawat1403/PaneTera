// chrome-extension/test/reproducible-build.test.js
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { buildDeterministicZip } from '../scripts/zip.js';

console.log('Running reproducible-build tests...');

// Build 1
const build1 = buildDeterministicZip();

// Cross the ZIP/DOS two-second timestamp granularity so equal hashes cannot be
// explained by two builds happening in the same timestamp bucket.
await new Promise(resolve => setTimeout(resolve, 2_100));

// Build 2
const build2 = buildDeterministicZip();

// Compare byte-for-byte and SHA-256 equality
assert.strictEqual(build1.hash, build2.hash, 'Build 1 and Build 2 hashes must be identical');
assert.strictEqual(build1.size, build2.size, 'Build 1 and Build 2 byte sizes must be identical');

const listing = execFileSync('unzip', ['-l', build2.path], { encoding: 'utf8' });
const entries = listing.split('\n').filter(line => /\d{2}-\d{2}-1980/.test(line));
assert.ok(entries.length > 0, 'archive must contain timestamped runtime entries');
assert.ok(entries.every(line => line.includes('01-01-1980')), 'every archive entry must use the fixed build date');
assert.match(listing, /\bliveSession\.js\b/, 'the packaged extension must contain the managed live-view runtime');

console.log(`✅ reproducible-build tests passed. (Hash: ${build1.hash})`);
