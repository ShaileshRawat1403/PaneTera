import { test, expect } from '@playwright/test';
import path from 'node:path';
import { startUnlocked } from './helpers';

// Journey: the governed Rig MCP flow end to end, against the stub server at
// test/fixtures/rigMcpServer.mjs (an `echo` tool plus a resource and a prompt).
// Add a stdio server, review and approve the exact connection, discover its
// capabilities, enable the echo tool, review the invocation, approve and run,
// and confirm the untrusted, provenance-tracked result echoes the input.
//
// Paths are derived so the test is portable: process.execPath is the node that
// runs the tests, process.cwd() is the repo root (also the app's cwd under
// `npm run dev`), and the fixture is resolved beneath it.
test.describe('rig governed MCP flow', () => {
  const connectionName = `e2e-fixture-${Date.now()}`;
  const fixtureArgs = JSON.stringify([path.resolve('test/fixtures/rigMcpServer.mjs')]);

  test('approve → discover → invoke the echo tool on a stdio MCP server', async ({ page }) => {
    await startUnlocked(page);
    await page.goto('/');

    // Open Rig and begin a new local stdio connection.
    await page.getByLabel('Toggle Rig drawer').click();
    await page.getByRole('button', { name: 'Add server' }).click();

    await page.getByLabel('Connection name').fill(connectionName);
    await page.getByLabel('Absolute executable path').fill(process.execPath);
    await page.getByLabel('Absolute working directory').fill(process.cwd());
    await page.getByLabel('Arguments (JSON array)').fill(fixtureArgs);
    await page.getByRole('button', { name: 'Record for review' }).click();

    // Governance gate: approve the exact reviewed connection.
    await page.getByRole('button', { name: 'Approve connection' }).click();

    // The server starts and discovers its capabilities.
    await expect(page.getByText(/discovered/).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /^Inspect/ }).click();

    // Enable the echo tool, set arguments, review, and run under approval.
    await page.getByLabel(/^Enable .*echo/i).check();
    await page.getByLabel('Arguments (JSON)', { exact: true }).fill('{"text":"hello"}');
    await page.getByRole('button', { name: 'Review invocation' }).click();
    await page.getByRole('button', { name: 'Approve and run' }).click();

    // The result is labeled untrusted and echoes the input.
    await expect(page.getByText('Untrusted MCP result')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/"text":\s*"hello"/)).toBeVisible();

    // Clean up so re-runs start from a fresh state.
    await page.getByRole('button', { name: 'Remove' }).first().click();
  });
});
