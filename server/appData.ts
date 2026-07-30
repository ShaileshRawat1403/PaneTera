import os from 'os';
import path from 'path';
import fs from 'fs';

export function getTesseraAppDataDir(): string {
  if (process.env.TESSERA_APP_DATA) {
    const overridePath = path.resolve(process.env.TESSERA_APP_DATA);
    fs.mkdirSync(overridePath, { recursive: true, mode: 0o700 });
    return overridePath;
  }

  const platform = os.platform();
  const homedir = os.homedir();
  let dataDir = '';

  if (platform === 'darwin') {
    dataDir = path.join(homedir, 'Library', 'Application Support', 'Tessera');
  } else if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local');
    dataDir = path.join(localAppData, 'Tessera');
  } else {
    const xdgDataHome = process.env.XDG_DATA_HOME || path.join(homedir, '.local', 'share');
    dataDir = path.join(xdgDataHome, 'tessera');
  }

  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  return dataDir;
}

export const getPaneTeraAppDataDir = getTesseraAppDataDir;

export function getPortalYamlPath(): string {
  const appDir = getPaneTeraAppDataDir();
  const newPath = path.join(appDir, 'portal.yaml');
  if (fs.existsSync(newPath)) return newPath;

  const legacyPath = path.join(process.cwd(), 'portal.yaml');
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

  const legacyPath = path.join(__dirname, 'myai-workspaces.json');
  if (fs.existsSync(legacyPath)) {
    fs.cpSync(legacyPath, newPath);
    console.log(`Migrated myai-workspaces.json → ${newPath}`);
    return newPath;
  }

  fs.writeFileSync(newPath, '{"workspaces":[]}\n');
  console.log(`Created default myai-workspaces.json at ${newPath}`);
  return newPath;
}
