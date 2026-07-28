// src/components/evidence/useEvidencePanel.ts
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

export interface EvidenceSourceItem {
  id: string;
  name: string;
  type: 'log' | 'metric' | 'trace' | 'alert' | 'document' | 'browser';
  count?: number;
  content?: unknown;
}

export interface BrowserEvidenceRecord {
  id: string;
  url?: string;
  title?: string;
  timestamp?: string;
  elements?: unknown[];
  screenshot?: string;
  [key: string]: unknown;
}

export function useEvidencePanel(customSources?: EvidenceSourceItem[]) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [activeTabId, setActiveTabId] = useState<string>('logs');
  const [drawerHeight, setDrawerHeight] = useState<number>(260);

  const isResizingRef = useRef<boolean>(false);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);

  const [browserEvidence, setBrowserEvidence] = useState<BrowserEvidenceRecord[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState<boolean>(false);

  const [sources, setSources] = useState<EvidenceSourceItem[]>(
    customSources || [
      { id: 'logs', name: 'Agent Logs', type: 'log', count: 0 },
      { id: 'metrics', name: 'Telemetry', type: 'metric', count: 0 },
      { id: 'browser', name: 'Browser Evidence', type: 'browser', count: 0 },
      { id: 'alerts', name: 'Security & SLA Alerts', type: 'alert', count: 0 },
    ]
  );

  // Fetch real evidence data from the server
  useEffect(() => {
    let cancelled = false;
    setEvidenceLoading(true);
    fetch('/api/evidence')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const observations: BrowserEvidenceRecord[] = data.observations ?? [];
        const extractions: BrowserEvidenceRecord[] = data.extractions ?? [];
        const allBrowser = [...observations, ...extractions];
        setBrowserEvidence(allBrowser);
        setSources((prev) =>
          prev.map((s) => {
            if (s.id === 'browser') return { ...s, count: allBrowser.length, content: allBrowser };
            if (s.id === 'logs') return { ...s, count: observations.length };
            return s;
          })
        );
      })
      .catch(() => {
        // Evidence endpoint unavailable — keep defaults
      })
      .finally(() => {
        if (!cancelled) setEvidenceLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const selectTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    if (!isExpanded) setIsExpanded(true);
  }, [isExpanded]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isResizingRef.current = true;
      startYRef.current = e.clientY;
      startHeightRef.current = drawerHeight;
      if (!isExpanded) setIsExpanded(true);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [drawerHeight, isExpanded]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaY = startYRef.current - e.clientY;
      const newHeight = Math.min(520, Math.max(140, startHeightRef.current + deltaY));
      setDrawerHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const summary = useMemo(() => {
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      count: s.count ?? (Array.isArray(s.content) ? s.content.length : 1),
    }));
  }, [sources]);

  return {
    isExpanded,
    setIsExpanded,
    toggleExpanded,
    activeTabId,
    selectTab,
    sources,
    setSources,
    summary,
    drawerHeight,
    handleResizeStart,
    browserEvidence,
    evidenceLoading,
  };
}
