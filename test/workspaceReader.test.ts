import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { listWorkspaces, readFileSafe } from '../server/workspaceReader';

async function runTests() {
  console.log("Running Workspace Reader Boundary Tests...");
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), 'workspace-test-'));
  
  process.env.WORKSPACE_ROOT = tempDir;
  const portalYamlPath = path.join(process.cwd(), 'portal.yaml');
  
  let originalYaml = '';
  if (fs.existsSync(portalYamlPath)) {
    originalYaml = fs.readFileSync(portalYamlPath, 'utf8');
  }

  try {
    const ws1Dir = path.join(tempDir, 'ws1');
    const ws2Dir = path.join(tempDir, 'ws2');
    fs.mkdirSync(ws1Dir);
    fs.mkdirSync(ws2Dir);

    fs.writeFileSync(path.join(ws1Dir, 'valid.txt'), 'valid content');
    
    // Symlink escape
    const outsideDir = path.join(process.cwd(), 'outside-test');
    if (!fs.existsSync(outsideDir)) fs.mkdirSync(outsideDir);
    fs.writeFileSync(path.join(outsideDir, 'escape.txt'), 'escape content');
    fs.symlinkSync(outsideDir, path.join(ws1Dir, 'symlink_dir'), 'dir');

    const yamlContent = `
workspaces:
  - name: "test-ws"
    folder: "ws1"
  - name: "legacy-ws"
    path: "${ws2Dir}"
`;
    fs.writeFileSync(portalYamlPath, yamlContent);

    // 1. Valid relative folder
    console.log(" - Testing valid relative folder");
    const content = await readFileSafe("test-ws", "valid.txt");
    assert.strictEqual(content, "valid content");

    // 2. ../ traversal rejection
    console.log(" - Testing ../ traversal rejection");
    await assert.rejects(
      readFileSafe("test-ws", "../ws2/somefile.txt"),
      /Path traversal detected/
    );

    // 3. Absolute outside-root rejection
    console.log(" - Testing absolute outside-root rejection");
    await assert.rejects(
      readFileSafe("test-ws", path.join(outsideDir, 'escape.txt')),
      /Path traversal detected/
    );

    // 4. Symlink escape rejection
    console.log(" - Testing symlink escape rejection");
    await assert.rejects(
      readFileSafe("test-ws", "symlink_dir/escape.txt"),
      /Path traversal detected/
    );

    // 5. Existing path property compatibility
    console.log(" - Testing existing path property compatibility");
    const workspaces = await listWorkspaces();
    const legacy = workspaces.find(w => w.name === 'legacy-ws');
    assert.ok(legacy, "Legacy workspace should be parsed");
    assert.strictEqual(legacy.path, ws2Dir);

    // 6. Missing folder safe error
    console.log(" - Testing missing folder safe error");
    const yamlMissingFolder = `
workspaces:
  - name: "test-ws"
`;
    fs.writeFileSync(portalYamlPath, yamlMissingFolder);
    await assert.rejects(
      listWorkspaces(),
      /missing 'folder' or 'path'/
    );

    // Restore yaml
    fs.writeFileSync(portalYamlPath, yamlContent);

    // 7. No absolute root leakage
    console.log(" - Testing no absolute root leakage");
    try {
      await readFileSafe("test-ws", "doesntexist.txt");
      assert.fail("Should throw");
    } catch (e: any) {
      assert.ok(!e.message.includes(tempDir), "Error message should not leak absolute path");
    }

    console.log("Workspace Reader Boundary Tests passed.");
  } finally {
    if (originalYaml) {
      fs.writeFileSync(portalYamlPath, originalYaml);
    } else {
      fs.unlinkSync(portalYamlPath);
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
    const outsideDir = path.join(process.cwd(), 'outside-test');
    if (fs.existsSync(outsideDir)) {
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  }
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
