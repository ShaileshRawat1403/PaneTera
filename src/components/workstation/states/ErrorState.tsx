import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { ink, status, radius } from '../../../theme/cssTokens';
import { transition } from '../../../theme/motion';

interface ErrorStateProps {
  title: string;
  message: string;
  retry?: () => void;
}

export default function ErrorState({ title, message, retry }: ErrorStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        p: 4,
        textAlign: 'center',
      }}
    >
      <Typography sx={{ fontSize: '48px', mb: 2 }}>⚠️</Typography>
      <Typography
        variant="h6"
        sx={{
          color: status.danger,
          fontWeight: 600,
          mb: 1,
        }}
      >
        {title}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: ink.muted,
          maxWidth: '400px',
          lineHeight: 1.6,
        }}
      >
        {message}
      </Typography>
      {retry && (
        <Button
          onClick={retry}
          sx={{
            mt: 3,
            px: 4,
            py: 1,
            backgroundColor: status.danger,
            color: ink.onAccent,
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: `${radius.sm}px`,
            transition: transition(['background-color']),
            '&:hover': {
              backgroundColor: status.dangerMuted,
            },
          }}
        >
          Retry
        </Button>
      )}
    </Box>
  );
}
