import React from 'react';
import { Box, Typography, IconButton, Chip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import { LocalAppDefinitionClient } from './LiveWorkbenchSurface';

interface LiveWorkbenchToolbarProps {
  app: LocalAppDefinitionClient | null;
  status: string; // 'checking', 'reachable', 'framing-likely-blocked', 'invalid-configuration'
  onReload: () => void;
  onClose: () => void;
}

export const LiveWorkbenchToolbar: React.FC<LiveWorkbenchToolbarProps> = ({ app, status, onReload, onClose }) => {
  if (!app) return null;

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      p: 1.5,
      background: '#18181b',
      borderBottom: '1px solid rgba(255,255,255,0.08)'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#f4f4f5' }}>
          {app.name}
        </Typography>
        <Typography variant="caption" sx={{ color: '#a1a1aa', fontFamily: 'monospace' }}>
          {app.url}
        </Typography>
        <Chip 
          label={status} 
          size="small" 
          sx={{ 
            height: 20, 
            fontSize: '0.65rem', 
            background: status === 'reachable' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            color: status === 'reachable' ? '#4ade80' : '#fbbf24',
            border: '1px solid currentColor'
          }} 
        />
        <Chip 
          label="Guide Mode" 
          size="small" 
          sx={{ height: 20, fontSize: '0.65rem', background: 'rgba(127, 85, 240, 0.1)', color: '#b794f4' }} 
        />
      </Box>
      <Box>
        <IconButton size="small" onClick={onReload} sx={{ color: '#a1a1aa' }}>
          <RefreshIcon fontSize="small" />
        </IconButton>
        <IconButton 
          size="small" 
          onClick={() => window.open(app.url, '_blank', 'noopener,noreferrer')}
          sx={{ color: '#a1a1aa' }}
        >
          <OpenInNewIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={onClose} sx={{ color: '#a1a1aa', ml: 1 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
};
