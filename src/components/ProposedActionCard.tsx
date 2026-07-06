// src/components/ProposedActionCard.tsx
//
// The one shared implementation of the approval-gate card.
// Matches the app's glass/purple-accent visual language.
import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Chip } from '@mui/material';

interface ProposedActionCardProps {
  workspaceName: string;
  command: string;
  reason?: string;
  onApprove: () => void;
  onCancel: () => void;
  /** 'chat' gets a little outer margin to sit inside a message bubble; 'panel' fills its feed card as-is. */
  variant?: 'panel' | 'chat';

  // Enhanced metadata fields from server allowlist
  riskLevel?: 'safe' | 'review' | 'dangerous';
  executionMode?: 'local-shell' | 'apple-container' | 'dax' | 'dry-run';
  isDryRun?: boolean;
  allowed?: boolean;
  description?: string;
}

export const ProposedActionCard: React.FC<ProposedActionCardProps> = ({
  workspaceName,
  command,
  reason,
  onApprove,
  onCancel,
  variant = 'panel',
  riskLevel = 'safe',
  executionMode = 'local-shell',
  isDryRun = true,
  allowed = true,
  description
}) => {
  // Brief, undoable window between the click and the real command firing
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      onApprove();
      return;
    }
    const t = setTimeout(() => setCountdown(c => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onApprove]);

  const outerSx = variant === 'chat' ? { mt: 2, mb: 1 } : {};

  // 1. COUNTDOWN STATE
  if (countdown !== null) {
    return (
      <Box
        sx={{
          ...outerSx,
          background: 'rgba(34, 197, 94, 0.06)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '14px',
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
          <Typography variant="body2" sx={{ color: '#22c55e', fontWeight: 600 }}>
            {isDryRun ? 'Simulating' : 'Starting'} in {countdown}...
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setCountdown(null)}
          sx={{
            color: '#a1a1aa',
            borderColor: 'rgba(255,255,255,0.15)',
            borderRadius: '8px',
            textTransform: 'none',
            transition: 'all 0.2s ease',
            '&:hover': { borderColor: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)' }
          }}
        >
          Undo
        </Button>
      </Box>
    );
  }

  // 2. BLOCKED COMMAND STATE
  if (allowed === false) {
    return (
      <Box
        sx={{
          ...outerSx,
          background: 'rgba(239, 68, 68, 0.04)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '14px',
          p: 2,
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 700, letterSpacing: '0.06em', display: 'block', mb: 1 }}>
          PROPOSAL BLOCKED
        </Typography>
        <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 1, lineHeight: 1.5 }}>
          Command{' '}
          <Box component="span" sx={{ fontFamily: 'monospace', color: '#f87171', fontWeight: 700 }}>
            {command}
          </Box>{' '}
          is blocked by the portal execution safety policies.
        </Typography>
        <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 2 }}>
          Reason: This command is not present in the pre-approved execution allowlist.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="contained"
            disabled
            sx={{
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 700
            }}
          >
            Blocked
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={onCancel}
            sx={{
              color: '#a1a1aa',
              borderColor: 'rgba(255,255,255,0.15)',
              borderRadius: '8px',
              textTransform: 'none',
              '&:hover': { borderColor: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)' }
            }}
          >
            Dismiss
          </Button>
        </Box>
      </Box>
    );
  }

  // Determine colors based on risk level
  const getRiskColors = (level: typeof riskLevel) => {
    switch (level) {
      case 'safe':
        return { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.2)' };
      case 'review':
        return { color: '#eab308', bg: 'rgba(234, 179, 8, 0.08)', border: 'rgba(234, 179, 8, 0.2)' };
      case 'dangerous':
      default:
        return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)' };
    }
  };

  const riskColors = getRiskColors(riskLevel);

  // 3. STANDARD WAITING FOR APPROVAL STATE
  return (
    <Box
      className="pulse-glow"
      sx={{
        ...outerSx,
        background: 'rgba(245, 158, 11, 0.03)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        borderRadius: '14px',
        p: 2,
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 700, letterSpacing: '0.06em' }}>
          PROPOSED ACTION
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {isDryRun && (
            <Chip
              label="DRY RUN"
              size="small"
              sx={{
                height: 18,
                fontSize: '0.6rem',
                fontWeight: 700,
                background: 'rgba(127, 85, 240, 0.12)',
                color: '#d8b4fe',
                border: '1px solid rgba(127, 85, 240, 0.25)'
              }}
            />
          )}
          <Chip
            label={`${executionMode}`}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.6rem',
              fontWeight: 700,
              background: 'rgba(255, 255, 255, 0.04)',
              color: '#e4e4e7',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          />
          <Chip
            label={riskLevel.toUpperCase()}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.6rem',
              fontWeight: 700,
              background: riskColors.bg,
              color: riskColors.color,
              border: `1px solid ${riskColors.border}`
            }}
          />
        </Box>
      </Box>

      <Typography variant="body2" sx={{ color: '#f4f4f5', mb: 0.5, lineHeight: 1.5 }}>
        Run{' '}
        <Box component="span" sx={{ fontFamily: 'monospace', color: '#fbbf24', fontWeight: 700 }}>
          {command}
        </Box>{' '}
        in <Box component="span" sx={{ fontWeight: 700 }}>{workspaceName}</Box>
      </Typography>

      {description && (
        <Typography variant="caption" sx={{ color: '#cbd5e1', display: 'block', mb: 0.5, fontStyle: 'italic' }}>
          {description}
        </Typography>
      )}

      {reason && (
        <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1.5 }}>
          {reason}
        </Typography>
      )}

      {isDryRun && (
        <Typography variant="caption" sx={{ color: '#a78bfa', display: 'block', mt: 1, mb: 1.5, fontSize: '0.7rem' }}>
          Dry-run mode: this will simulate the execution and show preview logs.
        </Typography>
      )}

      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
        <Button
          size="small"
          variant="contained"
          onClick={() => setCountdown(2)}
          sx={{
            background: '#22c55e',
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 700,
            boxShadow: '0 2px 12px rgba(34, 197, 94, 0.25)',
            transition: 'all 0.2s ease',
            '&:hover': { background: '#16a34a', boxShadow: '0 4px 16px rgba(34, 197, 94, 0.35)', transform: 'translateY(-1px)' }
          }}
        >
          {isDryRun ? 'Preview dry run' : 'Approve & Run'}
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={onCancel}
          sx={{
            color: '#ef4444',
            borderColor: 'rgba(239,68,68,0.35)',
            borderRadius: '8px',
            textTransform: 'none',
            transition: 'all 0.2s ease',
            '&:hover': { borderColor: 'rgba(239,68,68,0.6)', background: 'rgba(239,68,68,0.06)' }
          }}
        >
          Reject
        </Button>
      </Box>
    </Box>
  );
};
