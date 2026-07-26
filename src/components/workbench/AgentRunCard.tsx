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

function EventTimeline({ events }: { events: AgentEvent[] }) {
  const [expanded, setExpanded] = useState(false);
  const visibleEvents = expanded ? events : events.slice(-6);

  if (events.length === 0) return null;

  return (
    <Box sx={{ mt: 1.5 }}>
      <Button
        size="small"
        onClick={() => setExpanded(!expanded)}
        sx={{
          textTransform: 'none',
          color: ink.muted,
          fontSize: '0.6875rem',
          p: 0,
          minWidth: 0,
          '&:hover': { color: ink.secondary, backgroundColor: 'transparent' },
        }}
      >
        {expanded ? 'Show less' : `Show ${events.length} events`}
      </Button>
      <Stack spacing={0.5} sx={{ mt: 0.5 }}>
        {visibleEvents.map((event) => (
          <Box
            key={event.eventId}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
              py: 0.5,
              px: 1,
              borderRadius: `${radius.sm}px`,
              '&:hover': { backgroundColor: surface.sunken },
            }}
          >
            <EventIcon type={event.type} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" sx={{ color: ink.secondary, fontSize: '0.6875rem', lineHeight: 1.4 }}>
                {event.summary}
              </Typography>
            </Box>
            <Typography
              variant="caption"
              sx={{ color: ink.muted, fontFamily: typography.mono, fontSize: '0.625rem', flexShrink: 0 }}
            >
              {formatTime(event.timestamp)}
            </Typography>
          </Box>
        ))}
      </Stack>
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
  return <Box sx={{ display: 'flex', mt: 0.125 }}>{iconMap[type] || <Box sx={{ width: 14, height: 14 }} />}</Box>;
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

      {/* Objective */}
      <Typography variant="body2" sx={{ color: ink.primary, fontWeight: 600, mb: 1, fontSize: '0.875rem' }}>
        {result.reply || 'Working on your request...'}
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
