// chrome-extension/scripts/zip.js
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const zipOutputPath = path.join(distDir, 'panetera-browser-operator.zip');

const ALLOWED_RUNTIME_FILES = [
  'manifest.json',
  'background.js',
  'messageRouting.js',
  'paneteraBridge.js',
  'storage.js',
  'transport.js',
  'popup.html',
  'popup.js',
  'pairing.html',
  'pairing.js',
  'observe.html',
  'observe.js',
  'sidepanel.html',
  'sidepanel.js',
  'icon16.png',
  'icon48.png',
  'icon128.png',
  'shared/contracts.js',
  'shared/validation.js',
  'shared/redactor.js',
  'dist/capture.bundle.js'
];

function setFixedTimestampRecursive(dirPath, timestamp) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      setFixedTimestampRecursive(fullPath, timestamp);
      fs.utimesSync(fullPath, timestamp, timestamp);
      fs.chmodSync(fullPath, 0o755);
    } else {
      fs.utimesSync(fullPath, timestamp, timestamp);
      fs.chmodSync(fullPath, 0o644);
    }
  }
}

export function buildDeterministicZip() {
  execSync('node scripts/build.js', { cwd: rootDir, stdio: 'inherit' });

  const stagingDir = fs.mkdtempSync(path.join('/tmp', 'panetera-ext-staging-'));

  try {
    ALLOWED_RUNTIME_FILES.forEach(relPath => {
      const srcFile = path.join(rootDir, relPath);
      const destFile = path.join(stagingDir, relPath);

      if (!fs.existsSync(srcFile)) {
        throw new Error(`Required runtime file missing: ${relPath}`);
      }

      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.copyFileSync(srcFile, destFile);
    });

    // Set fixed 1980-01-01T00:00:00Z mtime on every staged file and directory
    const fixedTime = new Date('1980-01-01T00:00:00Z');
    setFixedTimestampRecursive(stagingDir, fixedTime);
    fs.utimesSync(stagingDir, fixedTime, fixedTime);

    if (fs.existsSync(zipOutputPath)) {
      fs.unlinkSync(zipOutputPath);
    }

    // -X: exclude extra attributes, -y: preserve symlinks, -9: max compression
    const zipCmd = `cd "${stagingDir}" && find . -type f | sort | zip -X -9 -@ "${zipOutputPath}"`;
    execSync(zipCmd, { stdio: 'inherit' });

    fs.utimesSync(zipOutputPath, fixedTime, fixedTime);

    const zipContent = fs.readFileSync(zipOutputPath);
    const hash = crypto.createHash('sha256').update(zipContent).digest('hex');
    console.log(`Deterministic zip created: ${zipOutputPath} (size: ${zipContent.length} bytes, sha256: ${hash})`);
    return { path: zipOutputPath, hash, size: zipContent.length };
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && process.argv[1].endsWith('zip.js')) {
  try {
    buildDeterministicZip();
  } catch (err) {
    console.error('Packaging failed:', err);
    process.exit(1);
  }
}
