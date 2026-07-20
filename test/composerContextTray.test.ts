// test/composerContextTray.test.ts
// Proves the tray's safety properties: no materialisation, no enumeration, no
// escape from registered workspaces, and no source mutation on removal.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  EMPTY_MATERIAL,
  EMPTY_TRAY,
  attachContextItem,
  clearContext,
  dropMaterial,
  includedItems,
  isWithinWorkspace,
  materialFor,
  putMaterial,
  removeContextItem,
  resetContextIds,
  setContextIncluded,
  trayMeasurement,
} from '../src/composer/contextTray';
import type { AttachableWorkspace } from '../src/composer/contextTypes';

const workspace: AttachableWorkspace = {
  id: 'panetera',
  name: 'PaneTera',
  path: '/Users/Shailesh/MYAIAGENTS/PaneTera',
};

function attachFolder() {
  resetContextIds();
  return attachContextItem(EMPTY_TRAY, {
    kind: 'folder',
    label: 'src',
    locator: `${workspace.path}/src`,
    workspace,
  });
}

describe('folder attachment materialises nothing', () => {
  it('records a folder as a reference', () => {
    const result = attachFolder();
    assert.ok(result.ok);
    assert.deepStrictEqual(result.item.materialization, { mode: 'reference' });
  });

  it('contributes no inline bytes to the tray measurement', () => {
    const result = attachFolder();
    assert.ok(result.ok);
    assert.deepStrictEqual(trayMeasurement(result.tray), { unit: 'bytes', value: 0 });
  });

  it('never claims freshness it cannot support', () => {
    const result = attachFolder();
    assert.ok(result.ok);
    assert.strictEqual(result.item.freshness, 'not-measured');
  });

  it('carries no authority', () => {
    const result = attachFolder();
    assert.ok(result.ok);
    assert.strictEqual(result.item.authority, 'none');
  });
});

describe('registered workspace containment', () => {
  it('accepts a path inside the workspace', () => {
    assert.strictEqual(isWithinWorkspace(`${workspace.path}/src/App.tsx`, workspace.path), true);
  });

  it('accepts the workspace root itself', () => {
    assert.strictEqual(isWithinWorkspace(workspace.path, workspace.path), true);
  });

  it('rejects a sibling that merely shares a prefix', () => {
    assert.strictEqual(
      isWithinWorkspace('/Users/Shailesh/MYAIAGENTS/PaneTera-secrets/.env', workspace.path),
      false,
    );
  });

  it('rejects traversal', () => {
    assert.strictEqual(
      isWithinWorkspace(`${workspace.path}/../pruningmypothos/.env`, workspace.path),
      false,
    );
  });

  it('rejects an attachment with no workspace', () => {
    const result = attachContextItem(EMPTY_TRAY, {
      kind: 'file',
      label: 'notes.md',
      locator: '/Users/Shailesh/elsewhere/notes.md',
    });
    assert.strictEqual(result.ok, false);
    assert.ok(!result.ok && result.reason === 'outside-registered-workspace');
  });

  it('rejects an external path even when a workspace is supplied', () => {
    const result = attachContextItem(EMPTY_TRAY, {
      kind: 'file',
      label: 'passwd',
      locator: '/etc/passwd',
      workspace,
    });
    assert.strictEqual(result.ok, false);
  });
});

describe('removal is safe', () => {
  it('removes only the named item', () => {
    resetContextIds();
    const first = attachContextItem(EMPTY_TRAY, {
      kind: 'folder',
      label: 'src',
      locator: `${workspace.path}/src`,
      workspace,
    });
    assert.ok(first.ok);
    const second = attachContextItem(first.tray, {
      kind: 'folder',
      label: 'server',
      locator: `${workspace.path}/server`,
      workspace,
    });
    assert.ok(second.ok);

    const after = removeContextItem(second.tray, first.item.id);
    assert.strictEqual(after.length, 1);
    assert.strictEqual(after[0]?.label, 'server');
  });

  it('does not mutate the previous tray', () => {
    const result = attachFolder();
    assert.ok(result.ok);
    const before = result.tray;
    const after = removeContextItem(before, result.item.id);
    assert.strictEqual(before.length, 1);
    assert.strictEqual(after.length, 0);
  });

  it('clears without touching anything else', () => {
    assert.deepStrictEqual(clearContext(), EMPTY_TRAY);
  });
});

describe('inclusion toggling', () => {
  it('excludes without removing', () => {
    const result = attachFolder();
    assert.ok(result.ok);
    const toggled = setContextIncluded(result.tray, result.item.id, false);
    assert.strictEqual(toggled.length, 1);
    assert.strictEqual(toggled[0]?.included, false);
    assert.strictEqual(includedItems(toggled).length, 0);
  });

  it('re-includes', () => {
    const result = attachFolder();
    assert.ok(result.ok);
    const excluded = setContextIncluded(result.tray, result.item.id, false);
    const reincluded = setContextIncluded(excluded, result.item.id, true);
    assert.strictEqual(includedItems(reincluded).length, 1);
  });
});

