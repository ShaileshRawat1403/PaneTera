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

    // Diagnostic: surface the exact server reason if a Rig request is rejected.
    page.on('response', async (resp) => {
      if (resp.url().includes('/api/rig/') && resp.status() >= 400) {
        // eslint-disable-next-line no-console
        console.log(`\n[RIG ${resp.status()}] ${resp.request().method()} ${resp.url()}\n  ${await resp.text().catch(() => '')}\n`);
      }
    });

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
    // The label is on MUI's checkbox wrapper span, not a native input, so click
    // to toggle it on (it starts unchecked for a freshly discovered tool).
    // The wiped E2E app-data means this is the only connection, so the tool
    // controls are unambiguous at page level after enabling the echo tool.
    // (Review invocation is replaced by the approve prompt when clicked, so it
    // can't be part of a stable scope.)
    await page.getByLabel(`Enable ${connectionName}.echo`).click();
    await page.getByLabel('Arguments (JSON)', { exact: true }).fill('{"text":"hello"}');
    await page.getByRole('button', { name: 'Review invocation' }).click();
    await page.getByRole('button', { name: 'Approve and run' }).click();

    // The result is labeled untrusted and echoes the input. Assert against the
    // result element (aria-label "Untrusted MCP result"), since the same text
    // also appears in the arguments box that was typed.
    const result = page.getByLabel('Untrusted MCP result');
    await expect(result).toBeVisible({ timeout: 20_000 });
    await expect(result).toContainText(/"text":\s*"hello"/);

    // Clean up this connection.
    await card.getByRole('button', { name: 'Remove' }).click();
  });
});
