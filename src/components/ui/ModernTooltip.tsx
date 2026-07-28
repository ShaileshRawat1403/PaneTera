// src/components/ui/ModernTooltip.tsx
//
// Modern tooltip with glass effect and polish.

import React from 'react';
import { Box, Tooltip, TooltipProps, tooltipClasses } from '@mui/material';
import { styled } from '@mui/material/styles';

interface ModernTooltipProps extends Omit<TooltipProps, 'classes'> {
  /** Tooltip variant */
  variant?: 'default' | 'accent' | 'glass';
}

const StyledTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    background: 'rgba(42, 39, 34, 0.95)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(51, 46, 40, 0.8)',
    borderRadius: '10px',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: 500,
    lineHeight: 1.4,
    maxWidth: '300px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    color: '#F5F0E8',
  },
  [`& .${tooltipClasses.arrow}`]: {
    color: 'rgba(42, 39, 34, 0.95)',
  },
}));

export const ModernTooltip: React.FC<ModernTooltipProps> = ({
  variant = 'default',
  children,
  ...props
}) => {
  return (
    <StyledTooltip
      arrow
      enterDelay={300}
      leaveDelay={100}
      {...props}
    >
      {children}
    </StyledTooltip>
  );
};

// Shortcut tooltip for keyboard shortcuts
interface ShortcutTooltipProps {
  label: string;
  shortcut?: string;
  children: React.ReactElement;
}

export const ShortcutTooltip: React.FC<ShortcutTooltipProps> = ({
  label,
  shortcut,
  children,
}) => {
  return (
    <ModernTooltip
      title={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{label}</span>
          {shortcut && (
            <Box
              component="kbd"
              sx={{
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(167, 139, 250, 0.2)',
                border: '1px solid rgba(167, 139, 250, 0.3)',
                fontSize: '11px',
                fontFamily: 'monospace',
              }}
            >
              {shortcut}
            </Box>
          )}
        </Box>
      }
    >
      {children}
    </ModernTooltip>
  );
};
