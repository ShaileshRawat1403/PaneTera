// src/components/ui/ModernInput.tsx
//
// Modern input component with glass effect and polish.

import React from 'react';
import { Box, BoxProps, Typography } from '@mui/material';

interface ModernInputProps extends Omit<BoxProps, 'onChange'> {
  /** Input value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Input label */
  label?: string;
  /** Helper text */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Enable glass effect */
  glass?: boolean;
  /** Multiline input */
  multiline?: boolean;
  /** Number of rows for multiline */
  rows?: number;
  /** Focus handler */
  onFocus?: () => void;
  /** Blur handler */
  onBlur?: () => void;
}

export const ModernInput: React.FC<ModernInputProps> = ({
  value,
  onChange,
  placeholder,
  label,
  helperText,
  error,
  disabled = false,
  glass = false,
  multiline = false,
  rows = 1,
  onFocus,
  onBlur,
  sx,
  ...props
}) => {
  return (
    <Box sx={{ width: '100%', ...sx }}>
      {label && (
        <Typography
          variant="caption"
          sx={{
            color: 'var(--panetera-ink-secondary, #BDB4A8)',
            mb: 0.5,
            display: 'block',
            fontWeight: 500,
          }}
        >
          {label}
        </Typography>
      )}
      <Box
        component={multiline ? 'textarea' : 'input'}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        disabled={disabled}
        rows={multiline ? rows : undefined}
        onFocus={onFocus}
        onBlur={onBlur}
        sx={{
          width: '100%',
          padding: '12px 16px',
          background: glass
            ? 'rgba(28, 26, 24, 0.6)'
            : 'var(--panetera-surface-sunken, #0C0B0A)',
          border: '1px solid',
          borderColor: error
            ? 'rgba(255, 107, 107, 0.5)'
            : 'var(--panetera-surface-border, #332E28)',
          borderRadius: '12px',
          color: 'var(--panetera-ink-primary, #F5F0E8)',
          fontSize: '14px',
          fontFamily: 'inherit',
          outline: 'none',
          transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
          resize: multiline ? 'vertical' : 'none',
          backdropFilter: glass ? 'blur(12px)' : undefined,
          WebkitBackdropFilter: glass ? 'blur(12px)' : undefined,
          '&:focus': {
            borderColor: error
              ? 'rgba(255, 107, 107, 0.7)'
              : 'rgba(167, 139, 250, 0.5)',
            boxShadow: error
              ? '0 0 0 3px rgba(255, 107, 107, 0.1)'
              : '0 0 0 3px rgba(167, 139, 250, 0.1)',
          },
          '&:disabled': {
            opacity: 0.5,
            cursor: 'not-allowed',
          },
          '&::placeholder': {
            color: 'var(--panetera-ink-muted, #8E857A)',
          },
        }}
        {...props}
      />
      {(helperText || error) && (
        <Typography
          variant="caption"
          sx={{
            color: error
              ? 'rgba(255, 107, 107, 0.9)'
              : 'var(--panetera-ink-muted, #8E857A)',
            mt: 0.5,
            display: 'block',
          }}
        >
          {error || helperText}
        </Typography>
      )}
    </Box>
  );
};
