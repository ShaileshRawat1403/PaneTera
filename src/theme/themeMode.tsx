import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PaneTeraThemeMode } from './paneteraTheme';

export const THEME_MODE_STORAGE_KEY = 'panetera-theme-mode';

interface ThemeModeContextValue {
  mode: PaneTeraThemeMode;
  toggleMode: () => void;
}

const defaultThemeMode: ThemeModeContextValue = {
  mode: 'dark',
  toggleMode: () => undefined,
};

export const ThemeModeContext = createContext<ThemeModeContextValue>(defaultThemeMode);

export function readThemeModePreference(
  storage: Pick<Storage, 'getItem'> | undefined =
    typeof window === 'undefined' ? undefined : window.localStorage,
  media: Pick<MediaQueryList, 'matches'> | undefined =
    typeof matchMedia === 'undefined' ? undefined : matchMedia('(prefers-color-scheme: light)'),
): PaneTeraThemeMode {
  let stored: string | null | undefined;
  try {
    stored = storage?.getItem(THEME_MODE_STORAGE_KEY);
  } catch {
    stored = undefined;
  }
  if (stored === 'light' || stored === 'dark') return stored;
  return media?.matches ? 'light' : 'dark';
}

export function useThemeModeController() {
  const [mode, setMode] = useState<PaneTeraThemeMode>(() => readThemeModePreference());

  useEffect(() => {
    document.documentElement.style.colorScheme = mode;
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  const value = useMemo<ThemeModeContextValue>(
    () => ({
      mode,
      toggleMode: () => setMode((current) => {
        const next = current === 'dark' ? 'light' : 'dark';
        try {
          window.localStorage.setItem(THEME_MODE_STORAGE_KEY, next);
        } catch {
          // A blocked preference store must not make the visible control inert.
        }
        return next;
      }),
    }),
    [mode],
  );

  return value;
}

export function useThemeMode(): ThemeModeContextValue {
  return useContext(ThemeModeContext);
}

export function themeToggleLabel(mode: PaneTeraThemeMode): string {
  return mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
}
