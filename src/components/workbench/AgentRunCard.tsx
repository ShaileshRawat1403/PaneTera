// src/components/workbench/AgentRunCard.tsx
//
// Renders an agent run: objective, status, event timeline, and result.
// Appears in the authoritative canvas when a governed run is initiated.

import React, { useState, useEffect } from 'react';
import { Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import BuildIcon from '@mui/icons-material/Build';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { accent, elevation, ink, radius, status, surface, typography } from '../../theme/cssTokens';
import { enterStyles, transition, duration, easing } from '../../theme/motion';

interface AgentEvent {
  eventId: string;
  runId: string;
  sequence: number;
  type: string;
  timestamp: string;
  summary: string;
  data?: Record<string, unknown>;
}

interface AgentRunResult {
  runId: string;
  status: string;
  reply: string;
  uiComponent?: unknown;
  provider: string;
  model: string;
  events: AgentEvent[];
  pendingApproval?: { kind?: string; approvalId?: string; capability?: string; summary?: string };
  readout?: { project?: string | null; headroom?: boolean; attachments?: number };
}

interface AgentRunCardProps {
  result: AgentRunResult;
  onCancel?: (runId: string) => void;
  onApprove?: (runId: string, approvalId: string) => void;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  completed: { icon: <CheckCircleIcon sx={{ fontSize: 18 }} />, color: status.success, label: 'Completed' },
  'waiting-approval': { icon: <HourglassEmptyIcon sx={{ fontSize: 18 }} />, color: status.brass, label: 'Awaiting approval' },
  running: { icon: <CircularProgress size={16} sx={{ color: accent.violet }} />, color: accent.violet, label: 'Running' },
  planning: { icon: <CircularProgress size={16} sx={{ color: ink.muted }} />, color: ink.muted, label: 'Planning' },
  failed: { icon: <ErrorIcon sx={{ fontSize: 18 }} />, color: status.danger, label: 'Failed' },
  canceled: { icon: <CancelIcon sx={{ fontSize: 18 }} />, color: ink.muted, label: 'Canceled' },
  queued: { icon: <HourglassEmptyIcon sx={{ fontSize: 18 }} />, color: ink.muted, label: 'Queued' },
};

// The Provenance Ledger: the run's governed steps as a connected vertical spine.
// Each node carries an icon (color-coded by kind), a mono timestamp, and its
// summary; the hairline spine threads them. Token deltas are streaming ephemera,
// never nodes, so they are filtered out.
function EventTimeline({ events }: { events: AgentEvent[] }) {
  const [expanded, setExpanded] = useState(false);
  const nodes = (events || []).filter((event) => event && event.type !== 'model.delta');
  if (nodes.length === 0) return null;
  const visible = expanded ? nodes : nodes.slice(-6);
  const hidden = nodes.length - visible.length;

  return (
    <Box sx={{ mt: 1.75 }}>
      <Typography sx={{ color: ink.muted, fontFamily: typography.mono, fontSize: '0.625rem', letterSpacing: '0.04em', mb: 1 }}>
        GOVERNED STEPS
      </Typography>
      {!expanded && hidden > 0 && (
        <Button
          size="small"
          onClick={() => setExpanded(true)}
          sx={{ textTransform: 'none', color: ink.muted, fontSize: '0.6875rem', p: 0, minWidth: 0, mb: 0.75, '&:hover': { color: ink.secondary, backgroundColor: 'transparent' } }}
        >
          {`Show ${hidden} earlier ${hidden === 1 ? 'step' : 'steps'}`}
        </Button>
      )}
      <Box>
        {visible.map((event, index) => {
          const isLast = index === visible.length - 1;
          return (
            <Box key={event.eventId} sx={{ display: 'flex', gap: 1.25 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 18, flexShrink: 0 }}>
                <Box sx={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: surface.canvas, border: `1px solid ${surface.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EventIcon type={event.type} />
                </Box>
                {!isLast && <Box sx={{ width: '1px', flex: 1, minHeight: 10, backgroundColor: surface.border, mt: 0.25 }} />}
              </Box>
              <Box sx={{ minWidth: 0, pb: isLast ? 0 : 1.25 }}>
                <Typography sx={{ color: ink.muted, fontFamily: typography.mono, fontSize: '0.625rem', lineHeight: 1.4 }}>
                  {formatTime(event.timestamp)}
                </Typography>
                <Typography sx={{ color: ink.secondary, fontSize: '0.75rem', lineHeight: 1.5 }}>
                  {event.summary}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
      {expanded && nodes.length > 6 && (
        <Button
          size="small"
          onClick={() => setExpanded(false)}
          sx={{ textTransform: 'none', color: ink.muted, fontSize: '0.6875rem', p: 0, minWidth: 0, mt: 0.5, '&:hover': { color: ink.secondary, backgroundColor: 'transparent' } }}
        >
          Show less
        </Button>
      )}
    </Box>
  );
}

function EventIcon({ type }: { type: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    'run.started': <PlayArrowIcon sx={{ fontSize: 14, color: accent.violet }} />,
    'model.started': <SmartToyIcon sx={{ fontSize: 14, color: accent.violet }} />,
    'model.completed': <SmartToyIcon sx={{ fontSize: 14, color: status.success }} />,
    'tool.started': <BuildIcon sx={{ fontSize: 14, color: status.brass }} />,
    'tool.completed': <BuildIcon sx={{ fontSize: 14, color: status.success }} />,
    'tool.failed': <ErrorIcon sx={{ fontSize: 14, color: status.danger }} />,
    'approval.required': <HourglassEmptyIcon sx={{ fontSize: 14, color: status.brass }} />,
    'run.completed': <CheckCircleIcon sx={{ fontSize: 14, color: status.success }} />,
    'run.failed': <ErrorIcon sx={{ fontSize: 14, color: status.danger }} />,
    'run.canceled': <CancelIcon sx={{ fontSize: 14, color: ink.muted }} />,
  };
  return <Box sx={{ display: 'flex' }}>{iconMap[type] || <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: ink.muted }} />}</Box>;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

export function AgentRunCard({ result, onCancel, onApprove }: AgentRunCardProps): React.ReactElement {
  const statusCfg = STATUS_CONFIG[result.status] || STATUS_CONFIG.queued;
  const isActive = result.status === 'running' || result.status === 'planning' || result.status === 'queued';
  const hasApproval = result.status === 'waiting-approval';
  const [copied, setCopied] = useState(false);

  // Run facts, derived from the governed events. Duration ticks live while active.
  const nodes = (result.events || []).filter((event) => event && event.type !== 'model.delta');
  const times = nodes.map((event) => Date.parse(event.timestamp)).filter((n) => !Number.isNaN(n));
  const startedAt = times.length ? Math.min(...times) : 0;
  const endedAt = isActive ? Date.now() : (times.length ? Math.max(...times) : 0);
  const durationMs = startedAt && endedAt ? Math.max(0, endedAt - startedAt) : 0;
  const durationLabel = durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`;
  const modelTurns = nodes.filter((event) => event.type === 'model.started').length;
  const toolCount = nodes.filter((event) => event.type === 'tool.completed').length;
  const showLedger = toolCount > 0 || hasApproval;

  // Token accounting, summed across the run's model turns. Present only when the
  // provider reported usage; a run with no usage simply omits the line.
  const usageTotals = nodes.reduce(
    (acc, event) => {
      const usage = event.data?.usage as { prompt?: number; completion?: number; total?: number } | undefined;
      if (usage) {
        acc.prompt += usage.prompt || 0;
        acc.completion += usage.completion || 0;
        acc.total += usage.total || 0;
        acc.seen = true;
      }
      return acc;
    },
    { prompt: 0, completion: 0, total: 0, seen: false },
  );

  const contextParts: string[] = [];
  if (result.readout) {
    contextParts.push(result.readout.project ? `Project: ${result.readout.project}` : 'No project attached');
    if (result.readout.headroom) contextParts.push('Headroom active');
    if (result.readout.attachments && result.readout.attachments > 0) {
      contextParts.push(`${result.readout.attachments} attachment${result.readout.attachments === 1 ? '' : 's'}`);
    }
  }

  const copyAnswer = () => {
    try {
      void navigator.clipboard.writeText(result.reply || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <Box
      sx={{
        p: 3,
        backgroundColor: surface.canvas,
        borderRadius: `${radius.lg}px`,
        border: `1px solid ${surface.border}`,
        maxWidth: 640,
        mx: 'auto',
        ...enterStyles(),
      }}
    >
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Chip
          icon={statusCfg.icon as React.ReactElement}
          label={statusCfg.label}
          size="small"
          sx={{
            height: 24,
            fontSize: '0.6875rem',
            fontWeight: 600,
            backgroundColor: `${statusCfg.color}18`,
            color: statusCfg.color,
            border: `1px solid ${statusCfg.color}`,
            '& .MuiChip-icon': { fontSize: 14 },
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
        <Typography variant="caption" sx={{ color: ink.muted, fontFamily: typography.mono, fontSize: '0.6875rem' }}>
          {result.provider}/{result.model}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {isActive && onCancel && (
          <Button
            size="small"
            startIcon={<StopIcon sx={{ fontSize: 14 }} />}
            onClick={() => onCancel(result.runId)}
            sx={{
              textTransform: 'none',
              color: status.danger,
              fontSize: '0.6875rem',
              minHeight: 28,
              '&:hover': { backgroundColor: status.dangerMuted },
            }}
          >
            Cancel
          </Button>
        )}
      </Stack>

      {/* Run readout: the receipt for how the answer was made — timing, grounding,
          and the context it worked from. Never the answer itself, so the two
          planes never duplicate. */}
      <Typography
        sx={{ color: ink.muted, fontFamily: typography.mono, fontSize: '0.6875rem', mb: 0.75 }}
        title={usageTotals.seen ? `${usageTotals.prompt.toLocaleString()} prompt · ${usageTotals.completion.toLocaleString()} completion` : undefined}
      >
        {durationLabel} · {nodes.length} {nodes.length === 1 ? 'step' : 'steps'}{modelTurns > 1 ? ` · ${modelTurns} model turns` : ''}{usageTotals.seen ? ` · ${usageTotals.total.toLocaleString()} tokens` : ''}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: contextParts.length ? 0.5 : 0 }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: toolCount > 0 ? status.neutral : ink.muted, flexShrink: 0 }} />
        <Typography sx={{ color: ink.secondary, fontSize: '0.75rem' }}>
          {toolCount > 0
            ? `Grounded in ${toolCount} tool ${toolCount === 1 ? 'result' : 'results'}`
            : 'Answered from model knowledge, no tools or files'}
        </Typography>
      </Stack>
      {contextParts.length > 0 && (
        <Typography sx={{ color: ink.muted, fontSize: '0.6875rem' }}>
          {contextParts.join(' · ')}
        </Typography>
      )}
      {result.reply && !isActive && (
        <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
          <Button
            size="small"
            onClick={copyAnswer}
            sx={{ textTransform: 'none', color: ink.secondary, fontSize: '0.6875rem', minHeight: 26, borderRadius: `${radius.sm}px`, border: `1px solid ${surface.border}`, px: 1, '&:hover': { backgroundColor: surface.sunken } }}
          >
            {copied ? 'Copied' : 'Copy answer'}
          </Button>
        </Stack>
      )}

      {/* Approval ceremony: the one place the run slows down on purpose. The
          exact proposed action and its risk are shown deliberately, with a
          brass gate, before anything can run. */}
      {hasApproval && (
        <Box sx={{ mt: 1, border: `1px solid ${surface.border}`, borderLeft: `3px solid ${status.brass}`, borderRadius: `0 ${radius.md}px ${radius.md}px 0`, backgroundColor: surface.raised, p: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
            <HourglassEmptyIcon sx={{ fontSize: 15, color: status.brass }} />
            <Typography sx={{ color: status.brass, fontSize: '0.75rem', fontWeight: 600 }}>Approval required</Typography>
          </Stack>
          {result.pendingApproval?.summary && (
            <Typography sx={{ color: ink.primary, fontFamily: typography.mono, fontSize: '0.75rem', lineHeight: 1.5, mb: 0.25 }}>
              {result.pendingApproval.summary}
            </Typography>
          )}
          <Typography sx={{ color: ink.secondary, fontSize: '0.6875rem', mb: 1.25 }}>
            {result.pendingApproval?.capability ? `${result.pendingApproval.capability} · ` : ''}risk: propose · nothing runs until you approve
          </Typography>
          <Stack direction="row" spacing={1}>
            {onApprove && (
              <Button
                variant="contained"
                size="small"
                startIcon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                onClick={() => onApprove(result.runId, result.pendingApproval?.approvalId || '')}
                sx={{ textTransform: 'none', backgroundColor: accent.violet, color: ink.onAccent, fontWeight: 600, fontSize: '0.8125rem', '&:hover': { backgroundColor: accent.violetHover } }}
              >
                Approve and run
              </Button>
            )}
            {onCancel && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => onCancel(result.runId)}
                sx={{ textTransform: 'none', borderColor: surface.borderStrong, color: ink.secondary, fontWeight: 600, fontSize: '0.8125rem' }}
              >
                Reject
              </Button>
            )}
          </Stack>
        </Box>
      )}

      {/* The ledger appears only when the turn did something governed worth
          inspecting — a tool call or an approval. A plain answer stays a clean
          readout with no boilerplate step list. */}
      {showLedger && <EventTimeline events={result.events} />}

      {/* ID footer */}
      <Typography
        variant="caption"
        sx={{ display: 'block', mt: 1.5, color: ink.muted, fontFamily: typography.mono, fontSize: '0.625rem' }}
      >
        Run {result.runId}
      </Typography>
    </Box>
  );
}
