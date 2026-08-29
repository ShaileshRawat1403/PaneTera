// src/components/workbench/ReadOnlyStatusBanner.tsx
import React from 'react';
import { Box, Typography, Chip, Stack } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { accent, ink, status, surface } from '../../theme/cssTokens';

interface BannerProps {
  gatewayConnected: boolean;
  activeWorkspaceName: string | null;
  policyActive: boolean;
  onOpenAuditLogs?: () => void;
  // Bounded statuses for PaneTera controlled testing
  portalAuthValid: boolean;
  workspaceCatalogCount: number;
  localAdapterActive: boolean;
  liveAppUrlReachable: boolean;
  liveAppManifestAvailable: boolean;
}

export const ReadOnlyStatusBanner: React.FC<BannerProps> = ({
  gatewayConnected,
  activeWorkspaceName,
  policyActive,
  onOpenAuditLogs,
  portalAuthValid,
  workspaceCatalogCount,
  localAdapterActive,
  liveAppUrlReachable,
  liveAppManifestAvailable
}) => {
  return (
    <Box
      sx={{
        width: '100%',
        // A flat token surface rather than a red-to-violet gradient built from
        // the old palette's raw rgba. The banner reports state; the gradient was
        // reporting drama, and its red half implied a failure that the row of
        // indicators below may well contradict.
        backgroundColor: surface.sunken,
        borderBottom: `1px solid ${surface.border}`,
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
        <LockIcon sx={{ color: status.danger, fontSize: 14 }} />
        <Typography
          variant="caption"
          sx={{
            fontWeight: 850,
            color: ink.primary,
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
      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
        {/* 1. Portal Auth */}
        <Chip
          label={portalAuthValid ? 'AUTH: VALID' : 'AUTH: MISSING'}
          size="small"
          sx={{
            height: 18,
            fontSize: '0.55rem',
            fontWeight: 800,
            background: portalAuthValid ? 'rgba(34, 197, 94, 0.06)' : 'rgba(239, 68, 68, 0.06)',
            color: portalAuthValid ? status.neutral : status.danger,
            border: `1px solid ${portalAuthValid ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`
          }}
        />

        {/* 2. Local Backend Gateway */}
        <Chip
          label={gatewayConnected ? 'GATEWAY: ONLINE' : 'GATEWAY: OFFLINE'}
          size="small"
          sx={{
            height: 18,
            fontSize: '0.55rem',
            fontWeight: 800,
            background: gatewayConnected ? 'rgba(34, 197, 94, 0.06)' : 'rgba(239, 68, 68, 0.06)',
            color: gatewayConnected ? status.neutral : status.danger,
            border: `1px solid ${gatewayConnected ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`
          }}
        />

        {/* 3. Workspace Catalog */}
        <Chip
          label={workspaceCatalogCount > 0 ? `CATALOG: ${workspaceCatalogCount} LOADED` : 'CATALOG: EMPTY'}
          size="small"
          sx={{
            height: 18,
            fontSize: '0.55rem',
            fontWeight: 800,
            background: workspaceCatalogCount > 0 ? 'rgba(127, 85, 240, 0.08)' : 'rgba(251, 191, 36, 0.06)',
            color: workspaceCatalogCount > 0 ? accent.violet : status.brass,
            border: `1px solid ${workspaceCatalogCount > 0 ? 'rgba(127,85,240,0.2)' : 'rgba(251,191,36,0.15)'}`
          }}
        />

        {/* 4. Local Workspace Adapter */}
        <Chip
          label={localAdapterActive ? 'ADAPTER: SANDBOXED' : 'ADAPTER: OFFLINE'}
          size="small"
          sx={{
            height: 18,
            fontSize: '0.55rem',
            fontWeight: 800,
            background: localAdapterActive ? 'rgba(127, 85, 240, 0.08)' : 'rgba(239, 68, 68, 0.06)',
            color: localAdapterActive ? accent.violet : status.danger,
            border: `1px solid ${localAdapterActive ? 'rgba(127,85,240,0.2)' : 'rgba(239,68,68,0.15)'}`
          }}
        />

        {/* 5. Live Deployed App URL */}
        <Chip
          label={liveAppUrlReachable ? 'LIVE URL: REACHABLE' : 'LIVE URL: UNREACHABLE'}
          size="small"
          sx={{
            height: 18,
            fontSize: '0.55rem',
            fontWeight: 800,
            background: liveAppUrlReachable ? 'rgba(34, 197, 94, 0.06)' : 'rgba(255, 255, 255, 0.03)',
            color: liveAppUrlReachable ? status.neutral : ink.disabled,
            border: `1px solid ${liveAppUrlReachable ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)'}`
          }}
        />

        {/* 6. Live App Manifest */}
        <Chip
          label={liveAppManifestAvailable ? 'MANIFEST: AVAILABLE' : 'MANIFEST: EXPERIMENTAL - MISSING'}
          size="small"
          sx={{
            height: 18,
            fontSize: '0.55rem',
            fontWeight: 800,
            background: liveAppManifestAvailable ? 'rgba(34, 197, 94, 0.06)' : 'rgba(251, 191, 36, 0.06)',
            color: liveAppManifestAvailable ? status.neutral : status.brass,
            border: `1px solid ${liveAppManifestAvailable ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.15)'}`
          }}
        />

        {activeWorkspaceName && (
          <Chip
            label={`ACTIVE WS: ${activeWorkspaceName.toUpperCase()}`}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.55rem',
              fontWeight: 800,
              background: 'rgba(127, 85, 240, 0.15)',
              color: accent.violet,
              border: '1px solid rgba(127, 85, 240, 0.3)'
            }}
          />
        )}

        {onOpenAuditLogs && (
          <Chip
            label="View Audit Logs"
            onClick={onOpenAuditLogs}
            size="small"
            clickable
            sx={{
              height: 18,
              fontSize: '0.55rem',
              fontWeight: 800,
              background: 'rgba(255, 255, 255, 0.05)',
              color: ink.secondary,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              '&:hover': { background: 'rgba(255, 255, 255, 0.1)' }
            }}
          />
        )}
      </Stack>
    </Box>
  );
};
