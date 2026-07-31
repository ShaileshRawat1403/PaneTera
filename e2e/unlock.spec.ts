import { test, expect } from '@playwright/test';
import { startLocked } from './helpers';
import { E2E_PORTAL_TOKEN } from '../playwright.config';

// Journey: unlock. A fresh visitor sees the token gate, enters the local token,
// and reaches the workstation. A wrong token must not unlock.
test.describe('unlock', () => {
  test.beforeEach(async ({ page }) => {
    await startLocked(page);
  });

  test('the token gate is shown before unlock', async ({ page }) => {
    await page.goto('/');
    // The gate is a modal dialog over the workstation; presence of the dialog,
    // not absence of the canvas, is what "locked" means.
    await expect(page.getByText('Unlock PaneTera')).toBeVisible();
    await expect(page.getByPlaceholder('Local token')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unlock' })).toBeVisible();
  });

  test('the correct token unlocks into the workstation', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('Local token').fill(E2E_PORTAL_TOKEN);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.getByTestId('workstation-canvas')).toBeVisible();
    // The gate is gone once unlocked.
    await expect(page.getByText('Unlock PaneTera')).toHaveCount(0);
  });

  test('a wrong token does not unlock', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('Local token').fill('definitely-not-the-token');
    await page.getByRole('button', { name: 'Unlock' }).click();
    // handleTokenSave verifies against /api/health; a rejected token surfaces an
    // error and the gate stays open. This proves the server is the real gate.
    await expect(page.getByText(/Invalid token|Failed to verify/i)).toBeVisible();
    await expect(page.getByText('Unlock PaneTera')).toBeVisible();
  });
});
