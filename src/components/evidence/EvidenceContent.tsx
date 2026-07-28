// src/components/evidence/EvidenceContent.tsx
import React from 'react';
import { Box, Typography, Paper, Grid, Stack, Chip, CircularProgress } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { accent, ink, radius, status, surface, typography } from '../../theme/cssTokens';
import { BrowserEvidenceRecord } from './useEvidencePanel';

interface EvidenceContentProps {
  activeTabId: string;
  browserEvidence?: BrowserEvidenceRecord[];
  loading?: boolean;
}

export const EvidenceContent: React.FC<EvidenceContentProps> = ({ activeTabId, browserEvidence = [], loading = false }) => {
  if (activeTabId === 'logs') {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          backgroundColor: surface.sunken,
          borderColor: surface.border,
          borderRadius: `${radius.sm}px`,
          maxHeight: 180,
          overflowY: 'auto',
          fontFamily: typography.mono,
        }}
      >
        <Stack spacing={0.75}>
          {browserEvidence.length === 0 ? (
            <Typography variant="caption" sx={{ fontFamily: typography.mono, color: ink.muted, display: 'block', fontStyle: 'italic' }}>
              {loading ? 'Loading evidence…' : 'No browser observations recorded yet.'}
            </Typography>
          ) : (
            browserEvidence.slice(-8).map((obs, idx) => (
              <Typography key={obs.id ?? idx} variant="caption" sx={{ fontFamily: typography.mono, color: ink.secondary, display: 'block' }}>
                [{obs.timestamp ? new Date(obs.timestamp).toLocaleTimeString() : '—'}] OBSERVATION {obs.title ?? obs.id ?? 'untitled'}
                {obs.url ? ` — ${obs.url}` : ''}
              </Typography>
            ))
          )}
        </Stack>
      </Paper>
    );
  }

  if (activeTabId === 'metrics') {
    return (
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2, backgroundColor: surface.raised, borderColor: surface.border, borderRadius: `${radius.sm}px`, transition: 'border-color 150ms ease', '&:hover': { borderColor: surface.borderStrong } }}>
            <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>
              Total Observations
            </Typography>
            <Typography variant="h6" sx={{ color: status.neutral, fontWeight: 700, mt: 0.5 }}>
              {browserEvidence.length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2, backgroundColor: surface.raised, borderColor: surface.border, borderRadius: `${radius.sm}px`, transition: 'border-color 150ms ease', '&:hover': { borderColor: surface.borderStrong } }}>
            <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>
              Unique URLs
            </Typography>
            <Typography variant="h6" sx={{ color: accent.violet, fontWeight: 700, mt: 0.5 }}>
              {new Set(browserEvidence.map((e) => e.url).filter(Boolean)).size}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2, backgroundColor: surface.raised, borderColor: surface.border, borderRadius: `${radius.sm}px`, transition: 'border-color 150ms ease', '&:hover': { borderColor: surface.borderStrong } }}>
            <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>
              Latest Capture
            </Typography>
            <Typography variant="h6" sx={{ color: status.neutral, fontWeight: 700, mt: 0.5 }}>
              {browserEvidence.length > 0
                ? new Date(browserEvidence[browserEvidence.length - 1].timestamp ?? '').toLocaleTimeString()
                : '—'}
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    );
  }

  if (activeTabId === 'browser') {
    return (
      <Paper variant="outlined" sx={{ p: 2, backgroundColor: surface.sunken, borderColor: surface.border, borderRadius: `${radius.sm}px` }}>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CircularProgress size={14} sx={{ color: ink.secondary }} />
            <Typography variant="caption" sx={{ color: ink.secondary }}>Loading browser evidence…</Typography>
          </Box>
        ) : browserEvidence.length === 0 ? (
          <Typography variant="body2" sx={{ color: ink.secondary, fontStyle: 'italic' }}>
            No browser observations captured yet. Use a Chrome agent to post page outlines to /api/browser-observation.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {browserEvidence.slice(-5).reverse().map((obs, idx) => (
              <Box key={obs.id ?? idx} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
                <Box>
                  <Typography variant="body2" sx={{ color: ink.primary, fontWeight: 600 }}>
                    {obs.title ?? obs.id ?? 'Untitled observation'}
                  </Typography>
                  {obs.url && (
                    <Typography variant="caption" sx={{ color: ink.muted, fontFamily: typography.mono, display: 'block' }}>
                      {obs.url}
                    </Typography>
                  )}
                </Box>
                <Chip
                  icon={<OpenInNewIcon sx={{ fontSize: 11 }} />}
                  label={obs.timestamp ? new Date(obs.timestamp).toLocaleTimeString() : '—'}
                  size="small"
                  sx={{ height: 20, fontSize: '0.65rem', backgroundColor: surface.raised, color: ink.muted, border: `1px solid ${surface.border}` }}
                />
              </Box>
            ))}
          </Stack>
        )}
      </Paper>
    );
  }

  if (activeTabId === 'alerts') {
    return (
      <Paper variant="outlined" sx={{ p: 2, backgroundColor: surface.sunken, borderColor: surface.border, borderRadius: `${radius.sm}px` }}>
        <Typography variant="body2" sx={{ color: ink.secondary, fontStyle: 'italic' }}>
          No active security or SLA alerts recorded.
        </Typography>
      </Paper>
    );
  }

  return (
    <Typography variant="caption" sx={{ color: ink.muted, fontStyle: 'italic' }}>
      No evidence content selected.
    </Typography>
  );
};
