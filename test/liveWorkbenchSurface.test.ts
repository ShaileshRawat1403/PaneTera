import assert from 'assert';
import { resolveSandboxProfile } from '../src/components/workbench/LiveWorkbenchSurface';

console.log("Running LiveWorkbenchSurface Sandbox Policy Tests...");

const diffOrigin = 'http://127.0.0.1:4000';
const sameOrigin = 'http://127.0.0.1:4173';

// strict profile includes scripts and forms but not popups
const s1 = resolveSandboxProfile('http://127.0.0.1:4173/app', 'strict', diffOrigin).sandbox;
assert.ok(s1.includes('allow-scripts'));
assert.ok(s1.includes('allow-forms'));
assert.ok(!s1.includes('allow-popups'));
assert.ok(!s1.includes('allow-same-origin'));
assert.ok(!s1.includes('allow-top-navigation'));

// authenticated-local profile includes same-origin but not popups
const s2 = resolveSandboxProfile('http://127.0.0.1:4173/app', 'authenticated-local', diffOrigin).sandbox;
assert.ok(s2.includes('allow-scripts'));
assert.ok(s2.includes('allow-forms'));
assert.ok(s2.includes('allow-same-origin'));
assert.ok(!s2.includes('allow-popups'));
assert.ok(!s2.includes('allow-top-navigation'));

// explicitly downgrades to strict if complete origins match
const { sandbox: s3, downgraded } = resolveSandboxProfile('http://127.0.0.1:4173/app', 'authenticated-local', sameOrigin);
assert.ok(s3.includes('allow-scripts'));
assert.ok(s3.includes('allow-forms'));
assert.ok(!s3.includes('allow-same-origin'));
assert.ok(!s3.includes('allow-popups'));
assert.strictEqual(downgraded, true);

console.log("LiveWorkbenchSurface Tests passed.");
