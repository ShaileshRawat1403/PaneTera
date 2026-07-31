import type { Page } from '@playwright/test';
import { E2E_PORTAL_TOKEN } from '../playwright.config';

/**
 * Seed the local token into storage before the app loads, so a spec starts
 * already unlocked. The dedicated unlock spec exercises the real token-entry
 * screen instead of using this.
 */
export async function startUnlocked(page: Page): Promise<void> {
  await page.addInitScript((token) => {
    window.localStorage.setItem('panetera-token', token as string);
  }, E2E_PORTAL_TOKEN);
}

/** Clear any seeded auth so the token-entry screen is shown. */
export async function startLocked(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.removeItem('panetera-token');
    window.localStorage.removeItem('portalToken');
  });
}
