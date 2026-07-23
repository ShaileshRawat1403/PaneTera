import assert from 'node:assert';
import { describe, it } from 'node:test';
import { buildFileTree, filterFileTree, topLevelDirectories } from '../src/components/workbench/fileTreeModel';
import { clampPaneWidth } from '../src/components/workstation/paneSizing';

describe('project file explorer model', () => {
  const tree = buildFileTree([
    { name: 'src', path: 'src', isDirectory: true },
    { name: 'components', path: 'src/components', isDirectory: true },
    { name: 'App.tsx', path: 'src/App.tsx', isDirectory: false, size: 100 },
    { name: 'Composer.tsx', path: 'src/components/Composer.tsx', isDirectory: false, size: 80 },
    { name: 'README.md', path: 'README.md', isDirectory: false, size: 40 },
  ]);

  it('nests selectable files beneath their directories instead of burying them in one flat list', () => {
    const src = tree.find((node) => node.path === 'src');
    assert.ok(src?.isDirectory);
    assert.ok(src?.children.some((node) => node.path === 'src/App.tsx' && !node.isDirectory));
    assert.ok(src?.children.find((node) => node.path === 'src/components')?.children.some((node) => node.name === 'Composer.tsx'));
    assert.ok(tree.some((node) => node.path === 'README.md' && !node.isDirectory));
  });

  it('keeps matching ancestors while filtering by file name', () => {
    const filtered = filterFileTree(tree, 'composer');
    assert.deepStrictEqual(filtered.map((node) => node.path), ['src']);
    assert.strictEqual(filtered[0].children[0].path, 'src/components');
    assert.strictEqual(filtered[0].children[0].children[0].path, 'src/components/Composer.tsx');
  });

  it('identifies the directories that may be expanded on first load', () => {
    assert.deepStrictEqual(topLevelDirectories(tree), ['src']);
  });
});

describe('adjustable pane bounds', () => {
  it('clamps drag and keyboard values without allowing either pane to disappear', () => {
    assert.strictEqual(clampPaneWidth(120, 280, 640), 280);
    assert.strictEqual(clampPaneWidth(420, 280, 640), 420);
    assert.strictEqual(clampPaneWidth(900, 280, 640), 640);
  });
});
