// test/missionControlV1.test.ts
import { McpWorkspaceAdapter } from '../server/mcpAdapter';
import * as assert from 'assert';
import * as path from 'path';

console.log('Running V1 Mission Control Host Policy & Stdio Adapter tests...');

async function testHostPolicyEnforcement() {
  const mockWorkspaceId = 'test-ws';
  const mockPath = path.resolve(__dirname, '..'); // point to myai-portal root
  const adapter = new McpWorkspaceAdapter(mockWorkspaceId, mockPath);

  try {
    // 1. Attempt to read forbidden extension (.env)
    try {
      await adapter.call('workspace.readFile', { relativePath: '.env' });
      assert.fail('Should have blocked reading .env');
    } catch (err: any) {
      assert.ok(err.message.includes('Access Denied'), 'Expected Access Denied error message for forbidden file');
    }

    // 2. Attempt to read traversal path
    try {
      await adapter.call('workspace.readFile', { relativePath: '../other/secrets.json' });
      assert.fail('Should have blocked directory traversal');
    } catch (err: any) {
      assert.ok(err.message.includes('Access Denied'), 'Expected Access Denied for directory traversal');
    }

    // 3. Attempt to read inside denied path (node_modules)
    try {
      await adapter.call('workspace.readFile', { relativePath: 'node_modules/lodash/index.js' });
      assert.fail('Should have blocked node_modules read');
    } catch (err: any) {
      assert.ok(err.message.includes('Access Denied'), 'Expected Access Denied for path matching denyPaths');
    }

    console.log('✓ Host Policy Enforcement tests passed successfully.');
  } finally {
    adapter.stop();
  }
}

async function runTests() {
  try {
    await testHostPolicyEnforcement();
    console.log('✓ All V1 Mission Control tests passed!');
  } catch (err: any) {
    console.error('FAIL:', err);
    process.exitCode = 1;
  }
}

runTests();
