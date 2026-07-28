// src/components/ui/ModernBadge.tsx
//
// Modern badge component with variants and status indicators.

import React from 'react';
import { Box, BoxProps } from '@mui/material';

interface ModernBadgeProps extends BoxProps {
  /** Badge variant */
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'accent';
  /** Badge size */
  size?: 'sm' | 'md' | 'lg';
  /** Show dot indicator */
  dot?: boolean;
  /** Pulse animation for active states */
  pulse?: boolean;
  /** Badge content */
  children: React.ReactNode;
}

const variantStyles = {
  default: {
    background: 'rgba(142, 133, 122, 0.15)',
    color: '#BDB4A8',
    dotColor: '#8E857A',
  },
  success: {
    background: 'rgba(107, 203, 119, 0.15)',
    color: '#6BCB77',
    dotColor: '#6BCB77',
  },
  warning: {
    background: 'rgba(224, 160, 80, 0.15)',
    color: '#E0A050',
    dotColor: '#E0A050',
  },
  error: {
    background: 'rgba(255, 107, 107, 0.15)',
    color: '#FF6B6B',
    dotColor: '#FF6B6B',
  },
  info: {
    background: 'rgba(78, 205, 196, 0.15)',
    color: '#4ECDC4',
    dotColor: '#4ECDC4',
  },
  accent: {
    background: 'rgba(167, 139, 250, 0.15)',
    color: '#A78BFA',
    dotColor: '#A78BFA',
  },
};

const sizeStyles = {
  sm: {
    padding: '2px 8px',
    fontSize: '11px',
    dotSize: 6,
  },
  md: {
    padding: '4px 10px',
    fontSize: '12px',
    dotSize: 8,
  },
  lg: {
    padding: '6px 14px',
    fontSize: '13px',
    dotSize: 10,
  },
};

export const ModernBadge: React.FC<ModernBadgeProps> = ({
  variant = 'default',
  size = 'md',
  dot = false,
  pulse = false,
  children,
  sx,
  ...props
}) => {
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: dot ? '6px' : 0,
        padding: sizeStyle.padding,
        borderRadius: '999px',
        background: variantStyle.background,
        color: variantStyle.color,
        fontSize: sizeStyle.fontSize,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        ...sx,
      }}
      {...props}
    >
      {dot && (
        <Box
          sx={{
            width: sizeStyle.dotSize,
            height: sizeStyle.dotSize,
            borderRadius: '50%',
            background: variantStyle.dotColor,
            boxShadow: `0 0 8px ${variantStyle.dotColor}`,
            animation: pulse ? 'badge-pulse 2s ease-in-out infinite' : 'none',
            '@keyframes badge-pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.5 },
            },
          }}
        />
      )}
      {children}
    </Box>
  );
};

// Status badge for common states
interface StatusBadgeProps {
  status: 'idle' | 'active' | 'success' | 'warning' | 'error';
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const variantMap = {
    idle: 'default' as const,
    active: 'accent' as const,
    success: 'success' as const,
    warning: 'warning' as const,
    error: 'error' as const,
  };

  const labelMap = {
    idle: 'Idle',
    active: 'Active',
    success: 'Success',
    warning: 'Warning',
    error: 'Error',
  };

  return (
    <ModernBadge
      variant={variantMap[status]}
      dot
      pulse={status === 'active'}
    >
      {label || labelMap[status]}
    </ModernBadge>
  );
};
