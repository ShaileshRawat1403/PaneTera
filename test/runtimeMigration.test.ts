import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';

async function runTests() {
  const tempDest = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-migration-dest-'));
  const tempSource = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-migration-src-'));

  process.env.TESSERA_APP_DATA = tempDest;
  process.env.TESSERA_LEGACY_DIR = tempSource;

  // Clear module cache so the new env vars take effect
  const appDataPath = require.resolve('../server/appData');
  delete require.cache[appDataPath];
  const { getPortalYamlPath, getWorkspaceCatalogPath } = await import('../server/appData');

  const testSeedPortal = 'workspaces:\n  - name: legacy-ws\n    folder: .\n';
  const testSeedCatalog = '{"workspaces":[{"id":"legacy","name":"Legacy WS","path":"/tmp","type":"repo","enabled":true,"status":"online"}]}';

  try {
    // 1. First-run with no legacy files → creates defaults
    console.log(' - Testing first-run default creation');
    const portalPath1 = getPortalYamlPath();
    assert.ok(fs.existsSync(portalPath1), 'portal.yaml should be created');
    const portalContent1 = fs.readFileSync(portalPath1, 'utf8');
    assert.ok(portalContent1.includes('workspaces: []'), 'Should create empty workspaces list');
    assert.strictEqual(portalPath1, path.join(tempDest, 'portal.yaml'), 'Should live in app-data dir');
    const catalogPath1 = getWorkspaceCatalogPath();
    assert.ok(fs.existsSync(catalogPath1), 'catalog should be created');
    assert.strictEqual(JSON.parse(fs.readFileSync(catalogPath1, 'utf8')).workspaces.length, 0, 'Should create empty catalog');

    // Clean for next test
    fs.unlinkSync(portalPath1);
    fs.unlinkSync(catalogPath1);

    // 2. Legacy files exist in tempSource → migrates once
    console.log(' - Testing legacy migration (one-time)');
    fs.writeFileSync(path.join(tempSource, 'portal.yaml'), testSeedPortal);
    fs.writeFileSync(path.join(tempSource, 'myai-workspaces.json'), testSeedCatalog);

    const portalPath2 = getPortalYamlPath();
    assert.ok(fs.existsSync(portalPath2), 'portal.yaml should be migrated');
    const portalContent2 = fs.readFileSync(portalPath2, 'utf8');
    assert.ok(portalContent2.includes('legacy-ws'), 'Migrated content should be preserved');
    assert.strictEqual(fs.readFileSync(path.join(tempSource, 'portal.yaml'), 'utf8'), testSeedPortal, 'Legacy file should remain untouched');

    const catalogPath2 = getWorkspaceCatalogPath();
    assert.ok(fs.existsSync(catalogPath2), 'catalog should be migrated');
    assert.strictEqual(JSON.parse(fs.readFileSync(catalogPath2, 'utf8')).workspaces[0].id, 'legacy', 'Migrated catalog should be preserved');

    // 3. Idempotency: calling again does not re-migrate
    console.log(' - Testing idempotency (one-time only)');
    const mtime1 = fs.statSync(portalPath2).mtimeMs;
    const catMtime1 = fs.statSync(catalogPath2).mtimeMs;

    // Remove legacy files
    fs.unlinkSync(path.join(tempSource, 'portal.yaml'));
    fs.unlinkSync(path.join(tempSource, 'myai-workspaces.json'));

    // Call again — should return existing app-data files without re-migrating
    const portalPath3 = getPortalYamlPath();
    const catalogPath3 = getWorkspaceCatalogPath();

    assert.strictEqual(portalPath3, portalPath2, 'Same app-data path');
    assert.strictEqual(catalogPath3, catalogPath2, 'Same app-data path');
    assert.strictEqual(fs.statSync(portalPath3).mtimeMs, mtime1, 'File should not be re-migrated');
    assert.strictEqual(fs.statSync(catalogPath3).mtimeMs, catMtime1, 'File should not be re-migrated');
    assert.ok(!fs.existsSync(path.join(tempSource, 'portal.yaml')), 'Legacy should still be absent');
    assert.ok(!fs.existsSync(path.join(tempSource, 'myai-workspaces.json')), 'Legacy should still be absent');

    console.log('Runtime Migration Tests passed.');
  } finally {
    fs.rmSync(tempDest, { recursive: true, force: true });
    fs.rmSync(tempSource, { recursive: true, force: true });
    delete process.env.TESSERA_APP_DATA;
    delete process.env.TESSERA_LEGACY_DIR;
  }
}

runTests().catch(err => {
  console.error('Migration test failed:', err);
  process.exit(1);
});
