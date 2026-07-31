import fs from 'node:fs';
import { E2E_APP_DATA } from '../playwright.config';

// Runs once before the E2E server boots. Wiping the dedicated E2E app-data
// gives every run a clean Rig, Headroom, and catalog, so leftover connections
// from a previous run can never accumulate or shadow selectors. The real
// app-data is a different directory and is never touched.
export default async function globalSetup(): Promise<void> {
  fs.rmSync(E2E_APP_DATA, { recursive: true, force: true });
}
