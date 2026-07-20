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
import { Box, Typography, Button, TextField, CircularProgress, Divider, Collapse } from '@mui/material';
import { accent, ink, radius, status, surface, typography } from '../theme/tokens';
import { transition } from '../theme/motion';

export interface ContentWorkflowRun {
  runId: string;
  workflowId: string;
  status: string;
  currentStepId?: string;
  siteGoal?: string;
  targetPages?: string;
  // The actual draft_post artifact content, read back from flowright's own
  // artifact store. Undefined means flowright hasn't produced one yet —
  // never fabricate placeholder text here.
  draftContent?: string;
}

interface Props {
  run: ContentWorkflowRun;
  evidence?: any;
  onReview: (action: 'approve' | 'reject' | 'request_revision', notes: string) => void;
  busy?: boolean;
}

export function workflowStatusColour(runStatus: string): string {
  if (runStatus === 'completed') return status.success;
  if (runStatus === 'rejected') return status.danger;
  if (runStatus === 'awaiting_review') return status.brass;
  return accent.violet;
}

export function workflowStatusLabel(runStatus: string): string {
  if (runStatus === 'completed') return 'Run completed';
  if (runStatus === 'rejected') return 'Run rejected';
  if (runStatus === 'awaiting_review') return 'Waiting for your review';
  if (runStatus === 'running') return 'Run in progress';
  if (runStatus === 'draft') return 'Draft prepared';
  return 'Run status unavailable';
}

export const ContentWorkflowCard: React.FC<Props> = ({ run, evidence, onReview, busy }) => {
  const [notes, setNotes] = useState('');
  const [showDraft, setShowDraft] = useState(false);

  const statusColor = workflowStatusColour(run.status);
  const statusLabel = workflowStatusLabel(run.status);

  return (
    <Box
      sx={{
        backgroundColor: surface.raised,
        border: `1px solid ${surface.border}`,
        borderLeft: `3px solid ${statusColor}`,
        borderRadius: `${radius.lg}px`,
        p: 2,
        transition: transition(['border-color', 'background-color']),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="caption" sx={{ color: statusColor, fontWeight: 700, letterSpacing: '0.06em' }}>
          {statusLabel}
        </Typography>
        {(run.status === 'draft' || run.status === 'running') && (
          <CircularProgress size={12} sx={{ color: statusColor }} />
        )}
      </Box>

      <Typography variant="body2" sx={{ color: ink.primary, mb: 0.5, lineHeight: 1.4 }}>
        {run.siteGoal || 'Website content update'}
      </Typography>
      {run.targetPages && (
        <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mb: 1 }}>
          Pages: {run.targetPages}
        </Typography>
      )}
      <Typography variant="caption" sx={{ color: ink.muted, fontFamily: typography.mono, display: 'block', mb: 1.5 }}>
        flowright run {run.runId.slice(0, 8)} · {run.workflowId}
      </Typography>

      {run.draftContent && (
        <Box sx={{ mb: 1.5 }}>
          <Button
            size="small"
            onClick={() => setShowDraft(v => !v)}
            sx={{ textTransform: 'none', color: accent.violet, fontSize: '0.75rem', p: 0, minWidth: 0, '&:hover': { backgroundColor: 'transparent', textDecoration: 'underline' } }}
          >
            {showDraft ? 'Hide draft ▲' : 'View draft ▼'}
          </Button>
          <Collapse in={showDraft}>
            <Box
              sx={{
                mt: 1,
                p: 1.5,
                backgroundColor: surface.sunken,
                borderRadius: `${radius.sm}px`,
                maxHeight: 320,
                overflowY: 'auto'
              }}
            >
              <Typography
                variant="caption"
                component="pre"
                sx={{
                  color: ink.primary,
                  whiteSpace: 'pre-wrap',
                  fontFamily: typography.mono,
                  fontSize: '0.72rem',
                  lineHeight: 1.5,
                  m: 0
                }}
              >
                {run.draftContent}
              </Typography>
            </Box>
          </Collapse>
        </Box>
      )}
      {!run.draftContent && run.status === 'awaiting_review' && (
        <Typography variant="caption" sx={{ color: ink.muted, fontStyle: 'italic', display: 'block', mb: 1.5 }}>
          Draft content isn't available from flowright yet — approving without reading it isn't recommended.
        </Typography>
      )}

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
              '& .MuiOutlinedInput-root': { fontSize: '0.85rem', backgroundColor: surface.sunken }
            }}
          />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="contained"
              disabled={busy}
              onClick={() => onReview('approve', notes)}
              sx={{
                backgroundColor: accent.violet, textTransform: 'none', fontWeight: 650, borderRadius: `${radius.sm}px`,
                '&:hover': { backgroundColor: accent.violetHover }
              }}
            >
              Approve
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={busy}
              onClick={() => onReview('request_revision', notes)}
              sx={{ color: status.brass, borderColor: status.brass, textTransform: 'none', borderRadius: `${radius.sm}px` }}
            >
              Request revision
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={busy}
              onClick={() => onReview('reject', notes)}
              sx={{ color: status.danger, borderColor: status.danger, textTransform: 'none', borderRadius: `${radius.sm}px` }}
            >
              Reject
            </Button>
          </Box>
        </Box>
      )}

      {run.status === 'completed' && (
        <Box sx={{ mt: 1 }}>
          <Divider sx={{ my: 1, borderColor: surface.border }} />
          <Typography variant="caption" sx={{ color: status.success, fontWeight: 650, display: 'block', mb: 0.5 }}>
            Evidence from Flowright
          </Typography>
          {evidence ? (
            <>
              <Typography variant="caption" sx={{ color: ink.secondary, display: 'block' }}>
                Ledger verified: {String(Boolean(evidence.ledger?.verified))} · {evidence.ledger?.eventCount ?? 0} events
              </Typography>
              <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mb: 1 }}>
                Steps: {evidence.steps?.filter((s: any) => s.status === 'success').length ?? 0}/{evidence.steps?.length ?? 0} succeeded
              </Typography>
            </>
          ) : (
            <Typography variant="caption" sx={{ color: ink.muted, display: 'block', mb: 1 }}>
              Loading evidence...
            </Typography>
          )}
          <Typography variant="caption" sx={{ color: ink.muted, fontStyle: 'italic', display: 'block' }}>
            Flowright prepared and exported this packet. Publishing it live to the actual site is a separate, manual step, not something this portal or flowright does automatically.
          </Typography>
        </Box>
      )}

      {run.status === 'rejected' && (
        <Typography role="alert" variant="body2" sx={{ color: status.danger, fontWeight: 600 }}>
          Rejected — nothing was exported.
        </Typography>
      )}
    </Box>
  );
};
