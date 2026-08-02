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

      {/* This card is the run's events/steps panel. The answer itself streams in
          the conversation on the left, so we show a short status line here rather
          than repeating the reply. */}
      <Typography variant="body2" sx={{ color: ink.secondary, fontWeight: 600, mb: 1, fontSize: '0.8125rem' }}>
        {hasApproval ? 'Awaiting your approval — review the proposal in the conversation.' : isActive ? 'Working on your request…' : 'Run complete. See the answer in the conversation.'}
      </Typography>

      {/* Approval CTA */}
      {hasApproval && onApprove && (
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
            onClick={() => onApprove(result.runId, '')}
            sx={{
              textTransform: 'none',
              backgroundColor: accent.violet,
              color: ink.onAccent,
              fontWeight: 600,
              fontSize: '0.8125rem',
              '&:hover': { backgroundColor: accent.violetHover },
            }}
          >
            Review & Approve
          </Button>
          {onCancel && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => onCancel(result.runId)}
              sx={{
                textTransform: 'none',
                borderColor: surface.borderStrong,
                color: ink.secondary,
                fontWeight: 600,
                fontSize: '0.8125rem',
              }}
            >
              Reject
            </Button>
          )}
        </Stack>
      )}

      {/* Event Timeline */}
      <EventTimeline events={result.events} />

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
