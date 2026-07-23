// chrome-extension/scripts/build.js
import esbuild from 'esbuild';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const bundlePath = path.join(distDir, 'capture.bundle.js');

async function build() {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  await esbuild.build({
    entryPoints: [path.join(rootDir, 'src', 'index.js')],
    bundle: true,
    outfile: bundlePath,
    format: 'iife',
    globalName: 'PaneTeraExtractors',
    target: ['chrome116'],
    minify: false
  });

  const content = fs.readFileSync(bundlePath);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  console.log(`Build complete: dist/capture.bundle.js (size: ${content.length} bytes, sha256: ${hash})`);
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
