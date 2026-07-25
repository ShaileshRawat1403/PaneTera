import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { surface, ink, accent, radius, elevation } from '../../../theme/cssTokens';
import { transition } from '../../../theme/motion';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ title, description, icon, action }: EmptyStateProps) {
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
      {icon && (
        <Typography sx={{ fontSize: '48px', mb: 2 }}>{icon}</Typography>
      )}
      <Typography
        variant="h6"
        sx={{
          color: ink.primary,
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
        {description}
      </Typography>
      {action && (
        <Button
          onClick={action.onClick}
          sx={{
            mt: 3,
            px: 4,
            py: 1,
            backgroundColor: accent.violet,
            color: ink.onAccent,
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: `${radius.sm}px`,
            transition: transition(['background-color']),
            '&:hover': {
              backgroundColor: accent.violetHover,
            },
          }}
        >
          {action.label}
        </Button>
      )}
    </Box>
  );
}
