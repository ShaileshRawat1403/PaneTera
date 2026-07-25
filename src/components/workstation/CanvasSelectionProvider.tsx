import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface CanvasSelectionState {
  text: string;
  sourceElement: string;
  rect: DOMRect;
  sourceFile?: string;
  sourceLine?: number;
  timestamp: number;
}

interface CanvasSelectionContextType {
  selection: CanvasSelectionState | null;
  setSelection: (selection: CanvasSelectionState | null) => void;
  clearSelection: () => void;
}

const CanvasSelectionContext = createContext<CanvasSelectionContextType | null>(null);

export function CanvasSelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelectionState] = useState<CanvasSelectionState | null>(null);

  const setSelection = useCallback((sel: CanvasSelectionState | null) => {
    setSelectionState(sel ? { ...sel, timestamp: Date.now() } : null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectionState(null);
  }, []);

  return (
    <CanvasSelectionContext.Provider value={{ selection, setSelection, clearSelection }}>
      {children}
    </CanvasSelectionContext.Provider>
  );
}

export function useCanvasSelection() {
  const context = useContext(CanvasSelectionContext);
  if (!context) {
    throw new Error('useCanvasSelection must be used within CanvasSelectionProvider');
  }
  return context;
}
