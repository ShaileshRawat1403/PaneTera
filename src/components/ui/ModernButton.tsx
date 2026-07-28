// src/components/ui/ModernButton.tsx
//
// Modern button component with variants and polish.

import React from 'react';
import { Button, ButtonProps, CircularProgress } from '@mui/material';

interface ModernButtonProps extends Omit<ButtonProps, 'variant'> {
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Show loading spinner */
  loading?: boolean;
  /** Enable glow effect */
  glow?: boolean;
  /** Icon to display before label */
  startIcon?: React.ReactNode;
  /** Icon to display after label */
  endIcon?: React.ReactNode;
}

export const ModernButton: React.FC<ModernButtonProps> = ({
  variant = 'primary',
  loading = false,
  glow = false,
  children,
  disabled,
  sx,
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          background: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)',
          color: '#FFFFFF',
          '&:hover': {
            background: 'linear-gradient(135deg, #B79BFC 0%, #9D74F7 100%)',
            boxShadow: glow
              ? '0 4px 20px rgba(167, 139, 250, 0.4)'
              : '0 4px 12px rgba(167, 139, 250, 0.3)',
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        };
      case 'secondary':
        return {
          background: 'rgba(42, 39, 34, 0.8)',
          color: 'var(--panetera-ink-primary, #F5F0E8)',
          border: '1px solid var(--panetera-surface-border, #332E28)',
          '&:hover': {
            background: 'rgba(51, 46, 40, 0.9)',
            borderColor: 'var(--panetera-surface-border-strong, #4A433C)',
          },
        };
      case 'ghost':
        return {
          background: 'transparent',
          color: 'var(--panetera-ink-secondary, #BDB4A8)',
          '&:hover': {
            background: 'rgba(142, 133, 122, 0.1)',
            color: 'var(--panetera-ink-primary, #F5F0E8)',
          },
        };
      case 'danger':
        return {
          background: 'linear-gradient(135deg, #FF6B6B 0%, #EE5A5A 100%)',
          color: '#FFFFFF',
          '&:hover': {
            background: 'linear-gradient(135deg, #FF7E7E 0%, #FF6B6B 100%)',
            boxShadow: '0 4px 12px rgba(255, 107, 107, 0.3)',
          },
        };
      default:
        return {};
    }
  };

  return (
    <Button
      disabled={disabled || loading}
      sx={{
        borderRadius: '12px',
        fontWeight: 600,
        fontSize: '14px',
        textTransform: 'none',
        padding: '10px 20px',
        transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
        ...getVariantStyles(),
        '&.Mui-disabled': {
          opacity: 0.5,
          background: 'var(--panetera-surface-overlay, #2A2722)',
          color: 'var(--panetera-ink-disabled, #6B6359)',
        },
        ...sx,
      }}
      {...props}
    >
      {loading && (
        <CircularProgress
          size={16}
          sx={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            marginLeft: '-8px',
            marginTop: '-8px',
            color: 'inherit',
          }}
        />
      )}
      <span style={{ opacity: loading ? 0 : 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
        {children}
      </span>
    </Button>
  );
};
