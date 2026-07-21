// src/components/workstation/WorkstationShell.tsx
// The workstation frame: top bar, conversation plane, authoritative canvas, and
// the contextual surfaces that overlay them.
//
// Migrated to the theme tokens in the Phase 2 pass. Two substantive changes
// beyond colour, both from the locked contract:
//
//   1. A connected gateway now reads neutral rather than green. The contract
//      reserves green for meaningful success, and a healthy idle connection is
//      not a success, it is the absence of a problem. Green everywhere means
//      green nowhere.
//   2. The canvas backdrop grid and violet bloom are gone. The contract calls
//      the canvas the one authoritative surface; a decorative texture behind
//      real content competes with it for no informational gain.

import React, { useState } from 'react';
import { Box, Drawer, Typography, Divider, Tooltip, Popover, Button } from '@mui/material';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import HubIcon from '@mui/icons-material/Hub';
import LayersIcon from '@mui/icons-material/Layers';
import { accent, elevation, ink, radius, status, surface } from '../../theme/tokens';
import { transition } from '../../theme/motion';

export interface GovernanceSummary {
  gatewayConnected: boolean;
  activeWorkspaceName: string | null;
  policyActive: boolean;
  portalAuthValid: boolean;
  workspaceCatalogCount: number;
  localAdapterActive: boolean;
  liveAppUrlReachable: boolean;
  liveAppManifestAvailable: boolean;
  currentObjective?: string | null;
}

export interface WorkstationShellProps {
  conversation: React.ReactNode;
  canvas: React.ReactNode;
  renderActivity: (closeActivity: () => void) => React.ReactNode;
  renderWorkspaceSelector: (closeWorkspaceSelector: () => void) => React.ReactNode;
  renderRig: (closeRig: () => void) => React.ReactNode;
  renderHeadroom: (closeHeadroom: () => void) => React.ReactNode;
  rigRequestKey?: number;
  headroomRequestKey?: number;
  governanceStatus: GovernanceSummary;
  onOpenAudit: () => void;
}

/** Shared focus treatment. Visible focus is a contract requirement. */
const focusRing = {
  '&:focus-visible': {
    outline: 'none',
    boxShadow: elevation.focusRing,
    borderColor: accent.violetBorder,
  },
} as const;

const topBarButton = {
  color: ink.secondary,
  px: 1.25,
  borderRadius: `${radius.sm}px`,
  border: '1px solid transparent',
  transition: transition(['background-color', 'color', 'border-color']),
  '&:hover': { color: ink.primary, backgroundColor: surface.overlay },
  ...focusRing,
} as const;

