import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  parseRepoSetupIntent,
  resolveRepoSetupTarget,
  buildRepoSetupProposal,
} from '../server/repoSetup';

console.log('Running repo setup proposal tests...');

// Derive the fixture from this checked-out repository rather than one
// developer's home directory. The resolver still receives an explicit root,
// so the test exercises the same authority boundary on macOS, Linux, CI, and
// an alternate workspace checkout.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE_ROOT = path.dirname(REPO_ROOT);
const REPO_NAME = path.basename(REPO_ROOT);

// 1. Intent Parser Tests
const validQueries = [
  'add my frontend repo',
  'add the backend repo',
  `connect ${REPO_ROOT}`,
  'track the analytics repo',
  'make flowright available',
  'make auth-service available as a workspace',
  'use payment-service repo',
  'add websiteops repo',
  'Add this GitHub repository to my workspace',
  'Set up a repo for this project',
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
  'Add a temporary track called Conversation Probe',
  'Add a layer named Background',
  'Add a scene called Intro',
  'Add 5 to 10',
  'track 1 volume',
  'connect pin 1 to pin 2',
];

for (const q of invalidQueries) {
  const parsed = parseRepoSetupIntent(q);
  assert.strictEqual(parsed, null, `Should ignore unrelated query: "${q}"`);
}

async function runAsyncTests() {
  // 2. Target Resolver Tests - Inside Root and Exists (this repository)
  const proposal1 = await resolveRepoSetupTarget(REPO_NAME, WORKSPACE_ROOT);
  assert.strictEqual(proposal1.workspaceName, REPO_NAME);
  assert.strictEqual(proposal1.exists, true, 'the checked-out repository should exist');
  assert.strictEqual(proposal1.insideWorkspaceRoot, true, 'the repository should be inside its parent root');
  assert.strictEqual(proposal1.allowed, true, 'the repository should be allowed');
  assert.strictEqual(proposal1.gitDetected, true, 'the repository should have git detected');
  assert.ok(
    proposal1.packageManager === 'npm' || proposal1.packageManager === 'pnpm',
    'the repository should be an npm or pnpm project',
  );
  assert.ok(proposal1.scripts && proposal1.scripts.includes('build'), 'the repository should have a build script');

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
  const proposal4 = await resolveRepoSetupTarget(path.join(`${WORKSPACE_ROOT}-evil`, 'foo'), WORKSPACE_ROOT);
  assert.strictEqual(proposal4.insideWorkspaceRoot, false);
  assert.strictEqual(proposal4.allowed, false);

  // 6. buildRepoSetupProposal integration
  const integration = await buildRepoSetupProposal(`connect ${REPO_NAME}`, WORKSPACE_ROOT);
  assert.ok(integration !== null);
  assert.strictEqual(integration.allowed, true);
  assert.strictEqual(integration.workspaceName, REPO_NAME);

  console.log('✓ All repo setup proposal tests passed!');
}

runAsyncTests().catch((err) => {
  console.error('✗ Tests failed:', err);
  process.exit(1);
});
