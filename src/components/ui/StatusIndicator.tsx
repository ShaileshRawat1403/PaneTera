// src/components/ui/StatusIndicator.tsx
//
// Modern status indicator with animation and states.

import React from 'react';
import { Box, BoxProps, Typography } from '@mui/material';

interface StatusIndicatorProps extends BoxProps {
  /** Current status */
  status: 'idle' | 'active' | 'success' | 'warning' | 'error' | 'loading';
  /** Status label */
  label?: string;
  /** Show label */
  showLabel?: boolean;
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Show pulse animation */
  pulse?: boolean;
}

const statusColors = {
  idle: '#8E857A',
  active: '#A78BFA',
  success: '#6BCB77',
  warning: '#E0A050',
  error: '#FF6B6B',
  loading: '#A78BFA',
};

const statusLabels = {
  idle: 'Idle',
  active: 'Active',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
  loading: 'Loading',
};

const sizeConfig = {
  sm: { dot: 6, text: '11px' },
  md: { dot: 10, text: '12px' },
  lg: { dot: 14, text: '13px' },
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  showLabel = true,
  size = 'md',
  pulse = status === 'active' || status === 'loading',
  sx,
  ...props
}) => {
  const color = statusColors[status];
  const config = sizeConfig[size];

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        ...sx,
      }}
      {...props}
    >
      <Box
        sx={{
          position: 'relative',
          width: config.dot,
          height: config.dot,
        }}
      >
        {/* Main dot */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 12px ${color}`,
          }}
        />
        {/* Pulse ring */}
        {pulse && (
          <Box
            sx={{
              position: 'absolute',
              inset: -4,
              borderRadius: '50%',
              border: `2px solid ${color}`,
              opacity: 0,
              animation: 'status-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              '@keyframes status-pulse': {
                '0%': {
                  transform: 'scale(0.8)',
                  opacity: 0.8,
                },
                '100%': {
                  transform: 'scale(1.5)',
                  opacity: 0,
                },
              },
            }}
          />
        )}
        {/* Loading spinner */}
        {status === 'loading' && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: color,
              animation: 'status-spin 1s linear infinite',
              '@keyframes status-spin': {
                from: { transform: 'rotate(0deg)' },
                to: { transform: 'rotate(360deg)' },
              },
            }}
          />
        )}
      </Box>
      {showLabel && (
        <Typography
          sx={{
            fontSize: config.text,
            fontWeight: 500,
            color: color,
          }}
        >
          {label || statusLabels[status]}
        </Typography>
      )}
    </Box>
  );
};
