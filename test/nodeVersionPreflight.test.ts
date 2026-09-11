// test/nodeVersionPreflight.test.ts
//
// Node 22 is the authoritative development runtime. The preflight must
// agree with package.json engines and .nvmrc, guard the everyday scripts,
// and refuse an older Node rather than letting it run silently.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PREFLIGHT = fileURLToPath(new URL('../scripts/check-node-version.mjs', import.meta.url));
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

describe('Node 22 development baseline', () => {
  it('pins one major version in .nvmrc, engines, and the preflight', () => {
    const nvmrc = fs.readFileSync(new URL('../.nvmrc', import.meta.url), 'utf8').trim();
    assert.equal(nvmrc, '22');
    assert.equal(pkg.engines.node, '>=22');
    assert.match(fs.readFileSync(PREFLIGHT, 'utf8'), /REQUIRED_MAJOR = 22;/);
  });

  it('guards dev, test, lint, and build', () => {
    for (const script of ['predev', 'pretest', 'prelint', 'prebuild']) {
      assert.equal(pkg.scripts[script], 'node scripts/check-node-version.mjs', script);
    }
  });

  it('passes on the running Node 22+', () => {
    const result = spawnSync(process.execPath, [PREFLIGHT], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  });

  const node20 = ['/opt/homebrew/opt/node@20/bin/node', '/usr/local/opt/node@20/bin/node'].find((candidate) => fs.existsSync(candidate));
  it('refuses an older Node with an explanation', { skip: node20 ? false : 'no Node 20 binary on this machine' }, () => {
    const result = spawnSync(node20!, [PREFLIGHT], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /requires Node 22 or newer, but this is Node 20\./);
    assert.match(result.stderr, /nvm use/);
  });
});
