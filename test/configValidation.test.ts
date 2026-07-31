// test/configValidation.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateWorkspaceCatalog, validatePortalCatalog } from '../server/configValidation';

describe('validateWorkspaceCatalog', () => {
  it('accepts an empty catalog and valid entries', () => {
    assert.deepStrictEqual(validateWorkspaceCatalog({ workspaces: [] }), []);
    assert.deepStrictEqual(validateWorkspaceCatalog({ workspaces: [{ name: 'ws', extra: 1 }] }), []);
  });
  it('rejects a non-object or a non-array workspaces field', () => {
    assert.strictEqual(validateWorkspaceCatalog(null).length, 1);
    assert.strictEqual(validateWorkspaceCatalog([]).length, 1);
    assert.strictEqual(validateWorkspaceCatalog({ workspaces: 'nope' }).length, 1);
  });
  it('flags entries missing a non-empty name, by index', () => {
    const errs = validateWorkspaceCatalog({ workspaces: [{ name: 'ok' }, { name: '' }, 5] });
    assert.strictEqual(errs.length, 2);
    assert.match(errs[0], /workspaces\[1\]/);
    assert.match(errs[1], /workspaces\[2\]/);
  });
});

describe('validatePortalCatalog', () => {
  it('accepts empty, missing, and null workspaces as a valid empty catalog', () => {
    assert.deepStrictEqual(validatePortalCatalog({ workspaces: [] }), []);
    assert.deepStrictEqual(validatePortalCatalog({}), []);
    assert.deepStrictEqual(validatePortalCatalog({ workspaces: null }), []);
  });
  it('accepts valid entries with name and optional folder', () => {
    assert.deepStrictEqual(validatePortalCatalog({ workspaces: [{ name: 'ws', folder: 'p' }] }), []);
    assert.deepStrictEqual(validatePortalCatalog({ workspaces: [{ name: 'ws' }] }), []);
  });
  it('rejects a non-mapping root and a non-list workspaces', () => {
    assert.strictEqual(validatePortalCatalog(null).length, 1);
    assert.strictEqual(validatePortalCatalog({ workspaces: 'x' }).length, 1);
  });
  it('flags a missing name and a non-string folder', () => {
    const errs = validatePortalCatalog({ workspaces: [{ folder: 'p' }, { name: 'ok', folder: 3 }] });
    assert.strictEqual(errs.length, 2);
    assert.match(errs[0], /workspaces\[0\].*name/);
    assert.match(errs[1], /workspaces\[1\]\.folder/);
  });
});
