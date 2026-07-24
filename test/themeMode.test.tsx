// The theme toggle is a real application preference, not a cosmetic local
// state: it resolves stored/system preference, updates the root mode, persists,
// and keeps an action-oriented accessible name.

import { installDom } from './domEnv';

process.env.NODE_ENV = 'test';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  THEME_MODE_STORAGE_KEY,
  ThemeModeContext,
  readThemeModePreference,
  themeToggleLabel,
  useThemeModeController,
} from '../src/theme/themeMode';
import { WorkstationShell, type GovernanceSummary } from '../src/components/workstation/WorkstationShell';

const governanceStatus: GovernanceSummary = {
  gatewayConnected: true,
  activeWorkspaceName: null,
  policyActive: false,
  portalAuthValid: true,
  workspaceCatalogCount: 0,
  localAdapterActive: false,
  liveAppUrlReachable: false,
  liveAppManifestAvailable: false,
};

describe('theme preference resolution', () => {
  it('uses an explicit stored preference before the system preference', () => {
    assert.strictEqual(
      readThemeModePreference({ getItem: () => 'light' }, { matches: false }),
      'light',
    );
    assert.strictEqual(
      readThemeModePreference({ getItem: () => 'dark' }, { matches: true }),
      'dark',
    );
  });

  it('falls back to the system preference when storage is absent or invalid', () => {
    assert.strictEqual(readThemeModePreference({ getItem: () => null }, { matches: true }), 'light');
    assert.strictEqual(readThemeModePreference({ getItem: () => 'invented' }, { matches: false }), 'dark');
  });

  it('describes the action rather than merely naming the current state', () => {
    assert.strictEqual(themeToggleLabel('dark'), 'Switch to light mode');
    assert.strictEqual(themeToggleLabel('light'), 'Switch to dark mode');
  });
});

describe('workstation theme toggle', () => {
  it('switches the whole root preference, persists it, and updates its accessible name', async () => {
    const win = installDom();
    win.localStorage.clear();
    const warnings: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => warnings.push(args.map(String).join(' '));

    function Harness() {
      const themeMode = useThemeModeController();
      return (
        <ThemeModeContext.Provider value={themeMode}>
          <WorkstationShell
            conversation={<div>Conversation</div>}
            canvas={<div>Canvas</div>}
            renderActivity={() => null}
            renderRig={() => null}
            renderHeadroom={() => null}
            renderWorkspaceSelector={() => null}
            governanceStatus={governanceStatus}
            onOpenAudit={() => undefined}
          />
        </ThemeModeContext.Provider>
      );
    }

    const container = win.document.createElement('div');
    win.document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => root.render(<Harness />));
      const lightButton = container.querySelector('button[aria-label="Switch to light mode"]') as HTMLButtonElement;
      assert.ok(lightButton, 'dark mode offers the light-mode action');
      assert.strictEqual(lightButton.getAttribute('aria-pressed'), 'false');

      await act(async () => lightButton.dispatchEvent(new win.MouseEvent('click', { bubbles: true })));

      const darkButton = container.querySelector('button[aria-label="Switch to dark mode"]') as HTMLButtonElement;
      assert.ok(darkButton, 'light mode offers the dark-mode action');
      assert.strictEqual(darkButton.getAttribute('aria-pressed'), 'true');
      assert.strictEqual(win.localStorage.getItem(THEME_MODE_STORAGE_KEY), 'light');
      assert.strictEqual(win.document.documentElement.dataset.theme, 'light');
      assert.strictEqual(win.document.documentElement.style.colorScheme, 'light');
    } finally {
      await act(async () => root.unmount());
      console.error = originalError;
    }

    assert.deepStrictEqual(warnings.filter((warning) => /Warning:/.test(warning)), []);
  });
});

