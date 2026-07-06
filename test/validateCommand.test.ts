import assert from 'assert';
import { validateCommand } from '../server/execution/types';

console.log('Running validateCommand allowlist tests...');

// 1. Valid whitelisted commands
assert.ok(validateCommand('npm test') !== null, 'Should allow npm test');
assert.ok(validateCommand(' npm test  ') !== null, 'Should trim and allow npm test');
assert.ok(validateCommand('git status') !== null, 'Should allow git status');

// 2. Exact match check (prefix should be blocked now)
assert.strictEqual(validateCommand('npm test --verbose'), null, 'Should block prefix matches with arguments');
assert.strictEqual(validateCommand('git status -s'), null, 'Should block git status with arguments');

// 3. Unsafe syntax checks
assert.strictEqual(validateCommand('npm test; rm -rf /'), null, 'Should block command chaining');
assert.strictEqual(validateCommand('npm test && echo 1'), null, 'Should block operator chaining');
assert.strictEqual(validateCommand('npm test || echo 1'), null, 'Should block OR operator chaining');
assert.strictEqual(validateCommand('npm test | grep 1'), null, 'Should block pipe operator');
assert.strictEqual(validateCommand('npm test > output.txt'), null, 'Should block redirection');

// 4. Blocked commands not in allowlist
assert.strictEqual(validateCommand('rm -rf /'), null, 'Should block rm -rf');
assert.strictEqual(validateCommand('npm install'), null, 'Should block npm install');

console.log('✓ All validateCommand allowlist tests passed!');
