import os from 'os';
import path from 'path';
import fs from 'fs';

type Environment = Readonly<Record<string, string | undefined>>;

const APP_DATA_REFUSAL =
  'Refusing to use the real PaneTera app-data directory from a test process. '
  + 'Set TESSERA_APP_DATA to an isolated temporary directory '
  + '(npm test does this through test/support/isolatedAppData.mjs).';

/**
 * True inside a test process: the Node test runner (NODE_TEST_CONTEXT), an
 * explicit NODE_ENV=test, or a test file run directly. A test process must
 * never read or write the operator's real PaneTera state.
 */
export function isTestProcess(env: Environment = process.env, argv: readonly string[] = process.argv): boolean {
  if (env.NODE_ENV === 'test' || typeof env.NODE_TEST_CONTEXT === 'string') return true;
  return argv.slice(1).some((arg) => /\.test\.[cm]?[jt]sx?$/.test(arg));
}

/** The operator's real app-data directory for this platform. Resolves only; creates nothing. */
export function productionAppDataDir(env: Environment = process.env): string {
  const homedir = os.homedir();
  const platform = os.platform();
  if (platform === 'darwin') return path.join(homedir, 'Library', 'Application Support', 'Tessera');
  if (platform === 'win32') return path.join(env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local'), 'Tessera');
  return path.join(env.XDG_DATA_HOME || path.join(homedir, '.local', 'share'), 'tessera');
}

/** Whether two paths name the same location, following symlinks where they exist. */
export function sameLocation(a: string, b: string): boolean {
  const canonical = (value: string) => {
    const resolved = path.resolve(value);
    try { return fs.realpathSync(resolved); } catch { return resolved; }
  };
  return canonical(a) === canonical(b);
}

export function getTesseraAppDataDir(): string {
  const testProcess = isTestProcess();
  const override = process.env.TESSERA_APP_DATA;

  if (override) {
    const overridePath = path.resolve(override);
    // An override that points back at the real directory is not isolation.
    if (testProcess && sameLocation(overridePath, productionAppDataDir())) throw new Error(APP_DATA_REFUSAL);
    fs.mkdirSync(overridePath, { recursive: true, mode: 0o700 });
    return overridePath;
  }

  // Fail closed: resolve nothing and create nothing on the operator's disk.
  if (testProcess) throw new Error(APP_DATA_REFUSAL);

  const dataDir = productionAppDataDir();
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  return dataDir;
}

export const getPaneTeraAppDataDir = getTesseraAppDataDir;

export function getPortalYamlPath(): string {
  const appDir = getPaneTeraAppDataDir();
  const newPath = path.join(appDir, 'portal.yaml');
  if (fs.existsSync(newPath)) return newPath;

  const legacyBase = process.env.TESSERA_LEGACY_DIR || process.cwd();
  const legacyPath = path.join(legacyBase, 'portal.yaml');
  if (fs.existsSync(legacyPath)) {
    fs.cpSync(legacyPath, newPath);
    console.log(`Migrated portal.yaml → ${newPath}`);
    return newPath;
  }

  fs.writeFileSync(newPath, '# portal.yaml — runtime workspace catalog\n# Managed by PaneTera. Do not edit while the portal is running.\nworkspaces: []\n');
  console.log(`Created default portal.yaml at ${newPath}`);
  return newPath;
}

export function getWorkspaceCatalogPath(): string {
  const appDir = getPaneTeraAppDataDir();
  const newPath = path.join(appDir, 'myai-workspaces.json');
  if (fs.existsSync(newPath)) return newPath;

  const legacyBase = process.env.TESSERA_LEGACY_DIR || __dirname;
  const legacyPath = path.join(legacyBase, 'myai-workspaces.json');
  if (fs.existsSync(legacyPath)) {
    fs.cpSync(legacyPath, newPath);
    console.log(`Migrated myai-workspaces.json → ${newPath}`);
    return newPath;
  }

  fs.writeFileSync(newPath, '{"workspaces":[]}\n');
  console.log(`Created default myai-workspaces.json at ${newPath}`);
  return newPath;
}
