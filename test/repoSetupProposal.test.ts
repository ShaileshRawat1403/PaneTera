import assert from 'assert';
import path from 'path';
import {
  parseRepoSetupIntent,
  resolveRepoSetupTarget,
  buildRepoSetupProposal,
} from '../server/repoSetup';

console.log('Running repo setup proposal tests...');

const WORKSPACE_ROOT = '/Users/Shailesh/MYAIAGENTS';

// 1. Intent Parser Tests
const validQueries = [
  'add myai-portal',
  'add my myai-portal repo',
  'connect /Users/Shailesh/MYAIAGENTS/PaneTera',
  'track the websiteops repo',
  'make flowright available',
  'use myai-portal repo',
  'add websiteops repo',
  'track websiteops-pothos-proof',
];

for (const q of validQueries) {
  const parsed = parseRepoSetupIntent(q);
  assert.ok(parsed !== null, `Should parse intent for: "${q}"`);
  assert.ok(parsed.rawTarget.length > 0, `Should extract target from: "${q}"`);
}

const invalidQueries = [
  'hello',
  'list files in myai-portal',
  'read package.json in flowright',
  'git status',
  'npm test',
];

for (const q of invalidQueries) {
  const parsed = parseRepoSetupIntent(q);
  assert.strictEqual(parsed, null, `Should ignore unrelated query: "${q}"`);
}

async function runAsyncTests() {
  // 2. Target Resolver Tests - Inside Root and Exists (PaneTera itself)
  const proposal1 = await resolveRepoSetupTarget('PaneTera', WORKSPACE_ROOT);
  assert.strictEqual(proposal1.workspaceName, 'PaneTera');
  assert.strictEqual(proposal1.exists, true, 'PaneTera should exist');
  assert.strictEqual(proposal1.insideWorkspaceRoot, true, 'PaneTera should be inside root');
  assert.strictEqual(proposal1.allowed, true, 'PaneTera should be allowed');
  assert.strictEqual(proposal1.gitDetected, true, 'PaneTera should have git detected');
  assert.ok(
    proposal1.packageManager === 'npm' || proposal1.packageManager === 'pnpm',
    'PaneTera should be npm or pnpm project',
  );
  assert.ok(proposal1.scripts && proposal1.scripts.includes('build'), 'PaneTera should have build script');

  // 3. Target Resolver Tests - Inside Root but Missing
  const proposal2 = await resolveRepoSetupTarget('missing-folder-xyz', WORKSPACE_ROOT);
  assert.strictEqual(proposal2.exists, false, 'missing-folder-xyz should not exist');
  assert.strictEqual(proposal2.insideWorkspaceRoot, true, 'missing-folder-xyz should be inside root');
  assert.strictEqual(proposal2.allowed, false, 'missing-folder-xyz should not be allowed');

  // 4. Target Resolver Tests - Outside Root
  const proposal3 = await resolveRepoSetupTarget('../../outside-bounds', WORKSPACE_ROOT);
  assert.strictEqual(proposal3.insideWorkspaceRoot, false, 'outside-bounds should be outside root');
  assert.strictEqual(proposal3.allowed, false, 'outside-bounds should not be allowed');
  assert.ok(
    proposal3.warnings.includes('Target path is outside the allowed workspace root.'),
    'should contain bounds warning',
  );

  // 5. Target Resolver Tests - Absolute path outside root
  const proposal4 = await resolveRepoSetupTarget('/Users/Shailesh/MYAIAGENTS-evil/foo', WORKSPACE_ROOT);
  assert.strictEqual(proposal4.insideWorkspaceRoot, false);
  assert.strictEqual(proposal4.allowed, false);

  // 6. buildRepoSetupProposal integration
  const integration = await buildRepoSetupProposal('connect PaneTera', WORKSPACE_ROOT);
  assert.ok(integration !== null);
  assert.strictEqual(integration.allowed, true);
  assert.strictEqual(integration.workspaceName, 'PaneTera');

  console.log('✓ All repo setup proposal tests passed!');
}

runAsyncTests().catch((err) => {
  console.error('✗ Tests failed:', err);
  process.exit(1);
});
