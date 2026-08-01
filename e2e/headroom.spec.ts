import { test, expect } from '@playwright/test';
import { startUnlocked } from './helpers';

// Journey: a durable Headroom capsule survives a reload and can be resumed.
// Capsules persist server-side and are authored straight from the panel form,
// so this needs no live model call. Create a capsule (title + objective + a
// decision), reload to prove it is durable rather than session-scoped, select
// and resume it, confirm the objective flows back and the resume is disclosed,
// then delete it to clean up.
//
// Runs on the wiped E2E app-data (see playwright.config + globalSetup), so the
// capsule this test creates is the only one present and its title is unique.
test.describe('Headroom capsule resume', () => {
  const stamp = Date.now();
  const capsuleTitle = `e2e-capsule-${stamp}`;
  const objective = `Resume across reload ${stamp}`;
  const decision = 'Seed decision for the resume journey';

  test('create → reload → select → resume a durable capsule', async ({ page }) => {
    // A reload plus two Headroom loads take a moment; keep headroom above default.
    test.setTimeout(60_000);

    await startUnlocked(page);
    await page.goto('/');

    // Open Headroom and author a capsule from the form. getByLabel does a
    // substring match, so "Decisions" avoids the em dash in the real label.
    await page.getByLabel('Toggle Headroom drawer').click();
    await page.getByLabel('Capsule title').fill(capsuleTitle);
    await page.getByLabel('Current objective').fill(objective);
    await page.getByLabel('Decisions').fill(decision);
    await page.getByRole('button', { name: 'Save capsule', exact: true }).click();

    // The save is disclosed, and the capsule appears as a chip under Durable capsules.
    await expect(page.getByText('Headroom capsule saved.')).toBeVisible();
    await expect(page.getByRole('button', { name: capsuleTitle, exact: true })).toBeVisible();

    // Reload the whole app: the drawer closes and in-memory state is gone. If the
    // capsule is truly durable it is still there after reopening Headroom.
    await page.reload();
    await page.getByLabel('Toggle Headroom drawer').click();
    const chip = page.getByRole('button', { name: capsuleTitle, exact: true });
    await expect(chip).toBeVisible({ timeout: 15_000 });

    // Select it: selecting rehydrates the form, so the objective returns.
    await chip.click();
    await expect(page.getByLabel('Current objective')).toHaveValue(objective);

    // Resume it: the capsule becomes the active context for new turns, which the
    // panel discloses. (The deeper effect on a turn needs a model call and is out
    // of scope; the disclosure plus rehydrated objective is the boundary here.)
    await page.getByRole('button', { name: 'Resume selected capsule' }).click();
    await expect(page.getByText(/Capsule resumed/)).toBeVisible();

    // Clean up: delete the capsule through its confirm dialog.
    await page.getByRole('button', { name: 'Delete capsule', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete capsule' }).click();
    await expect(page.getByText(/capsule deleted/i)).toBeVisible();
    await expect(page.getByRole('button', { name: capsuleTitle, exact: true })).toHaveCount(0);
  });
});
