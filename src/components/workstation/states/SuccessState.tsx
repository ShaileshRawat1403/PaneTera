import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { ink, status, radius } from '../../../theme/cssTokens';
import { transition } from '../../../theme/motion';

interface SuccessStateProps {
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}

export default function SuccessState({ title, message, action }: SuccessStateProps) {
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
      <Typography sx={{ fontSize: '48px', mb: 2 }}>✓</Typography>
      <Typography
        variant="h6"
        sx={{
          color: status.success,
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
      {action && (
        <Button
          onClick={action.onClick}
          sx={{
            mt: 3,
            px: 4,
            py: 1,
            backgroundColor: status.success,
            color: ink.onAccent,
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: `${radius.sm}px`,
            transition: transition(['background-color']),
            '&:hover': {
              backgroundColor: status.successMuted,
            },
          }}
        >
          {action.label}
        </Button>
      )}
    </Box>
  );
}
