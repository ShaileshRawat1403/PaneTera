// src/components/ui/ModernCard.tsx
//
// Modern glassmorphic card component with depth and polish.

import React from 'react';
import { Box, BoxProps } from '@mui/material';

interface ModernCardProps extends BoxProps {
  /** Enable glassmorphism effect */
  glass?: boolean;
  /** Enable hover lift effect */
  hoverable?: boolean;
  /** Enable glow border on hover */
  glow?: boolean;
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Border radius */
  rounded?: 'sm' | 'md' | 'lg' | 'xl';
}

const paddingMap = {
  none: 0,
  sm: 1,
  md: 2,
  lg: 3,
};

const radiusMap = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
};

export const ModernCard: React.FC<ModernCardProps> = ({
  glass = false,
  hoverable = false,
  glow = false,
  padding = 'md',
  rounded = 'lg',
  children,
  sx,
  ...props
}) => {
  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: radiusMap[rounded],
        p: paddingMap[padding],
        background: glass
          ? 'rgba(28, 26, 24, 0.7)'
          : 'var(--panetera-surface-raised, #1C1A18)',
        border: '1px solid',
        borderColor: glow
          ? 'rgba(167, 139, 250, 0.3)'
          : 'var(--panetera-surface-border, #332E28)',
        boxShadow: 'var(--panetera-elevation-card, 0 2px 4px rgba(0,0,0,0.3))',
        backdropFilter: glass ? 'blur(24px) saturate(180%)' : undefined,
        WebkitBackdropFilter: glass ? 'blur(24px) saturate(180%)' : undefined,
        transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        ...(hoverable && {
          '&:hover': {
            background: glass
              ? 'rgba(35, 32, 25, 0.8)'
              : 'var(--panetera-surface-raised-hover, #232019)',
            borderColor: glow
              ? 'rgba(167, 139, 250, 0.5)'
              : 'var(--panetera-surface-border-strong, #4A433C)',
            boxShadow: glow
              ? '0 8px 24px rgba(0,0,0,0.5), 0 0 30px rgba(167,139,250,0.1)'
              : '0 8px 24px rgba(0,0,0,0.5)',
            transform: 'translateY(-2px)',
          },
        }),
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
};
