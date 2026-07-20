// src/components/workbench/WorkbenchEmptyState.tsx
// Choosing a live application when none is open.
//
// Migrated to theme tokens in the Phase 3 pass. The copy also changed: "Select
// an approved local application from the registry to begin guided operations"
// described the mechanism rather than the choice. The heading now names what
// the person is picking.

import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { WorkbenchAppSelector } from './WorkbenchAppSelector';
import { ink, radius, surface } from '../../theme/tokens';

interface WorkbenchEmptyStateProps {
  onSelectApp: (appId: string) => void;
  onClose?: () => void;
}

export const WorkbenchEmptyState: React.FC<WorkbenchEmptyStateProps> = ({
  onSelectApp,
  onClose,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        p: 4,
        backgroundColor: surface.base,
        position: 'relative',
      }}
    >
      {onClose && (
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', top: 16, right: 16 }}
          aria-label="Close the live application workbench"
        >
          <CloseIcon />
        </IconButton>
      )}

      <Typography variant="h6" component="h2" sx={{ color: ink.primary, mb: 1, fontWeight: 600 }}>
        Which application?
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: ink.secondary, mb: 3, textAlign: 'center', maxWidth: 400 }}
      >
        PaneTera can open a registered local application here and observe it. It does not act
        inside the application.
      </Typography>

      <Box
        sx={{
          width: '100%',
          maxWidth: 400,
          backgroundColor: surface.raised,
          borderRadius: `${radius.md}px`,
          border: `1px solid ${surface.border}`,
        }}
      >
        <WorkbenchAppSelector onSelect={onSelectApp} />
      </Box>
    </Box>
  );
};
