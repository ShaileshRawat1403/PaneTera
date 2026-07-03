// src/components/ProposedActionCard.tsx
//
// The one shared implementation of the approval-gate card — it used to be
// two near-identical copies (one in PreviewPanel's feed, one inline in
// chat) that had quietly drifted apart in styling. Single source of truth
// now, matching the app's glass/purple-accent visual language instead of
// the flatter ad-hoc version each copy had picked up on its own.
import React, { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';

interface ProposedActionCardProps {
  workspaceName: string;
  command: string;
  reason?: string;
  onApprove: () => void;
  onCancel: () => void;
  /** 'chat' gets a little outer margin to sit inside a message bubble; 'panel' fills its feed card as-is. */
  variant?: 'panel' | 'chat';
}

export const ProposedActionCard: React.FC<ProposedActionCardProps> = ({
  workspaceName,
  command,
  reason,
  onApprove,
  onCancel,
  variant = 'panel'
}) => {
  // Brief, undoable window between the click and the real command firing —
  // deliberate friction for someone clicking a real execute button for
  // possibly the first time, not an instant irreversible action.
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      onApprove();
      return;
    }
    const t = setTimeout(() => setCountdown(c => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  const outerSx = variant === 'chat' ? { mt: 2, mb: 1 } : {};

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
            Starting in {countdown}...
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

  return (
    <Box
      className="pulse-glow"
      sx={{
        ...outerSx,
        background: 'rgba(245, 158, 11, 0.045)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(245, 158, 11, 0.28)',
        borderRadius: '14px',
        p: 2,
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 700, letterSpacing: '0.06em', display: 'block', mb: 1 }}>
        WAITING FOR YOUR APPROVAL
      </Typography>
      <Typography variant="body2" sx={{ color: '#f4f4f5', mb: reason ? 0.5 : 1.5, lineHeight: 1.5 }}>
        Run{' '}
        <Box component="span" sx={{ fontFamily: 'monospace', color: '#fbbf24', fontWeight: 700 }}>
          {command}
        </Box>{' '}
        in <Box component="span" sx={{ fontWeight: 700 }}>{workspaceName}</Box>
      </Typography>
      {reason && (
        <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1.5 }}>
          {reason}
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
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
          Approve &amp; Run
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
          Cancel
        </Button>
      </Box>
    </Box>
  );
};
