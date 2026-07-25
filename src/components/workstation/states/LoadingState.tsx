import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { ink, accent } from '../../../theme/cssTokens';

interface LoadingStateProps {
  message?: string;
}

export default function LoadingState({ message }: LoadingStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        p: 4,
      }}
    >
      <CircularProgress
        size={32}
        sx={{
          color: accent.violet,
        }}
      />
      {message && (
        <Typography
          variant="body2"
          sx={{
            color: ink.muted,
            mt: 2,
          }}
        >
          {message}
        </Typography>
      )}
    </Box>
  );
}
