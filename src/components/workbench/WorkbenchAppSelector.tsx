import React, { useEffect, useState } from 'react';
import { Box, Button, Typography, Stack, CircularProgress } from '@mui/material';
import { LocalAppDefinitionClient } from './LiveWorkbenchSurface';
import { accent, ink } from '../../theme/cssTokens';

interface WorkbenchAppSelectorProps {
  onSelect: (appId: string) => void;
}

export const WorkbenchAppSelector: React.FC<WorkbenchAppSelectorProps> = ({ onSelect }) => {
  const [apps, setApps] = useState<LocalAppDefinitionClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/workbench/apps')
      .then(res => res.json())
      .then(data => {
        if (data.apps) {
          setApps(data.apps);
        }
      })
      .catch(err => console.error('Failed to load local apps:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={24} sx={{ color: accent.violet }} />
      </Box>
    );
  }

  if (apps.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No active applications found in the local registry.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      {apps.map(app => (
        <Button
          key={app.appId}
          variant="outlined"
          onClick={() => onSelect(app.appId)}
          sx={{
            justifyContent: 'flex-start',
            textAlign: 'left',
            color: ink.secondary,
            borderColor: 'rgba(255,255,255,0.1)',
            textTransform: 'none',
            '&:hover': {
              borderColor: accent.violet,
              backgroundColor: 'rgba(127, 85, 240, 0.05)'
            }
          }}
        >
          <Box>
            <Typography variant="subtitle2">{app.name}</Typography>
            {app.description && (
              <Typography variant="caption" color="text.secondary" display="block">
                {app.description}
              </Typography>
            )}
            <Typography variant="caption" sx={{ color: accent.violet }}>
              {app.url}
            </Typography>
          </Box>
        </Button>
      ))}
    </Stack>
  );
};
