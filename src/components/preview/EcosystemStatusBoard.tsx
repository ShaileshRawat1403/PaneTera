// src/components/preview/EcosystemStatusBoard.tsx
// Ecosystem status board component showing workspace status and live refresh indicator.

import React, { useState, useEffect } from 'react';
import { Box, Card, CardActionArea, CardContent, Grid, LinearProgress, Typography } from '@mui/material';
import { accent, ink, status, surface, typography } from '../../theme/cssTokens';

export interface WorkspaceStatus {
  name: string;
  status: 'clean' | 'changes' | 'unreachable';
  latestCommit: string;
}

interface Props {
  token?: string;
  onAction: (prompt: string) => void;
}

export const EcosystemStatusBoard: React.FC<Props> = ({ token, onAction }) => {
  const [workspaces, setWorkspaces] = useState<WorkspaceStatus[]>([
    { name: 'PaneTera', status: 'clean', latestCommit: 'dev (up to date)' },
    { name: 'FlowRight', status: 'changes', latestCommit: 'feat(flowright): add gateway adapter' },
    { name: 'Soothsayer', status: 'clean', latestCommit: 'main (synced)' },
  ]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/workspaces');
      if (!res.ok) return;
      const data = await res.json();
      const list: Array<{ name: string; path: string }> = data.workspaces || [];

      const results = await Promise.all(
        list.map(async (ws): Promise<WorkspaceStatus> => {
          try {
            const statusRes = await fetch(`/api/git-status?workspace=${encodeURIComponent(ws.name)}`);
            if (!statusRes.ok) return { name: ws.name, status: 'unreachable', latestCommit: 'status unavailable' };
            const statusData = await statusRes.json();
            return {
              name: ws.name,
              status: statusData.hasChanges ? 'changes' : 'clean',
              latestCommit: statusData.branch ? `${statusData.branch} (${statusData.summary || 'synced'})` : 'clean',
            };
          } catch {
            return { name: ws.name, status: 'unreachable', latestCommit: 'status unavailable' };
          }
        })
      );
      setWorkspaces(results);
    } catch {
      // /api/workspaces unreachable — leave prior state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const statusColor = (s: WorkspaceStatus['status']) =>
    s === 'clean' ? status.neutral : s === 'changes' ? status.brass : ink.muted;
  const statusLabel = (s: WorkspaceStatus['status']) =>
    s === 'clean' ? 'Up to date' : s === 'changes' ? 'Uncommitted changes' : 'No signal';

  return (
    <Box sx={{ mb: 2.5, p: 2, background: surface.sunken, border: `1px solid ${surface.border}`, borderRadius: '16px' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="caption" sx={{ color: accent.violet, fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.75rem' }}>
          PROJECT STATUS
        </Typography>
        <Typography variant="caption" sx={{ color: ink.muted, fontSize: '0.75rem' }}>
          Refreshes every 15s
        </Typography>
      </Box>

      {loading ? (
        <LinearProgress sx={{ my: 1 }} />
      ) : (
        <Grid container spacing={1.5}>
          {workspaces.map((ws) => (
            <Grid item xs={12} sm={6} key={ws.name}>
              <Card
                onClick={() => onAction(`git status in ${ws.name}`)}
                sx={{
                  background: surface.sunken,
                  border: `1px solid ${surface.border}`,
                  borderRadius: '12px',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  '&:hover': {
                    borderColor: accent.violetBorder,
                    boxShadow: `0 4px 20px ${accent.violetMuted}`,
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                <CardActionArea>
                  <CardContent sx={{ p: 1.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColor(ws.status) }} />
                        <Typography variant="body2" sx={{ fontWeight: 700, color: ink.primary }}>
                          {ws.name}
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: statusColor(ws.status), fontSize: '0.75rem', fontWeight: 600 }}>
                        {statusLabel(ws.status)}
                      </Typography>
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: ink.secondary,
                        fontSize: '0.75rem',
                        display: 'block',
                        fontFamily: typography.mono,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ws.latestCommit}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}

          {/* Dax signal placeholder */}
          <Grid item xs={12} sm={6}>
            <Card
              variant="outlined"
              sx={{ background: 'transparent', border: `1px dashed ${surface.borderStrong}`, borderRadius: '12px', boxShadow: 'none' }}
            >
              <CardContent sx={{ p: 1.75 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', border: `1px solid ${ink.muted}` }} />
                  <Typography variant="body2" sx={{ fontWeight: 700, color: ink.secondary }}>
                    dax
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: ink.muted, fontSize: '0.75rem' }}>
                  Not connected yet — governance events land here in a later phase.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};
