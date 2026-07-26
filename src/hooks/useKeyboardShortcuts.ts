// src/hooks/useKeyboardShortcuts.ts
//
// Global keyboard shortcuts for the workstation.

import { useEffect } from 'react';

interface KeyboardShortcutHandlers {
  onModelSelector?: () => void;
  onCopy?: () => void;
  onExport?: () => void;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd+M — toggle model selector
      if (mod && e.key === 'm' && !e.shiftKey) {
        e.preventDefault();
        handlers.onModelSelector?.();
        return;
      }

      // Cmd+Shift+C — copy conversation
      if (mod && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        handlers.onCopy?.();
        return;
      }

      // Cmd+Shift+E — export conversation
      if (mod && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        handlers.onExport?.();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlers.onModelSelector, handlers.onCopy, handlers.onExport]);
}
