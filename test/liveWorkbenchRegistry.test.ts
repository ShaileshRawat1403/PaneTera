import assert from 'assert';
import { localAppRegistry } from '../server/workbench/localAppRegistry';

console.log("Running LiveWorkbenchRegistry Tests...");

assert.strictEqual(localAppRegistry.isValidLoopbackUrl('http://127.0.0.1:4173'), true);
assert.strictEqual(localAppRegistry.isValidLoopbackUrl('http://localhost:3000'), true);
assert.strictEqual(localAppRegistry.isValidLoopbackUrl('https://127.0.0.1:8080/foo/bar'), true);

assert.strictEqual(localAppRegistry.isValidLoopbackUrl('http://example.com:8080'), false);
assert.strictEqual(localAppRegistry.isValidLoopbackUrl('http://192.168.1.1:3000'), false);
assert.strictEqual(localAppRegistry.isValidLoopbackUrl('http://localhost'), false); // missing port
assert.strictEqual(localAppRegistry.isValidLoopbackUrl('http://user:pass@127.0.0.1:4173'), false); // embedded credentials
assert.strictEqual(localAppRegistry.isValidLoopbackUrl('file:///etc/passwd'), false);

console.log("LiveWorkbenchRegistry Tests passed.");
