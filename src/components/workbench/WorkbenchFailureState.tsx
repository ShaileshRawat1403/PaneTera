// src/components/workbench/WorkbenchFailureState.tsx
// The failure state for a live application that will not load.
//
// Migrated to theme tokens in the Phase 3 pass. Beyond colour:
//
//   1. Messages are plain language. The old copy named CSP frame-ancestors,
//      X-Frame-Options, and a "strict loopback security policy" in the body
//      text shown to someone who just wanted their app to open. The precise
//      cause belongs in a disclosure, not the headline.
//   2. Failure is announced. A canvas that silently swaps to an error state is
//      invisible to a screen reader.
//   3. Brass for "needs attention", danger for "failed". Previously an
//      embedding refusal and an outright failure were the same red.

import React from 'react';
import { Box, Typography, Button, IconButton } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CloseIcon from '@mui/icons-material/Close';
import { ink, status as statusToken, surface } from '../../theme/tokens';

interface WorkbenchFailureStateProps {
  status: string; // 'framing-likely-blocked', 'invalid-configuration', 'unavailable', 'checking'
  onRetry: () => void;
  onClear: () => void;
  onClose?: () => void;
}

interface FailureCopy {
  title: string;
  message: string;
  detail?: string;
  Icon: typeof ErrorOutlineIcon;
  colour: string;
}

function describe(state: string): FailureCopy {
  switch (state) {
    case 'checking':
      return {
        title: 'Checking the application',
        message: 'Seeing whether it is reachable.',
        Icon: ErrorOutlineIcon,
        colour: ink.muted,
      };
    case 'framing-likely-blocked':
      return {
        title: 'This application refuses embedding',
        message: 'It can still be opened in a browser tab.',
        detail:
          'The application sends headers that prevent other pages from displaying it in a frame. That is a deliberate protection on its side rather than a fault in PaneTera.',
        Icon: WarningAmberIcon,
        colour: statusToken.brass,
      };
    case 'invalid-configuration':
      return {
        title: 'This application is not configured correctly',
        message: 'PaneTera cannot open it as registered.',
        detail:
          'Registered applications must point at a local address. Remote origins are refused, so a registration naming one cannot be opened.',
        Icon: ErrorOutlineIcon,
        colour: statusToken.brass,
      };
    default:
      return {
        title: 'This application is not responding',
        message: 'It may not be running.',
        Icon: ErrorOutlineIcon,
        colour: statusToken.danger,
      };
  }
}

export const WorkbenchFailureState: React.FC<WorkbenchFailureStateProps> = ({
  status,
  onRetry,
  onClear,
  onClose,
}) => {
  const { title, message, detail, Icon, colour } = describe(status);
  const checking = status === 'checking';

  return (
    <Box
      role={checking ? 'status' : 'alert'}
      aria-live="polite"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        p: 4,
        backgroundColor: surface.base,
        textAlign: 'center',
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

      {!checking && <Icon sx={{ fontSize: 40, color: colour, mb: 2 }} />}

      <Typography variant="h6" sx={{ color: ink.primary, mb: 1, fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: ink.secondary, mb: detail ? 1.5 : 4, maxWidth: 460 }}
      >
        {message}
      </Typography>

      {detail && (
        // The technical cause stays available without leading with it.
        <Box component="details" sx={{ mb: 4, maxWidth: 460 }}>
          <Box
            component="summary"
            sx={{ color: ink.secondary, fontSize: 12, cursor: 'pointer', userSelect: 'none' }}
          >
            Why
          </Box>
          <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mt: 1 }}>
            {detail}
          </Typography>
        </Box>
      )}

      {!checking && (
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={onRetry}
            sx={{ color: ink.primary, borderColor: surface.borderStrong }}
          >
            Try again
          </Button>
          <Button variant="text" onClick={onClear} sx={{ color: ink.secondary }}>
            Choose another application
          </Button>
        </Box>
      )}
    </Box>
  );
};
