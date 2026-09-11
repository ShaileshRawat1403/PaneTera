// test/support/isolatedAppData.mjs
//
// Preloaded into every `npm test` process (see package.json). Tests must never
// read or write the operator's real PaneTera state, so each test process gets
// its own temporary app-data directory, audit log, and working-state root,
// removed when the process exits.
//
// server/appData.ts and server/audit.ts refuse the real locations from any
// test process, so a test run without this preload fails closed instead of
// writing there.

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-test-state-'));
const appData = path.join(root, 'app-data');
fs.mkdirSync(appData, { mode: 0o700 });

process.env.PANETERA_TEST_STATE_ROOT = root;
process.env.TESSERA_APP_DATA = appData;
process.env.PANETERA_AUDIT_LOG = path.join(root, 'audit.log');
process.env.PANETERA_RUN_HISTORY_DIR = path.join(root, 'agent-history');
// Always a throwaway credential, even if the shell exports a real one. Server
// code skips .env in test processes, so nothing supplies the operator's token.
process.env.PORTAL_TOKEN = `panetera-test-${randomUUID()}`;

process.on('exit', () => {
  fs.rmSync(root, { recursive: true, force: true });
});
