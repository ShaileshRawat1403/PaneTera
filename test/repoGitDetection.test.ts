// test/repoGitDetection.test.ts
//
// A Git working tree is a repository whether its .git entry is a directory
// (normal checkout) or a pointer file (linked worktree, submodule). Detection
// stays shallow: only a directory that itself holds a .git entry counts.

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectGitRepository } from '../server/repoSetup';

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-git-detection-')));
after(() => fs.rmSync(root, { recursive: true, force: true }));

const gitEnv = { ...process.env };
for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete gitEnv[name];
const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=PaneTera Test', '-c', 'user.email=test@example.invalid', '-c', 'init.defaultBranch=main', ...args], { cwd, env: gitEnv, stdio: 'pipe' });

const checkout = path.join(root, 'checkout');
const worktree = path.join(root, 'linked-worktree');
const superproject = path.join(root, 'superproject');
const submodule = path.join(superproject, 'vendored');
const plain = path.join(root, 'plain');

fs.mkdirSync(checkout);
git(checkout, 'init', '-q');
git(checkout, 'commit', '-q', '--allow-empty', '-m', 'init');
git(checkout, 'worktree', 'add', '-q', worktree, '-b', 'linked');
fs.mkdirSync(superproject);
git(superproject, 'init', '-q');
git(superproject, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', checkout, 'vendored');
fs.mkdirSync(plain);
fs.mkdirSync(path.join(checkout, 'nested'));

describe('detectGitRepository', () => {
  it('recognises a normal checkout', async () => {
    assert.equal(fs.statSync(path.join(checkout, '.git')).isDirectory(), true);
    assert.equal(await detectGitRepository(checkout), true);
  });

  it('recognises a linked worktree whose .git is a file', async () => {
    assert.equal(fs.statSync(path.join(worktree, '.git')).isFile(), true);
    assert.equal(await detectGitRepository(worktree), true);
  });

  it('recognises a submodule whose .git is a file', async () => {
    assert.equal(fs.statSync(path.join(submodule, '.git')).isFile(), true);
    assert.equal(await detectGitRepository(submodule), true);
  });

  it('does not recognise a plain directory, or a subdirectory of a repository', async () => {
    assert.equal(await detectGitRepository(plain), false);
    assert.equal(await detectGitRepository(path.join(checkout, 'nested')), false, 'detection stays shallow');
  });

  it('does not trust a .git file that git rejects', async () => {
    const bogus = path.join(root, 'bogus');
    fs.mkdirSync(bogus);
    fs.writeFileSync(path.join(bogus, '.git'), 'gitdir: ./missing\n');
    assert.equal(await detectGitRepository(bogus), false);
  });

  it('falls back to the .git entry when git cannot run', async () => {
    const noGit = { gitBinary: path.join(root, 'no-such-git') };
    assert.equal(await detectGitRepository(checkout, noGit), true);
    assert.equal(await detectGitRepository(worktree, noGit), true);
    assert.equal(await detectGitRepository(plain, noGit), false);
    const dangling = path.join(root, 'dangling');
    fs.mkdirSync(dangling);
    fs.writeFileSync(path.join(dangling, '.git'), 'gitdir: ../nowhere\n');
    assert.equal(await detectGitRepository(dangling, noGit), false);
  });
});
