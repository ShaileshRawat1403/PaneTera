import { test, expect } from '@playwright/test';
import { startUnlocked } from './helpers';

// Journey: degraded backend. When the API is unreachable, the app must report
// the honest unreachable state rather than showing a fake-connected gateway or
// stale data. Simulated with route interception so it is deterministic and
// needs no process management.
test.describe('degraded backend', () => {
  test('reports the gateway as unreachable when every API call fails', async ({ page }) => {
    await startUnlocked(page);
    // Fail all backend calls, including the /api/health poll that drives the
    // gateway indicator (App.tsx: gatewayConnected = backendHealth.status==='ok').
    await page.route('**/api/**', (route) => route.abort());

    await page.goto('/');

    // The client canvas still renders; the app is offline-tolerant.
    await expect(page.getByTestId('workstation-canvas')).toBeVisible();
    // But the gateway must state the truth, not claim connected.
    await expect(page.getByRole('img', { name: /Gateway unreachable/ })).toBeVisible();
    await expect(page.getByRole('img', { name: /Gateway connected/ })).toHaveCount(0);
  });

  test('recovers to connected on reload once the API is reachable again', async ({ page }) => {
    await startUnlocked(page);

    // The health check runs once per load (App.tsx effect keyed on token), so
    // recovery of the indicator happens on reload, not by background polling.
    // This test pins that real behavior; if the app later adds health polling,
    // switch it to assert recovery without the reload.
    let apiDown = true;
    await page.route('**/api/**', (route) => (apiDown ? route.abort() : route.continue()));

    await page.goto('/');
    await expect(page.getByRole('img', { name: /Gateway unreachable/ })).toBeVisible();

    apiDown = false;
    await page.reload();
    await expect(page.getByRole('img', { name: /Gateway connected/ })).toBeVisible();
  });
});
