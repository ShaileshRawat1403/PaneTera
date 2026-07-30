import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';

async function runTests() {
  const appDataKey = 'TESSERA_APP_DATA';
  const origAppData = process.env[appDataKey];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-migration-'));
  process.env[appDataKey] = tempDir;

  const { getPortalYamlPath, getWorkspaceCatalogPath } = await import('../server/appData');

  const legacyPortalYaml = path.join(process.cwd(), 'portal.yaml');
  const legacyCatalog = path.join(process.cwd(), 'server', 'myai-workspaces.json');

  // Stash any existing legacy files so first-run test is clean
  const hadLegacyPortal = fs.existsSync(legacyPortalYaml);
  const hadLegacyCatalog = fs.existsSync(legacyCatalog);
  const stashedPortal = path.join(os.tmpdir(), 'portal.yaml.stashed');
  const stashedCatalog = path.join(os.tmpdir(), 'myai-workspaces.json.stashed');
  if (hadLegacyPortal) fs.renameSync(legacyPortalYaml, stashedPortal);
  if (hadLegacyCatalog) fs.renameSync(legacyCatalog, stashedCatalog);

  const testSeedPortal = 'workspaces:\n  - name: legacy-ws\n    folder: .\n';
  const testSeedCatalog = '{"workspaces":[{"id":"legacy","name":"Legacy WS","path":"/tmp","type":"repo","enabled":true,"status":"online"}]}';

  try {
    // 1. First-run with no legacy files → creates defaults
    console.log(' - Testing first-run default creation');
    const portalPath1 = getPortalYamlPath();
    assert.ok(fs.existsSync(portalPath1), 'portal.yaml should be created');
    const portalContent1 = fs.readFileSync(portalPath1, 'utf8');
    assert.ok(portalContent1.includes('workspaces: []'), 'Should create empty workspaces list');
    assert.strictEqual(portalPath1, path.join(tempDir, 'portal.yaml'), 'Should live in app-data dir');
    const catalogPath1 = getWorkspaceCatalogPath();
    assert.ok(fs.existsSync(catalogPath1), 'catalog should be created');
    assert.strictEqual(JSON.parse(fs.readFileSync(catalogPath1, 'utf8')).workspaces.length, 0, 'Should create empty catalog');

    // Clean for next test
    fs.unlinkSync(portalPath1);
    fs.unlinkSync(catalogPath1);

    // 2. Legacy files exist → migrates once
    console.log(' - Testing legacy migration (one-time)');
    fs.writeFileSync(legacyPortalYaml, testSeedPortal);
    fs.writeFileSync(legacyCatalog, testSeedCatalog);

    const portalPath2 = getPortalYamlPath();
    assert.ok(fs.existsSync(portalPath2), 'portal.yaml should be migrated');
    const portalContent2 = fs.readFileSync(portalPath2, 'utf8');
    assert.ok(portalContent2.includes('legacy-ws'), 'Migrated content should be preserved');
    assert.strictEqual(fs.readFileSync(legacyPortalYaml, 'utf8'), testSeedPortal, 'Legacy file should remain untouched');

    const catalogPath2 = getWorkspaceCatalogPath();
    assert.ok(fs.existsSync(catalogPath2), 'catalog should be migrated');
    assert.strictEqual(JSON.parse(fs.readFileSync(catalogPath2, 'utf8')).workspaces[0].id, 'legacy', 'Migrated catalog should be preserved');

    // 3. Idempotency: calling again does not re-migrate
    console.log(' - Testing idempotency (one-time only)');
    const mtime1 = fs.statSync(portalPath2).mtimeMs;
    const catMtime1 = fs.statSync(catalogPath2).mtimeMs;

    // Remove legacy files but keep app-data files
    fs.unlinkSync(legacyPortalYaml);
    fs.unlinkSync(legacyCatalog);

    // Call again — should return existing app-data files without touching legacy
    const portalPath3 = getPortalYamlPath();
    const catalogPath3 = getWorkspaceCatalogPath();

    assert.strictEqual(portalPath3, portalPath2, 'Same app-data path');
    assert.strictEqual(catalogPath3, catalogPath2, 'Same app-data path');
    assert.strictEqual(fs.statSync(portalPath3).mtimeMs, mtime1, 'File should not be re-migrated');
    assert.strictEqual(fs.statSync(catalogPath3).mtimeMs, catMtime1, 'File should not be re-migrated');
    assert.ok(!fs.existsSync(legacyPortalYaml), 'Legacy portal.yaml should still be absent');
    assert.ok(!fs.existsSync(legacyCatalog), 'Legacy catalog should still be absent');

    console.log('Runtime Migration Tests passed.');
  } finally {
    // Restore legacy files
    if (hadLegacyPortal) fs.renameSync(stashedPortal, legacyPortalYaml);
    else if (fs.existsSync(legacyPortalYaml)) fs.unlinkSync(legacyPortalYaml);
    if (hadLegacyCatalog) fs.renameSync(stashedCatalog, legacyCatalog);
    else if (fs.existsSync(legacyCatalog)) fs.unlinkSync(legacyCatalog);

    process.env[appDataKey] = origAppData;
    fs.rmSync(tempDir, { recursive: true, force: true });
    // Clean stash files
    for (const f of [stashedPortal, stashedCatalog]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  }
}

runTests().catch(err => {
  console.error('Migration test failed:', err);
  process.exit(1);
});
