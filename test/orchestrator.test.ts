// test/orchestrator.test.ts
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { handleOrchestratorQuery, classifyIntent } from '../server/orchestrator';
import { McpWorkspaceAdapter, getWorkspaceAdapter, stopWorkspaceAdapter, stopAllWorkspaceAdapters, setWorkspaceAdapterForTest } from '../server/mcpAdapter';

process.env.ORCHESTRATOR_PROVIDER = 'none';

console.log('Running Orchestrator Chat V0 tests...');

const mockDir = path.resolve(__dirname, 'mock-orchestrator-ws');

// Setup mock folder
function setupMockFiles() {
  if (!fs.existsSync(mockDir)) {
    fs.mkdirSync(mockDir, { recursive: true });
  }
  fs.writeFileSync(path.join(mockDir, 'main.ts'), `
import { greet } from './greet';
// TODO: implement real logger
export function main() {
  console.log(greet());
}
  `);
  fs.writeFileSync(path.join(mockDir, 'greet.ts'), `
export function greet() { return "hello"; }
  `);
  fs.writeFileSync(path.join(mockDir, '.env'), `
SECRET_KEY=supersecret
  `);
}

function cleanupMockFiles() {
  try {
    stopWorkspaceAdapter('test-orch-ws');
    if (fs.existsSync(mockDir)) {
      fs.rmSync(mockDir, { recursive: true, force: true });
    }
  } catch {}
}

const mockResolver = async (id: string) => {
  return { name: 'Mock Workspace', path: mockDir };
};

async function runTests() {
  setupMockFiles();
  const mockAdapter = new McpWorkspaceAdapter('test-orch-ws', mockDir);
  setWorkspaceAdapterForTest('test-orch-ws', mockAdapter);

  try {
    // 1. Test no workspace selected
    console.log('- Testing: no workspace selected...');
    const noWsRes = await handleOrchestratorQuery('Explain the repo', null, null, 'engineer', mockResolver);
    assert.strictEqual(noWsRes.intent, 'needs_clarification');
    assert.ok(noWsRes.answer.includes('Select a workspace'));

    // 2. Test unknown intent clarification
    console.log('- Testing: unknown intent clarification...');
    const vagueRes = await handleOrchestratorQuery('hello', 'test-orch-ws', null, 'engineer', mockResolver);
    console.log('vagueRes.answer:', vagueRes.answer);
    assert.strictEqual(vagueRes.intent, 'needs_clarification');
    assert.ok(vagueRes.answer.includes('clarification'));

    // 3. Test repo overview intent
    console.log('- Testing: repo overview intent...');
    const overviewRes = await handleOrchestratorQuery('Explain the repo structure', 'test-orch-ws', null, 'engineer', mockResolver);
    assert.strictEqual(overviewRes.intent, 'repo_overview');
    assert.ok(overviewRes.answer.includes('Workspace Overview'));
    assert.ok(overviewRes.toolsUsed.some(t => t.tool === 'workspace.info' && t.status === 'success'));

    // 4. Test explain selected file
    console.log('- Testing: explain selected file...');
    const fileRes = await handleOrchestratorQuery('Explain main.ts', 'test-orch-ws', 'main.ts', 'engineer', mockResolver);
    assert.strictEqual(fileRes.intent, 'explain_file');
    assert.ok(fileRes.answer.includes('File Summary'));
    assert.ok(fileRes.toolsUsed.some(t => t.tool === 'workspace.readFile' && t.status === 'success'));
    assert.strictEqual(fileRes.citations[0].path, 'main.ts');

    // 5. Test TODO search intent
    console.log('- Testing: TODO search intent...');
    const todoRes = await handleOrchestratorQuery('Find TODOs', 'test-orch-ws', null, 'engineer', mockResolver);
    assert.strictEqual(todoRes.intent, 'find_todos');
    assert.ok(todoRes.answer.includes('TODOs and FIXMEs'));

    // 6. Test dependency map intent
    console.log('- Testing: dependency map intent...');
    const depRes = await handleOrchestratorQuery('Map dependencies from main.ts', 'test-orch-ws', 'main.ts', 'engineer', mockResolver);
    assert.strictEqual(depRes.intent, 'map_dependencies');
    assert.ok(depRes.answer.includes('Dependency Routes'));

    // 7. Test blocked file request (.env is blocked by path rule in policy)
    console.log('- Testing: blocked file request (.env)...');
    const blockedRes = await handleOrchestratorQuery('Explain the file .env', 'test-orch-ws', '.env', 'engineer', mockResolver);
    assert.strictEqual(blockedRes.intent, 'explain_file');
    assert.ok(blockedRes.toolsUsed.some(t => t.tool === 'workspace.readFile' && t.status === 'denied'));
    assert.ok(blockedRes.answer.includes('Access Blocked'));
    assert.ok(blockedRes.warnings.some(w => w.includes('Policy block')));

    // 8. Verify provider none fallback
    console.log('- Testing: provider none fallback...');
    // We already passed process.env.ORCHESTRATOR_PROVIDER === 'none' (or omitted) and got deterministic results
    assert.ok(overviewRes.answer.startsWith('📁 **Workspace Overview:'));
    assert.ok(fileRes.answer.startsWith('📄 **File Summary:'));
    assert.ok(todoRes.answer.startsWith('📝 **TODOs and FIXMEs'));

    // 9. Verify no command/write/browser tools are reachable or mapped
    console.log('- Testing: no unsafe tools mapped...');
    const allToolsCalled = overviewRes.toolsUsed.concat(fileRes.toolsUsed, todoRes.toolsUsed, depRes.toolsUsed, blockedRes.toolsUsed);
    const hasUnsafe = allToolsCalled.some(t => ['workspace.execute', 'workspace.write', 'execute', 'write', 'patch', 'browser'].includes(t.tool));
    assert.strictEqual(hasUnsafe, false, 'Should never invoke any write/execute/browser tools');

    console.log('✓ All Orchestrator Chat V0 tests passed successfully!');
  } finally {
    cleanupMockFiles();
    stopAllWorkspaceAdapters();
  }
}

runTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
