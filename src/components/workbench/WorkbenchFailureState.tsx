import React from 'react';
import { Box, Typography, Button, IconButton } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CloseIcon from '@mui/icons-material/Close';

interface WorkbenchFailureStateProps {
  status: string; // 'framing-likely-blocked', 'invalid-configuration', 'unavailable', 'checking'
  onRetry: () => void;
  onClear: () => void;
  onClose?: () => void;
}

export const WorkbenchFailureState: React.FC<WorkbenchFailureStateProps> = ({ status, onRetry, onClear, onClose }) => {
  let title = 'Application Unavailable';
  let message = 'The selected local application is not responding.';
  let Icon = ErrorOutlineIcon;
  let color = '#f87171'; // red

  if (status === 'checking') {
    title = 'Checking app availability';
    message = 'Verifying local app loopback status.';
    color = '#cbd5e1';
  } else if (status === 'framing-likely-blocked') {
    title = 'App may block embedding';
    message = 'The application exposes headers (CSP frame-ancestors or X-Frame-Options) that prevent it from being rendered securely inside the workbench iframe. You may need to adjust the app configuration.';
    Icon = WarningAmberIcon;
    color = '#fbbf24'; // amber
  } else if (status === 'invalid-configuration') {
    title = 'App configuration is invalid';
    message = 'The application definition in the registry is malformed or violates the strict loopback security policy. External remote origins are not permitted.';
  } else if (status === 'unavailable') {
    title = 'App is unavailable';
    message = 'The selected local application is not responding.';
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      height: '100%',
      p: 4,
      bgcolor: '#09090b',
      textAlign: 'center',
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
      {status !== 'checking' && <Icon sx={{ fontSize: 64, color, mb: 2 }} />}
      <Typography variant="h6" sx={{ color: '#f4f4f5', mb: 1, fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: '#a1a1aa', mb: 4, maxWidth: 500 }}>
        {message}
      </Typography>

      {status !== 'checking' && (
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" onClick={onRetry} sx={{ color: '#cbd5e1', borderColor: 'rgba(255,255,255,0.2)' }}>
            Retry Connection
          </Button>
          <Button variant="text" onClick={onClear} sx={{ color: '#a1a1aa' }}>
            Choose Another App
          </Button>
        </Box>
      )}
    </Box>
  );
};
