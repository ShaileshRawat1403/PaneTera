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
    // Spawning a subprocess, discovering, and a gated invocation take a while.
    test.setTimeout(90_000);

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

    // Scope to this connection's card so a pre-existing connection can't be
    // confused with it: the card is the div holding both this name and a Remove.
    const card = page.locator('div')
      .filter({ has: page.getByRole('heading', { name: connectionName, exact: true }) })
      .filter({ has: page.getByRole('button', { name: 'Remove' }) })
      .last();

    // It lands as "Approval required"; open its review, then approve in the dialog.
    await card.getByRole('button', { name: 'Review and connect', exact: true }).click();
    await page.getByRole('button', { name: 'Approve connection' }).click();

    // The server starts and discovers its capabilities on this card.
    await expect(card.getByText(/discovered/)).toBeVisible({ timeout: 30_000 });
    await card.getByRole('button', { name: /^Inspect/ }).click();

    // The echo capability is labeled per connection: "Enable <name>.echo".
    // Enable it, then scope the invocation to this exact tool card so a
    // same-named tool on another connection can't shadow the controls.
    const enableEcho = page.getByLabel(`Enable ${connectionName}.echo`);
    await enableEcho.check();
    const echoTool = page.locator('div')
      .filter({ has: enableEcho })
      .filter({ has: page.getByRole('button', { name: 'Review invocation' }) })
      .last();

    await echoTool.getByLabel('Arguments (JSON)', { exact: true }).fill('{"text":"hello"}');
    await echoTool.getByRole('button', { name: 'Review invocation' }).click();
    await echoTool.getByRole('button', { name: 'Approve and run' }).click();

    // The result is labeled untrusted and echoes the input.
    await expect(echoTool.getByText('Untrusted MCP result')).toBeVisible({ timeout: 20_000 });
    await expect(echoTool.getByText(/"text":\s*"hello"/)).toBeVisible();

    // Clean up only this connection so re-runs start fresh.
    await card.getByRole('button', { name: 'Remove' }).click();
  });
});
