// src/components/nativeWorkbench/WorkspacesCatalog.tsx
import React from 'react';
import { Box, Typography, Paper, Grid, Chip } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OfflineBoltIcon from '@mui/icons-material/OfflineBolt';
import { accent, ink, status, surface } from '../../theme/cssTokens';

interface Workspace {
  id: string;
  name: string;
  path: string;
  type: string;
  enabled: boolean;
  status: 'online' | 'offline';
}

interface CatalogProps {
  data: {
    workspaces: Workspace[];
  };
}

export const WorkspacesCatalog: React.FC<CatalogProps> = ({ data }) => {
  const workspaces = data?.workspaces || [];

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        backgroundColor: surface.raised,
        borderColor: surface.border,
        borderRadius: '12px',
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: ink.primary, mb: 0.5 }}>
        Workspaces Catalog Status
      </Typography>
      <Typography variant="caption" sx={{ color: ink.muted, display: 'block', mb: 3.5 }}>
        Local catalog of all manually registered or auto-discovered workspaces.
      </Typography>

      <Grid container spacing={2.5}>
        {workspaces.map((ws) => (
          <Grid item xs={12} sm={6} key={ws.id}>
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                backgroundColor: ws.enabled ? accent.violetMuted : surface.sunken,
                borderColor: ws.enabled ? accent.violetBorder : surface.border,
                borderRadius: '8px',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: accent.violet,
                }
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FolderIcon sx={{ color: accent.violet, fontSize: 18 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: ink.primary }}>
                    {ws.name}
                  </Typography>
                </Box>
                <Chip
                  icon={ws.status === 'online' ? <CheckCircleIcon sx={{ fontSize: '12px !important' }} /> : <OfflineBoltIcon sx={{ fontSize: '12px !important' }} />}
                  label={ws.status.toUpperCase()}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.6rem',
                    fontWeight: 800,
                    backgroundColor: surface.sunken,
                    color: ws.status === 'online' ? status.neutral : ink.muted,
                  }}
                />
              </Box>

              <Typography variant="caption" sx={{ color: ink.secondary, fontFamily: 'monospace', display: 'block', mb: 1.5, fontSize: '0.72rem', wordBreak: 'break-all' }}>
                {ws.path}
              </Typography>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip
                  label={ws.type}
                  size="small"
                  sx={{ height: 16, fontSize: '0.55rem', backgroundColor: surface.raised, color: ink.secondary, fontWeight: 700 }}
                />
                <Chip
                  label={ws.enabled ? 'ACTIVE' : 'DISABLED'}
                  size="small"
                  sx={{
                    height: 16,
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    backgroundColor: ws.enabled ? accent.violetMuted : surface.raised,
                    color: ws.enabled ? accent.violet : ink.muted
                  }}
                />
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
};
