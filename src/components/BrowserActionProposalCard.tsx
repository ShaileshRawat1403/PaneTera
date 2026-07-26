import React, { useRef, useState } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { accent, ink, radius, status, surface, typography } from '../theme/tokens';
import { singleFire } from './singleFire';

interface BrowserActionProposalCardProps {
  runId: string;
  action: {
    actionId: string;
    capability: string;
    status: string;
    riskLevel: string;
    expectedOutcome: string;
    expiresAt: string;
    previewStatus?: 'queued' | 'claimed' | 'previewed' | 'stale-target' | 'failed';
    previewResult?: {
      message?: string;
    };
    target: {
      expectedOrigin: string;
      role: string;
      accessibleName: string;
      elementFingerprint: string;
    };
  };
  latestEvent?: { type: string; summary: string };
  onApprove: (runId: string) => Promise<void> | void;
  onReject: (runId: string) => Promise<void> | void;
}

export const BrowserActionProposalCard: React.FC<BrowserActionProposalCardProps> = ({
  runId,
  action,
  latestEvent,
  onApprove,
  onReject,
}) => {
  const fired = useRef(false);
  const [decision, setDecision] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const target = action.target;
  const previewStatus = action.previewStatus || 'queued';
  const previewSucceeded = previewStatus === 'previewed';
  const previewFailed = previewStatus === 'stale-target' || previewStatus === 'failed';
  const previewMessage = previewSucceeded
    ? action.previewResult?.message || 'The exact target was highlighted in Chrome.'
    : previewFailed
      ? action.previewResult?.message || 'Chrome could not confirm the exact target.'
      : previewStatus === 'claimed'
        ? 'Chrome is validating and highlighting the exact target.'
        : 'Waiting for the paired Chrome extension to highlight the exact target.';

  const approve = () => singleFire(fired, () => {
    Promise.resolve(onApprove(runId))
      .then(() => setDecision('approved'))
      .catch(() => { fired.current = false; });
  });
  const reject = () => singleFire(fired, () => {
    Promise.resolve(onReject(runId))
      .then(() => setDecision('rejected'))
      .catch(() => { fired.current = false; });
  });

  return (
    <Box
      role={decision === 'pending' ? 'region' : 'status'}
      aria-label="Browser action approval"
      sx={{
        p: 2.5,
        borderRadius: `${radius.md}px`,
        border: `1px solid ${decision === 'rejected' ? status.danger : status.brass}`,
        backgroundColor: decision === 'rejected' ? status.dangerMuted : status.brassMuted,
      }}
    >
      <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ color: ink.primary, fontWeight: 700 }}>
          {decision === 'pending' ? 'Approve one Chrome click' : latestEvent?.summary || `Action ${decision}`}
        </Typography>
        <Chip
          size="small"
          label={action.riskLevel === 'interact' ? 'Browser interaction' : action.riskLevel}
          sx={{ color: status.brass, border: `1px solid ${status.brass}`, backgroundColor: 'transparent' }}
        />
      </Stack>

      <Typography variant="body2" sx={{ color: ink.primary, mb: 1 }}>
        Click the <strong>{target.role}</strong> named <strong>“{target.accessibleName}”</strong>.
      </Typography>
      <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mb: 0.5 }}>
        Expected: {action.expectedOutcome}
      </Typography>
      <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', fontFamily: typography.mono }}>
        {target.expectedOrigin}
      </Typography>
      <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', fontFamily: typography.mono }}>
        target {target.elementFingerprint}
      </Typography>
      <Typography
        id={`browser-preview-${action.actionId}`}
        role={previewFailed ? 'alert' : 'status'}
        variant="caption"
        sx={{
          color: previewSucceeded ? status.success : previewFailed ? status.danger : status.brass,
          display: 'block',
          mt: 1.5,
        }}
      >
        {previewMessage}
      </Typography>

      {decision === 'pending' && (
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button
            variant="contained"
            size="small"
            onClick={approve}
            disabled={!previewSucceeded}
            aria-describedby={`browser-preview-${action.actionId}`}
            sx={{ backgroundColor: accent.violet, color: ink.onAccent }}
          >
            Approve one click
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={reject}
            sx={{ borderColor: surface.borderStrong, color: ink.secondary }}
          >
            Reject
          </Button>
        </Stack>
      )}
    </Box>
  );
};
