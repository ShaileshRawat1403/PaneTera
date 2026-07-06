import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';

interface UnknownViewProps {
  viewId: string;
  type: string;
  label: string;
}

export const UnknownNativeView: React.FC<UnknownViewProps> = ({ viewId, type, label }) => {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        background: 'rgba(239, 68, 68, 0.02)',
        borderColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 1.5
      }}
    >
      <WarningIcon sx={{ color: '#ef4444', fontSize: 32 }} />
      <Box>
        <Typography variant="body2" sx={{ color: '#ef4444', fontWeight: 800 }}>
          Unsupported App-Native View Type
        </Typography>
        <Typography variant="caption" sx={{ color: '#a0aec0', display: 'block', mt: 0.5 }}>
          View ID: <strong>{viewId}</strong> | Type: <strong>{type}</strong> | Label: <strong>{label}</strong>
        </Typography>
        <Typography variant="caption" sx={{ color: '#71717a', display: 'block', mt: 1, fontWeight: 700 }}>
          No actions available. Unknown native views cannot execute operations or collect input.
        </Typography>
      </Box>
    </Paper>
  );
};
