// src/components/workbench/AgentRunLiveCard.tsx
//
// The live wrapper around AgentRunCard for a canvas-mounted run. It subscribes to
// the run (token deltas, governed steps, terminal reply), folds the delta stream
// into a live reply, and keeps the (potentially hundreds of) delta events out of
// the visible timeline. Extracted from InteractiveComponent so the run's hooks
// live at a component top level rather than inside a conditional branch.
//
// It also routes a finished run's canvas artifact. When a run fetches a page
// (fetchWebPage), the tool's uiComponent rides the run to completion; this hands
// it to the host once, so the page opens on the canvas instead of being trapped
// inside the run card.

import React, { useEffect, useRef } from 'react';
import { useAgentRunPolling } from '../../hooks/useAgentRunPolling';
import { AgentRunCard } from './AgentRunCard';

const ACTIVE_STATUSES = ['queued', 'planning', 'running', 'waiting-approval', 'verifying'];

export interface RunArtifact {
  type: string;
  data?: Record<string, unknown>;
}

interface Props {
  data: any;
  token: string;
  onApproveBrowserAction?: (runId: string) => void;
  onRejectBrowserAction?: (runId: string) => void;
  /** Fired once when a finished run carries a canvas artifact (e.g. a fetched page). */
  onArtifact?: (artifact: RunArtifact) => void;
}

export function AgentRunLiveCard({
  data,
  token,
  onApproveBrowserAction,
  onRejectBrowserAction,
  onArtifact,
}: Props): React.ReactElement {
  const runId = data?.runId || data?.run?.runId || null;
  const isActive = ACTIVE_STATUSES.includes(data?.status || data?.run?.status || '');
  const { data: polledData } = useAgentRunPolling(isActive ? runId : null, token);
  const merged = polledData?.run ? { ...data, ...polledData.run, events: polledData.run.events || data.events } : data;

  const mergedEvents: any[] = Array.isArray(merged.events) ? merged.events : [];
  const deltaText = mergedEvents
    .filter((e: any) => e?.type === 'model.delta')
    .map((e: any) => (typeof e?.data?.text === 'string' ? e.data.text : ''))
    .join('');
  const displayData = {
    ...merged,
    reply: (typeof merged.reply === 'string' && merged.reply.length > 0) ? merged.reply : deltaText,
    events: mergedEvents.filter((e: any) => e?.type !== 'model.delta'),
  };

  // Route a finished run's canvas artifact to the host exactly once. Guarded on a
  // terminal status and a well-formed WebPreview so an in-flight or malformed run
  // never fires it.
  const artifactSent = useRef(false);
  const uiComponent = merged?.uiComponent as RunArtifact | undefined;
  const terminal = !ACTIVE_STATUSES.includes(merged?.status || '');
  useEffect(() => {
    if (artifactSent.current || !onArtifact) return;
    if (terminal && uiComponent && uiComponent.type === 'WebPreview' && (uiComponent.data as { url?: string } | undefined)?.url) {
      artifactSent.current = true;
      onArtifact(uiComponent);
    }
  }, [terminal, uiComponent, onArtifact]);

  return (
    <AgentRunCard
      result={displayData}
      onApprove={onApproveBrowserAction ? (rid: string, _approvalId: string) => onApproveBrowserAction(rid) : undefined}
      onCancel={onRejectBrowserAction ? (rid: string) => onRejectBrowserAction(rid) : undefined}
    />
  );
}
