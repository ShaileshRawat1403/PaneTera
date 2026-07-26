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
    // Linux and others (XDG Base Directory Specification)
    const xdgDataHome = process.env.XDG_DATA_HOME || path.join(homedir, '.local', 'share');
    dataDir = path.join(xdgDataHome, 'tessera');
  }

  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  return dataDir;
}

// Alias for newer code referencing the renamed function
export const getPaneTeraAppDataDir = getTesseraAppDataDir;
