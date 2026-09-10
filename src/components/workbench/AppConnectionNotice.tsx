// src/components/workbench/AppConnectionNotice.tsx
//
// Shown in place of an application canvas until PaneTera has observed the
// application. It reports the observed connection state and never
// substitutes sample content (ADR-004).

import React from 'react';
import { Box, Typography } from '@mui/material';
import { surface, ink, typography } from '../../theme/cssTokens';
import type { AppConnectionState } from '../../surfaces/appConnection';

export interface AppConnectionNoticeProps {
  appName: string;
  connection: AppConnectionState;
  connectionError?: string;
  /** How to start the application's PaneTera bridge. */
  setupHint: string;
}

const HEADLINES: Record<AppConnectionState, (appName: string) => string> = {
  unknown: (appName) => `${appName} connection state is unknown`,
  connecting: (appName) => `Checking for ${appName}…`,
  connected: (appName) => `${appName} is connected`,
  disconnected: (appName) => `${appName} is not connected`,
  error: (appName) => `${appName} could not be observed`,
};

export function AppConnectionNotice({
  appName,
  connection,
  connectionError,
  setupHint,
}: AppConnectionNoticeProps): React.ReactElement {
  return (
    <Box
      data-testid="app-connection-notice"
      data-connection={connection}
      role="status"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        height: '100%',
        minHeight: 0,
        p: 4,
        textAlign: 'center',
        backgroundColor: surface.canvas,
        color: ink.primary,
      }}
    >
      <Typography variant="body1" sx={{ fontWeight: 700 }}>
        {HEADLINES[connection](appName)}
      </Typography>
      {connectionError && (
        <Typography variant="caption" sx={{ color: ink.muted, fontFamily: typography.mono, maxWidth: 520 }}>
          {connectionError}
        </Typography>
      )}
      {connection !== 'connecting' && connection !== 'connected' && (
        <Typography variant="body2" sx={{ color: ink.secondary, maxWidth: 520 }}>
          {setupHint}
        </Typography>
      )}
    </Box>
  );
}
