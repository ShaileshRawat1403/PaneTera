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
import ForumIcon from '@mui/icons-material/Forum';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { accent, elevation, ink, radius, status, surface } from '../../theme/tokens';
import { transition } from '../../theme/motion';
import { PaneDivider } from './PaneDivider';
import { maxConversationWidth, usePersistentPaneWidth } from './paneSizing';
import {
  type WorkstationPlane,
  shouldSignalCanvas,
  useIsStacked,
} from './workstationLayout';

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

/** Width of the draggable separator, in pixels. */
const DIVIDER_WIDTH = 7;

export interface WorkstationShellProps {
  conversation: React.ReactNode;
  canvas: React.ReactNode;
  renderActivity: (closeActivity: () => void) => React.ReactNode;
  renderWorkspaceSelector: (closeWorkspaceSelector: () => void) => React.ReactNode;
  renderRig: (closeRig: () => void) => React.ReactNode;
  renderHeadroom: (closeHeadroom: () => void) => React.ReactNode;
  rigRequestKey?: number;
  headroomRequestKey?: number;
  /** Bumped to open the project picker from outside the top bar. */
  projectPickerRequestKey?: number;
  governanceStatus: GovernanceSummary;
  onOpenAudit: () => void;
  /**
   * Whether the canvas currently holds something other than the empty state.
   *
   * Used only by the stacked (narrow) layout, to signal on the Canvas toggle
   * that content is waiting there. The shell cannot introspect the opaque
   * canvas node, so the caller reports this.
   */
  canvasHasContent?: boolean;
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
  projectPickerRequestKey = 0,
  governanceStatus,
  onOpenAudit,
  canvasHasContent = false,
}: WorkstationShellProps) {
  const [activityOpen, setActivityOpen] = useState(false);
  const [rigOpen, setRigOpen] = useState(false);
  const [headroomOpen, setHeadroomOpen] = useState(false);
  const [workspaceAnchorEl, setWorkspaceAnchorEl] = useState<null | HTMLElement>(null);
  // The project picker anchors to the top-bar button. A ref lets the empty
  // canvas open it too, so "Choose a project" is actionable from where the
  // person is looking rather than only from the top bar.
  const chooseProjectRef = React.useRef<HTMLButtonElement>(null);

  // Narrow-viewport layout. Below the workstation threshold the two planes stack
  // into one switched column instead of shrinking side by side. The person lands
  // on the conversation, where the composer is, and the switch is persistent so
  // it is always one action away. The canvas request is honoured whatever it
  // holds, including its empty state, which carries its own guidance.
  const stacked = useIsStacked();
  const [activePlane, setActivePlane] = useState<WorkstationPlane>('conversation');
  const canvasSignal = shouldSignalCanvas(activePlane, canvasHasContent);
  // Derived from the contract's 60% canvas floor rather than a picked
  // percentage. The divider counts against the budget because it is usable
  // width the canvas does not receive either.
  const conversationMax = React.useCallback(
    () =>
      typeof window === 'undefined'
        ? 640
        : maxConversationWidth(window.innerWidth, {
            min: 340,
            absoluteMax: 640,
            dividerWidth: DIVIDER_WIDTH,
          }),
    [],
  );
  const [conversationWidth, setConversationWidth] = usePersistentPaneWidth(
    'panetera-conversation-width',
    400,
    340,
    conversationMax,
  );

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

  React.useEffect(() => {
    if (projectPickerRequestKey <= 0) return;
    // Anchor to the real top-bar button, so the picker appears where it always
    // does rather than in an arbitrary spot.
    if (chooseProjectRef.current) setWorkspaceAnchorEl(chooseProjectRef.current);
  }, [projectPickerRequestKey]);

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

  /**
   * One toggle in the narrow-layout plane switch.
   *
   * Presented as toggle buttons with `aria-pressed`, not an ARIA tabs pattern.
   * A partial tabs implementation is worse than none: the earlier version had
   * `role="tab"` without `tabpanel`, `aria-controls`, roving focus, or arrow
   * keys, which announces a contract to assistive technology that the widget
   * does not honour. Two pressable buttons are a smaller promise, honestly kept.
   *
   * The availability signal is conveyed in text, not only by the dot. The dot is
   * decorative and hidden from assistive technology; a visually hidden phrase
   * carries the same meaning to a screen reader, so "content is waiting on the
   * canvas" is not sighted-only information.
   */
  const renderPlaneToggle = ({
    label,
    icon,
    active,
    signal,
    onSelect,
  }: {
    label: string;
    icon: React.ReactNode;
    active: boolean;
    signal: boolean;
    onSelect: () => void;
  }) => (
    <Button
      key={label}
      aria-pressed={active}
      onClick={onSelect}
      startIcon={icon}
      sx={{
        flex: 1,
        gap: 0.5,
        py: 0.75,
        borderRadius: `${radius.sm}px`,
        border: `1px solid ${active ? accent.violetBorder : 'transparent'}`,
        backgroundColor: active ? accent.violetMuted : 'transparent',
        color: active ? ink.primary : ink.secondary,
        fontWeight: 600,
        transition: transition(['background-color', 'color', 'border-color']),
        '&:hover': { color: ink.primary, backgroundColor: active ? accent.violetHover : surface.overlay },
        ...focusRing,
      }}
    >
      {label}
      {signal && (
        <>
          <Box
            aria-hidden
            sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: status.brass, ml: 0.25 }}
          />
          <Box
            component="span"
            sx={{
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: '-1px',
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          >
            , content waiting
          </Box>
        </>
      )}
    </Button>
  );

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
          // Restrained depth: a hairline shadow lifts the bar a single step off
          // the workspace beneath it, without adding height or drawing the eye.
          boxShadow: elevation.raised,
          zIndex: 1,
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
              ref={chooseProjectRef}
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
                // The project selector is the current workspace context, so it
                // reads as a filled control rather than a bare label. Grouped
                // with the identity to its left, the two form one context block;
                // the utilities on the right stay quieter by comparison.
                backgroundColor: surface.sunken,
                borderColor: surface.border,
                '&:hover': { color: ink.primary, backgroundColor: surface.overlay, borderColor: surface.borderStrong },
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

      {/* 2. Two planes. Split side by side at workstation widths; stacked into
          one switched column when the window is too narrow to hold both.

          One subtree, not two. The conversation and canvas nodes are mounted
          exactly once and kept in a fixed sibling order — conversation, divider,
          canvas — across both layouts. Only the container's display, the grid
          template, and each child's visibility change. This is deliberate and
          load-bearing: an earlier version rendered two conditional branches, so
          crossing the breakpoint reordered the siblings and React remounted the
          panes, discarding a half-written composer draft and restarting any
          live preview. Changing style on stable nodes cannot do that. */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {stacked && (
          // The switch is chrome, not a plane, so it lives outside the pane
          // subtree and cannot disturb it. Rendering it only when stacked never
          // touches the conversation or canvas nodes below.
          <Box
            role="group"
            aria-label="Choose which pane to show"
            sx={{
              display: 'flex',
              gap: 0.5,
              px: 1,
              py: 0.75,
              borderBottom: `1px solid ${surface.border}`,
              backgroundColor: surface.raised,
            }}
          >
            {renderPlaneToggle({
              label: 'Conversation',
              icon: <ForumIcon sx={{ fontSize: 16 }} />,
              active: activePlane === 'conversation',
              signal: false,
              onSelect: () => setActivePlane('conversation'),
            })}
            {renderPlaneToggle({
              label: 'Canvas',
              icon: <DashboardIcon sx={{ fontSize: 16 }} />,
              active: activePlane === 'canvas',
              signal: canvasSignal,
              onSelect: () => setActivePlane('canvas'),
            })}
          </Box>
        )}

        <Box
          sx={{
            flexGrow: 1,
            minHeight: 0,
            overflow: 'hidden',
            // Split is a three-column grid; stacked is a single flex column.
            // The element is the same in both, so switching between them keeps
            // its children mounted.
            ...(stacked
              ? { display: 'flex', flexDirection: 'column' }
              : {
                  display: 'grid',
                  gridTemplateColumns: `${conversationWidth}px 7px minmax(0, 1fr)`,
                }),
          }}
        >
          <Box
            component="aside"
            aria-label="PaneTera conversation"
            sx={{
              flexDirection: 'column',
              minWidth: 0,
              minHeight: 0,
              flexGrow: 1,
              backgroundColor: surface.raised,
              // Split: always shown, with a right border. Stacked: shown only
              // when selected, with no border. `display:none` keeps the node
              // and its state; the browser does not unload a hidden iframe.
              borderRight: stacked ? 'none' : `1px solid ${surface.border}`,
              display: stacked ? (activePlane === 'conversation' ? 'flex' : 'none') : 'flex',
            }}
          >
            {conversation}
          </Box>

          {/* Kept as a stable middle sibling so the pane order never changes.
              `display:contents` lets the divider itself act as the grid column
              in split; `display:none` hides the whole wrapper when stacked. */}
          <Box sx={{ display: stacked ? 'none' : 'contents' }}>
            <PaneDivider
              label="Resize conversation and canvas"
              value={conversationWidth}
              min={340}
              max={conversationMax()}
              onChange={setConversationWidth}
              onReset={() => setConversationWidth(400)}
            />
          </Box>

          <Box
            component="main"
            aria-label="PaneTera main canvas"
            data-testid="workstation-canvas"
            sx={{
              flexDirection: 'column',
              minWidth: 0,
              minHeight: 0,
              position: 'relative',
              flexGrow: 1,
              // Deliberately flat. The canvas is the authoritative surface, so
              // whatever it holds should be the only thing competing for
              // attention. The former grid and violet bloom carried no
              // information.
              backgroundColor: surface.base,
              display: stacked ? (activePlane === 'canvas' ? 'flex' : 'none') : 'flex',
            }}
          >
            {canvas}
          </Box>
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
