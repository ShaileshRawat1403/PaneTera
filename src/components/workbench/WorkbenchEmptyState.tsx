import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { WorkbenchAppSelector } from './WorkbenchAppSelector';

interface WorkbenchEmptyStateProps {
  onSelectApp: (appId: string) => void;
  onClose?: () => void;
}

export const WorkbenchEmptyState: React.FC<WorkbenchEmptyStateProps> = ({ onSelectApp, onClose }) => {
  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      height: '100%',
      p: 4,
      bgcolor: '#09090b',
      position: 'relative'
    }}>
      {onClose && (
        <IconButton 
          onClick={onClose} 
          sx={{ position: 'absolute', top: 16, right: 16, color: '#a1a1aa' }}
          aria-label="Close Local App Workbench"
        >
          <CloseIcon />
        </IconButton>
      )}
      <Typography variant="h5" sx={{ color: '#f4f4f5', mb: 2, fontWeight: 600 }}>
        Local App Workbench
      </Typography>
      <Typography variant="body1" sx={{ color: '#a1a1aa', mb: 4, textAlign: 'center', maxWidth: 400 }}>
        Select an approved local application from the registry to begin guided operations.
      </Typography>
      <Box sx={{ width: '100%', maxWidth: 400, bgcolor: '#18181b', borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
        <WorkbenchAppSelector onSelect={onSelectApp} />
      </Box>
    </Box>
  );
};
