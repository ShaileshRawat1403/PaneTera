import { defineConfig, devices } from '@playwright/test';

// The token the E2E server boots with and the specs unlock against. Override
// with PORTAL_TOKEN in the environment; the default is fine for local runs.
export const E2E_PORTAL_TOKEN = process.env.PORTAL_TOKEN || 'e2e-local-token';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // Journeys share one local server and touch persistent state, so run serially.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Boots the real app (client on 5173 proxying /api to the server on 4000)
  // with a known token. reuseExistingServer lets you point at a dev server you
  // already have running locally.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORTAL_TOKEN: E2E_PORTAL_TOKEN,
      PORT: '4000',
    },
  },
});
