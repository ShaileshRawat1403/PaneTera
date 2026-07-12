// src/components/workbench/ReadOnlyStatusBanner.tsx
import React from 'react';
import { Box, Typography, Chip, Stack } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import WifiIcon from '@mui/icons-material/Wifi';
import PolicyIcon from '@mui/icons-material/Policy';

interface BannerProps {
  gatewayConnected: boolean;
  activeWorkspaceName: string | null;
  policyActive: boolean;
}

export const ReadOnlyStatusBanner: React.FC<BannerProps> = ({
  gatewayConnected,
  activeWorkspaceName,
  policyActive
}) => {
  return (
    <Box
      sx={{
        width: '100%',
        background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.12) 0%, rgba(127, 85, 240, 0.12) 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(8px)',
        py: 1,
        px: { xs: 2, md: 3 },
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        zIndex: 10
      }}
    >
      {/* Sandbox warning text */}
      <Stack direction="row" spacing={1} alignItems="center">
        <LockIcon sx={{ color: '#ef4444', fontSize: 14 }} />
        <Typography
          variant="caption"
          sx={{
            fontWeight: 850,
            color: '#f4f4f5',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontSize: '0.68rem',
            textShadow: '0 0 10px rgba(239,68,68,0.4)'
          }}
        >
          Governed Read-Only Sandbox Mode
        </Typography>
      </Stack>

      {/* Connection and parameter states */}
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap' }}>
        <Chip
          icon={<WifiIcon style={{ fontSize: 10, color: gatewayConnected ? '#22c55e' : '#ef4444' }} />}
          label={gatewayConnected ? 'GATEWAY: ONLINE' : 'GATEWAY: OFFLINE'}
          size="small"
          sx={{
            height: 18,
            fontSize: '0.55rem',
            fontWeight: 800,
            background: 'rgba(255,255,255,0.03)',
            color: gatewayConnected ? '#22c55e' : '#ef4444',
            border: '1px solid rgba(255,255,255,0.05)'
          }}
        />

        <Chip
          icon={<PolicyIcon style={{ fontSize: 10, color: '#38bdf8' }} />}
          label={policyActive ? 'HOST POLICY: ACTIVE' : 'HOST POLICY: INACTIVE'}
          size="small"
          sx={{
            height: 18,
            fontSize: '0.55rem',
            fontWeight: 800,
            background: 'rgba(56, 189, 248, 0.05)',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.15)'
          }}
        />

        {activeWorkspaceName ? (
          <Chip
            label={`ACTIVE WS: ${activeWorkspaceName.toUpperCase()}`}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.55rem',
              fontWeight: 800,
              background: 'rgba(127, 85, 240, 0.08)',
              color: '#b794f4',
              border: '1px solid rgba(127, 85, 240, 0.2)'
            }}
          />
        ) : (
          <Chip
            label="WS: NONE SELECTED"
            size="small"
            sx={{
              height: 18,
              fontSize: '0.55rem',
              fontWeight: 800,
              background: 'rgba(255,255,255,0.02)',
              color: '#71717a'
            }}
          />
        )}

        <Stack direction="row" spacing={0.5}>
          <Chip
            label="WRITES OFF"
            size="small"
            sx={{ height: 16, fontSize: '0.5rem', fontWeight: 900, background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444' }}
          />
          <Chip
            label="SHELL OFF"
            size="small"
            sx={{ height: 16, fontSize: '0.5rem', fontWeight: 900, background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444' }}
          />
        </Stack>
      </Stack>
    </Box>
  );
};