describe('measurement honesty', () => {
  it('measures a note by its actual bytes', () => {
    resetContextIds();
    const result = attachContextItem(EMPTY_TRAY, {
      kind: 'note',
      label: 'note',
      locator: 'note:1',
      noteBody: 'hello',
    });
    assert.ok(result.ok);
    assert.deepStrictEqual(result.item.materialization, {
      mode: 'inline',
      measurement: { unit: 'bytes', value: 5 },
    });
  });

  it('counts multibyte characters as bytes, not characters', () => {
    resetContextIds();
    const result = attachContextItem(EMPTY_TRAY, {
      kind: 'note',
      label: 'note',
      locator: 'note:2',
      noteBody: 'café',
    });
    assert.ok(result.ok);
    const materialization = result.item.materialization;
    assert.strictEqual(materialization.mode, 'inline');
    assert.deepStrictEqual(
      materialization.mode === 'inline' ? materialization.measurement : null,
      { unit: 'bytes', value: 5 },
    );
  });

  it('never reports tokens', () => {
    const result = attachFolder();
    assert.ok(result.ok);
    assert.notStrictEqual(trayMeasurement(result.tray).unit, 'tokens');
  });
});

describe('unsupported kinds are rejected by the core API', () => {
  // Enforced in attachContextItem, not only in the menu. A direct caller must
  // not be able to create an item whose source nothing can read.
  // `web` moved out of this list when web links became a real kind with a
  // validated locator. The four remaining have no source or retrieval path.
  for (const kind of ['image', 'evidence', 'mcp-resource', 'live-app'] as const) {
    it(`rejects ${kind}`, () => {
      const result = attachContextItem(EMPTY_TRAY, {
        kind,
        label: kind,
        locator: `${kind}:1`,
      });
      assert.strictEqual(result.ok, false);
      assert.ok(!result.ok && result.reason === 'unsupported-kind');
    });
  }

  it('does not mislabel an unsupported kind as workspace-sourced', () => {
    const result = attachContextItem(EMPTY_TRAY, {
      kind: 'live-app',
      label: 'Soothsayer',
      locator: 'app:soothsayer',
    });
    assert.strictEqual(result.ok, false);
  });
});

describe('note material is retained', () => {
  it('returns the exact body alongside the item', () => {
    resetContextIds();
    const body = 'the exact text the user pasted';
    const result = attachContextItem(EMPTY_TRAY, {
      kind: 'note',
      label: 'note',
      locator: 'note:1',
      noteBody: body,
    });
    assert.ok(result.ok);
    assert.strictEqual(result.material, body);
  });

  it('keeps material out of the context item itself', () => {
    resetContextIds();
    const body = 'secret-ish content';
    const result = attachContextItem(EMPTY_TRAY, {
      kind: 'note',
      label: 'note',
      locator: 'note:1',
      noteBody: body,
    });
    assert.ok(result.ok);
    assert.ok(!JSON.stringify(result.item).includes(body), 'item must carry a reference, not content');
  });

  it('rejects a note with no body rather than claiming inline content', () => {
    const result = attachContextItem(EMPTY_TRAY, {
      kind: 'note',
      label: 'note',
      locator: 'note:1',
    });
    assert.strictEqual(result.ok, false);
    assert.ok(!result.ok && result.reason === 'missing-material');
  });

  it('stores and drops material with the item', () => {
    resetContextIds();
    const result = attachContextItem(EMPTY_TRAY, {
      kind: 'note',
      label: 'note',
      locator: 'note:1',
      noteBody: 'kept',
    });
    assert.ok(result.ok);

    const stored = putMaterial(EMPTY_MATERIAL, result.item.id, result.material ?? '');
    assert.deepStrictEqual(materialFor(result.tray, stored), { [result.item.id]: 'kept' });

    const dropped = dropMaterial(stored, result.item.id);
    assert.deepStrictEqual(materialFor(result.tray, dropped), {});
  });

  it('submits material only for included items', () => {
    resetContextIds();
    const result = attachContextItem(EMPTY_TRAY, {
      kind: 'note',
      label: 'note',
      locator: 'note:1',
      noteBody: 'kept',
    });
    assert.ok(result.ok);
    const stored = putMaterial(EMPTY_MATERIAL, result.item.id, 'kept');
    const excluded = setContextIncluded(result.tray, result.item.id, false);

    assert.deepStrictEqual(materialFor(includedItems(excluded), stored), {});
  });
});

describe('duplicates', () => {
  it('rejects the same locator twice for the same kind', () => {
    const first = attachFolder();
    assert.ok(first.ok);
    const second = attachContextItem(first.tray, {
      kind: 'folder',
      label: 'src again',
      locator: `${workspace.path}/src`,
      workspace,
    });
    assert.strictEqual(second.ok, false);
    assert.ok(!second.ok && second.reason === 'duplicate');
  });
});
