import { useState, useEffect } from 'react';

const STORAGE_KEY = 'tessera.workbench.preferences.v1';

export interface WorkbenchPreferences {
  activeAppId: string | null;
  leftPanelWidth: number; // percentage or pixels, let's use pixels for now
}

const DEFAULT_PREFS: WorkbenchPreferences = {
  activeAppId: null,
  leftPanelWidth: 400
};

export function useWorkbenchPreferences() {
  const [prefs, setPrefs] = useState<WorkbenchPreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load workbench preferences', e);
    }
    return DEFAULT_PREFS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
      console.warn('Failed to save workbench preferences', e);
    }
  }, [prefs]);

  const setAppId = (appId: string | null) => setPrefs(p => ({ ...p, activeAppId: appId }));
  const setLeftPanelWidth = (width: number) => setPrefs(p => ({ ...p, leftPanelWidth: width }));

  return {
    prefs,
    setAppId,
    setLeftPanelWidth
  };
}
