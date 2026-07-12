// src/components/nativeWorkbench/WorkspacesCatalog.tsx
import React from 'react';
import { Box, Typography, Paper, Grid, Chip, List, ListItem, ListItemText, Divider } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OfflineBoltIcon from '@mui/icons-material/OfflineBolt';

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
        background: 'rgba(20, 20, 25, 0.7)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#f4f4f5', mb: 0.5 }}>
        Workspaces Catalog Status
      </Typography>
      <Typography variant="caption" sx={{ color: '#71717a', display: 'block', mb: 3.5 }}>
        Local catalog of all manually registered or auto-discovered workspaces.
      </Typography>

      <Grid container spacing={2.5}>
        {workspaces.map((ws) => (
          <Grid item xs={12} sm={6} key={ws.id}>
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                background: ws.enabled ? 'rgba(127, 85, 240, 0.03)' : 'rgba(255,255,255,0.005)',
                borderColor: ws.enabled ? 'rgba(127, 85, 240, 0.2)' : 'rgba(255,255,255,0.04)',
                borderRadius: '8px',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: ws.enabled ? 'rgba(127, 85, 240, 0.35)' : 'rgba(255,255,255,0.08)'
                }
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FolderIcon sx={{ color: ws.enabled ? '#7f5af0' : '#71717a', fontSize: 18 }} />
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#f4f4f5' }}>
                    {ws.name}
                  </Typography>
                </Box>
                <Chip
                  label={ws.enabled ? 'Enabled' : 'Disabled'}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    background: ws.enabled ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                    color: ws.enabled ? '#22c55e' : '#a1a1aa'
                  }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ color: '#71717a', display: 'block', mb: 0.5 }}>PATH</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#cbd5e1', wordBreak: 'break-all' }}>
                  {ws.path}
                </Typography>
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)', my: 1.5 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#71717a' }}>TYPE: {ws.type.toUpperCase()}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {ws.enabled ? (
                    <>
                      <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 13 }} />
                      <Typography variant="caption" sx={{ color: '#22c55e', fontWeight: 600 }}>ONLINE</Typography>
                    </>
                  ) : (
                    <>
                      <OfflineBoltIcon sx={{ color: '#71717a', fontSize: 13 }} />
                      <Typography variant="caption" sx={{ color: '#71717a' }}>OFFLINE</Typography>
                    </>
                  )}
                </Box>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
};