export function WorkstationShell({
  conversation,
  canvas,
  renderActivity,
  renderWorkspaceSelector,
  renderRig,
  renderHeadroom,
  rigRequestKey = 0,
  headroomRequestKey = 0,
  governanceStatus,
  onOpenAudit,
}: WorkstationShellProps) {
  const [activityOpen, setActivityOpen] = useState(false);
  const [rigOpen, setRigOpen] = useState(false);
  const [headroomOpen, setHeadroomOpen] = useState(false);
  const [workspaceAnchorEl, setWorkspaceAnchorEl] = useState<null | HTMLElement>(null);

  React.useEffect(() => {
    if (rigRequestKey <= 0) return;
    setActivityOpen(false);
    setHeadroomOpen(false);
    setRigOpen(true);
  }, [rigRequestKey]);

  React.useEffect(() => {
    if (headroomRequestKey <= 0) return;
    setActivityOpen(false);
    setRigOpen(false);
    setHeadroomOpen(true);
  }, [headroomRequestKey]);

  const toggleActivity = () => {
    setRigOpen(false);
    setHeadroomOpen(false);
    setActivityOpen(current => !current);
  };
  const toggleRig = () => {
    setActivityOpen(false);
    setHeadroomOpen(false);
    setRigOpen(current => !current);
  };
  const toggleHeadroom = () => {
    setActivityOpen(false);
    setRigOpen(false);
    setHeadroomOpen(current => !current);
  };
  const openWorkspacePopover = (event: React.MouseEvent<HTMLElement>) => {
    setWorkspaceAnchorEl(event.currentTarget);
  };
  const closeWorkspacePopover = () => {
    setWorkspaceAnchorEl(null);
  };

  const { gatewayConnected } = governanceStatus;

  return (
    <Box
      data-theme="panetera"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: surface.base,
        color: ink.primary,
      }}
    >
      {/* 1. Governance top bar */}
      <Box
        component="header"
        sx={{
          height: 56,
          minHeight: 56,
          borderBottom: `1px solid ${surface.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 1.5, md: 2.5 },
          backgroundColor: surface.raised,
        }}
      >
        {/* Left: identity and project */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 }, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title={gatewayConnected ? 'Gateway connected' : 'Gateway unreachable'}>
              {/*
                Neutral when connected, not green. Healthy systems stay quiet;
                only a problem earns colour. The halo is also gone: a permanent
                glow is decoration that never stops asking for attention.
              */}
              <Box
                role="img"
                aria-label={gatewayConnected ? 'Gateway connected' : 'Gateway unreachable'}
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: gatewayConnected ? status.neutral : status.danger,
                  transition: transition(['background-color']),
                }}
              />
            </Tooltip>
            <Typography
              sx={{
                fontWeight: 650,
                color: ink.primary,
                letterSpacing: '-0.01em',
                fontSize: '0.9375rem',
              }}
            >
              PaneTera
            </Typography>
          </Box>

          <Divider
            orientation="vertical"
            variant="middle"
            flexItem
            sx={{ borderColor: surface.border, height: 16, my: 'auto' }}
          />

          <Tooltip title="Switch project">
            <Button
              onClick={openWorkspacePopover}
              aria-label="Switch project"
              aria-haspopup="true"
              aria-expanded={Boolean(workspaceAnchorEl)}
              sx={{
                ...topBarButton,
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                py: 0.625,
                minWidth: 0,
              }}
            >
              <AccountTreeIcon sx={{ fontSize: 16, color: ink.muted }} />
              <Typography
                variant="caption"
                noWrap
                sx={{ color: 'inherit', fontWeight: 600, maxWidth: { xs: 150, md: 280 } }}
              >
                {governanceStatus.activeWorkspaceName || 'Choose project'}
              </Typography>
            </Button>
          </Tooltip>
          {governanceStatus.currentObjective && (
            <Typography variant="caption" noWrap sx={{ color: ink.secondary, maxWidth: { xs: 120, md: 300 } }}>
              {governanceStatus.currentObjective}
            </Typography>
          )}
        </Box>

        {/* Right: contextual surfaces */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="Headroom context and memory">
            <Button
              size="small"
              startIcon={<LayersIcon sx={{ fontSize: 16 }} />}
              aria-label="Toggle Headroom drawer"
              aria-expanded={headroomOpen}
              aria-controls="headroom-drawer"
              onClick={toggleHeadroom}
              sx={{
                ...topBarButton,
                color: headroomOpen ? ink.primary : ink.secondary,
                backgroundColor: headroomOpen ? accent.violetMuted : 'transparent',
                borderColor: headroomOpen ? accent.violetBorder : 'transparent',
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>Headroom</Box>
            </Button>
          </Tooltip>

          <Tooltip title="Rig connections and capabilities">
            <Button
              size="small"
              startIcon={<HubIcon sx={{ fontSize: 16 }} />}
              aria-label="Toggle Rig drawer"
              aria-expanded={rigOpen}
              aria-controls="rig-drawer"
              onClick={toggleRig}
              sx={{
                ...topBarButton,
                color: rigOpen ? ink.primary : ink.secondary,
                backgroundColor: rigOpen ? accent.violetMuted : 'transparent',
                borderColor: rigOpen ? accent.violetBorder : 'transparent',
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>Rig</Box>
            </Button>
          </Tooltip>

          <Tooltip title="Audit log">
            <Button
              size="small"
              startIcon={<VerifiedUserIcon sx={{ fontSize: 16 }} />}
              aria-label="Open audit log"
              onClick={onOpenAudit}
              sx={topBarButton}
            >
              <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                Audit
              </Box>
            </Button>
          </Tooltip>

          <Tooltip title="Activity">
            <Button
              size="small"
              startIcon={<ViewSidebarIcon sx={{ fontSize: 16 }} />}
              aria-label="Toggle activity drawer"
              aria-expanded={activityOpen}
              aria-controls="activity-drawer"
              onClick={toggleActivity}
              sx={{
                ...topBarButton,
                color: activityOpen ? ink.primary : ink.secondary,
                backgroundColor: activityOpen ? accent.violetMuted : 'transparent',
                borderColor: activityOpen ? accent.violetBorder : 'transparent',
                '&:hover': {
                  color: ink.primary,
                  backgroundColor: activityOpen ? accent.violetHover : surface.overlay,
                },
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                Activity
              </Box>
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* 2. Two-plane layout: conversation and authoritative canvas */}
      <Box
        sx={{
          flexGrow: 1,
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(320px, 38vw) minmax(440px, 1fr)',
            md: 'clamp(340px, 28vw, 400px) minmax(0, 1fr)',
          },
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <Box
          component="aside"
          aria-label="PaneTera conversation"
          sx={{
            borderRight: `1px solid ${surface.border}`,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            backgroundColor: surface.raised,
          }}
        >
          {conversation}
        </Box>

        <Box
          component="main"
          aria-label="PaneTera main canvas"
          data-testid="workstation-canvas"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            position: 'relative',
            flexGrow: 1,
            // Deliberately flat. The canvas is the authoritative surface, so
            // whatever it holds should be the only thing competing for
            // attention. The former grid and violet bloom carried no
            // information.
            backgroundColor: surface.base,
          }}
        >
          {canvas}
        </Box>
      </Box>

      {/* 3. Contextual surfaces. Both overlay; neither resizes the canvas. */}
      <Popover
        open={Boolean(workspaceAnchorEl)}
        anchorEl={workspaceAnchorEl}
        onClose={closeWorkspacePopover}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              width: 'min(380px, calc(100vw - 24px))',
              maxHeight: 'min(680px, calc(100vh - 84px))',
              backgroundColor: surface.overlay,
              border: `1px solid ${surface.border}`,
              borderRadius: `${radius.md}px`,
              boxShadow: elevation.overlay,
              color: ink.primary,
            },
          },
        }}
      >
        <Box sx={{ p: 2 }}>{renderWorkspaceSelector(closeWorkspacePopover)}</Box>
      </Popover>

      <Drawer
        id="activity-drawer"
        anchor="right"
        open={activityOpen}
        onClose={toggleActivity}
        variant="temporary"
        // Drawer in MUI v5 exposes the paper slot as PaperProps rather than
        // slotProps.paper, unlike Popover above.
        PaperProps={{
          role: 'region',
          'aria-label': 'Activity drawer',
          sx: {
            width: 'min(420px, 92vw)',
            backgroundColor: surface.raised,
            borderLeft: `1px solid ${surface.border}`,
            boxShadow: elevation.overlay,
            color: ink.primary,
            p: 0,
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 0 }}>
            {renderActivity(() => setActivityOpen(false))}
          </Box>
        </Box>
      </Drawer>

      <Drawer
        id="rig-drawer"
        anchor="right"
        open={rigOpen}
        onClose={toggleRig}
        variant="temporary"
        PaperProps={{
          role: 'region',
          'aria-label': 'Rig drawer',
          sx: {
            width: 'min(620px, 96vw)',
            backgroundColor: surface.raised,
            borderLeft: `1px solid ${surface.border}`,
            boxShadow: elevation.overlay,
            color: ink.primary,
          },
        }}
      >
        {renderRig(() => setRigOpen(false))}
      </Drawer>

      <Drawer
        id="headroom-drawer"
        anchor="right"
        open={headroomOpen}
        onClose={toggleHeadroom}
        variant="temporary"
        PaperProps={{
          role: 'region',
          'aria-label': 'Headroom drawer',
          sx: {
            width: 'min(560px, 96vw)',
            backgroundColor: surface.raised,
            borderLeft: `1px solid ${surface.border}`,
            boxShadow: elevation.overlay,
            color: ink.primary,
          },
        }}
      >
        {renderHeadroom(() => setHeadroomOpen(false))}
      </Drawer>
    </Box>
  );
}
