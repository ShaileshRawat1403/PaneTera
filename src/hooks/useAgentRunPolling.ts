// src/hooks/useAgentRunPolling.ts
//
// Real-time agent run updates via SSE with polling fallback.
// Falls back to polling if SSE connection fails.

import { useState, useEffect, useCallback, useRef } from 'react';

interface AgentRunData {
  run: {
    runId: string;
    status: string;
    reply?: string;
    events: unknown[];
    [key: string]: unknown;
  };
  events: unknown[];
}

const POLL_INTERVAL_MS = 2000;
const ACTIVE_STATUSES = new Set(['queued', 'planning', 'running', 'waiting-approval', 'verifying']);

export function useAgentRunPolling(runId: string | null, token: string) {
  const [data, setData] = useState<AgentRunData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const stopSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const stop = useCallback(() => {
    stopSSE();
    stopPoll();
  }, [stopSSE, stopPoll]);

  // Fallback polling
  const startPoll = useCallback(() => {
    stopPoll();
    const poll = async () => {
      try {
        const resp = await fetch(`/api/agent/run/${runId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) return;
        const result = await resp.json();
        setData(result);

        if (!ACTIVE_STATUSES.has(result.run?.status)) {
          stopPoll();
        }
      } catch {
        // Silently ignore poll errors
      }
    };

    void poll();
    pollTimerRef.current = setInterval(poll, POLL_INTERVAL_MS);
  }, [runId, token, stopPoll]);

  useEffect(() => {
    if (!runId) return;

    // Try SSE first
    try {
      const es = new EventSource(`/api/agent/run/${runId}/events`);
      eventSourceRef.current = es;
      setIsStreaming(true);

      es.addEventListener('run', (e) => {
        const run = JSON.parse(e.data);
        setData((prev) => ({ ...prev, run, events: run.events || [] }));
      });

      es.addEventListener('status', (e) => {
        const { status, reply } = JSON.parse(e.data);
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            run: { ...prev.run, status, reply: reply || prev.run.reply },
          };
        });
      });

      es.addEventListener('events', (e) => {
        const newEvents = JSON.parse(e.data);
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            events: [...prev.events, ...newEvents],
            run: { ...prev.run, events: [...(prev.run.events || []), ...newEvents] },
          };
        });
      });

      es.addEventListener('done', (e) => {
        const { status, reply } = JSON.parse(e.data);
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            run: { ...prev.run, status, reply: reply || prev.run.reply },
          };
        });
        es.close();
        eventSourceRef.current = null;
        setIsStreaming(false);
      });

      es.addEventListener('error', () => {
        // SSE failed, fall back to polling
        es.close();
        eventSourceRef.current = null;
        setIsStreaming(false);
        startPoll();
      });

      es.onerror = () => {
        // Connection error, fall back to polling
        es.close();
        eventSourceRef.current = null;
        setIsStreaming(false);
        startPoll();
      };
    } catch {
      // EventSource not supported or other error, fall back to polling
      startPoll();
    }

    return () => {
      stop();
    };
  }, [runId, token, startPoll, stop]);

  return { data, error, stop, isStreaming };
}
