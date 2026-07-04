// src/components/ContentWorkflowCard.tsx
//
// Renders a real flowright governed workflow run — a structurally different
// thing from a shell command ProposedAction. Flowright owns the review gate
// and evidence ledger for this; this card only reflects what flowright's own
// CLI reports back (draft -> running -> awaiting_review -> completed) and
// never fabricates progress, and never shows a "publish live" button that
// doesn't exist in the underlying system. Flowright's own design stops at
// export — going live is a separate, manual, human action outside this loop.
import React, { useState } from 'react';
import { Box, Typography, Button, TextField, CircularProgress, Divider } from '@mui/material';

export interface ContentWorkflowRun {
  runId: string;
  workflowId: string;
  status: string;
  currentStepId?: string;
  siteGoal?: string;
  targetPages?: string;
}

interface Props {
  run: ContentWorkflowRun;
  evidence?: any;
  onReview: (action: 'approve' | 'reject' | 'request_revision', notes: string) => void;
  busy?: boolean;
}

export const ContentWorkflowCard: React.FC<Props> = ({ run, evidence, onReview, busy }) => {
  const [notes, setNotes] = useState('');

  const statusColor =
    run.status === 'completed' ? '#22c55e'
    : run.status === 'rejected' ? '#ef4444'
    : run.status === 'awaiting_review' ? '#f59e0b'
    : '#7f5af0';

  return (
    <Box
      className={run.status === 'awaiting_review' ? 'pulse-glow' : undefined}
      sx={{
        background: 'rgba(127, 85, 240, 0.03)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${statusColor}33`,
        borderRadius: '14px',
        p: 2,
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="caption" sx={{ color: statusColor, fontWeight: 700, letterSpacing: '0.06em' }}>
          {run.status === 'awaiting_review' ? 'WAITING FOR YOUR REVIEW' : `GOVERNED RUN — ${run.status.toUpperCase()}`}
        </Typography>
        {(run.status === 'draft' || run.status === 'running') && (
          <CircularProgress size={12} sx={{ color: statusColor }} />
        )}
      </Box>

      <Typography variant="body2" sx={{ color: '#f4f4f5', mb: 0.5, lineHeight: 1.4 }}>
        {run.siteGoal || 'Website content update'}
      </Typography>
      {run.targetPages && (
        <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1 }}>
          Pages: {run.targetPages}
        </Typography>
      )}
      <Typography variant="caption" sx={{ color: '#71717a', fontFamily: 'monospace', display: 'block', mb: 1.5 }}>
        flowright run {run.runId.slice(0, 8)} · {run.workflowId}
      </Typography>

      {run.status === 'awaiting_review' && (
        <Box>
          <TextField
            fullWidth
            multiline
            minRows={2}
            placeholder="Review notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            size="small"
            sx={{
              mb: 1.5,
              '& .MuiOutlinedInput-root': { fontSize: '0.85rem', background: 'rgba(0,0,0,0.2)' }
            }}
          />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="contained"
              disabled={busy}
              onClick={() => onReview('approve', notes)}
              sx={{
                background: '#22c55e', textTransform: 'none', fontWeight: 700, borderRadius: '8px',
                boxShadow: '0 2px 12px rgba(34, 197, 94, 0.25)',
                '&:hover': { background: '#16a34a', boxShadow: '0 4px 16px rgba(34, 197, 94, 0.35)' }
              }}
            >
              Approve
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={busy}
              onClick={() => onReview('request_revision', notes)}
              sx={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.35)', textTransform: 'none', borderRadius: '8px' }}
            >
              Request revision
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={busy}
              onClick={() => onReview('reject', notes)}
              sx={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.35)', textTransform: 'none', borderRadius: '8px' }}
            >
              Reject
            </Button>
          </Box>
        </Box>
      )}

      {run.status === 'completed' && (
        <Box sx={{ mt: 1 }}>
          <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.06)' }} />
          <Typography variant="caption" sx={{ color: '#22c55e', fontWeight: 700, display: 'block', mb: 0.5 }}>
            EVIDENCE (from flowright's own ledger)
          </Typography>
          {evidence ? (
            <>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
                Ledger verified: {String(Boolean(evidence.ledger?.verified))} · {evidence.ledger?.eventCount ?? 0} events
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1 }}>
                Steps: {evidence.steps?.filter((s: any) => s.status === 'success').length ?? 0}/{evidence.steps?.length ?? 0} succeeded
              </Typography>
            </>
          ) : (
            <Typography variant="caption" sx={{ color: '#71717a', display: 'block', mb: 1 }}>
              Loading evidence...
            </Typography>
          )}
          <Typography variant="caption" sx={{ color: '#71717a', fontStyle: 'italic', display: 'block' }}>
            Flowright prepared and exported this packet. Publishing it live to the actual site is a separate, manual step, not something this portal or flowright does automatically.
          </Typography>
        </Box>
      )}

      {run.status === 'rejected' && (
        <Typography variant="body2" sx={{ color: '#ef4444', fontWeight: 600 }}>
          Rejected — nothing was exported.
        </Typography>
      )}
    </Box>
  );
};
