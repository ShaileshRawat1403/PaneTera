import { test, expect } from '@playwright/test';
import { startUnlocked } from './helpers';

// Journeys over the unlocked workstation: the canvas loads, and the governed
// surfaces (Rig, Headroom, project switching, audit) open. These use the
// controls' accessible names, which are stable contract points.
test.describe('workstation surfaces', () => {
  test.beforeEach(async ({ page }) => {
    await startUnlocked(page);
    await page.goto('/');
    await expect(page.getByTestId('workstation-canvas')).toBeVisible();
  });

  test('the single authoritative canvas is present', async ({ page }) => {
    // Exactly one main landmark, per the workstation contract.
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByTestId('workstation-canvas')).toBeVisible();
  });

  test('the Rig drawer opens', async ({ page }) => {
    await page.getByLabel('Toggle Rig drawer').click();
    // A dialog/region becomes visible; Rig names its connections surface.
    await expect(page.getByRole('dialog').or(page.getByText(/Rig/i)).first()).toBeVisible();
  });

  test('the Headroom drawer opens', async ({ page }) => {
    await page.getByLabel('Toggle Headroom drawer').click();
    await expect(page.getByText(/Headroom/i).first()).toBeVisible();
  });

  test('the audit log opens', async ({ page }) => {
    await page.getByLabel('Open audit log').click();
    await expect(page.getByText(/audit/i).first()).toBeVisible();
  });

  test('the project switcher opens', async ({ page }) => {
    // "Switch project" opens a MUI popover and toggles aria-expanded; assert the
    // expanded state rather than the popover's internal role.
    const button = page.getByLabel('Switch project');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  test('the gateway status indicator renders a definite state', async ({ page }) => {
    // Degraded-backend coverage starts here: the indicator must report a real
    // state (connected or unreachable), never a blank/unknown one. The full
    // degraded journey (kill the API mid-session) is documented in E2E.md.
    const indicator = page.getByRole('img', { name: /Gateway (connected|unreachable)/ });
    await expect(indicator).toBeVisible();
  });
});
