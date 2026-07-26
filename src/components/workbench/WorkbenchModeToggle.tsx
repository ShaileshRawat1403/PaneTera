import React from 'react';
import { Box, Button, Stack, Typography, Tooltip } from '@mui/material';
import ForumIcon from '@mui/icons-material/Forum';
import SplitScreenIcon from '@mui/icons-material/VerticalSplit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CodeIcon from '@mui/icons-material/Code';
import { accent, ink, radius, surface } from '../../theme/cssTokens';
import { transition } from '../../theme/motion';

export type WorkbenchMode = 'conversation' | 'native-focus' | 'split' | 'local-app';

interface WorkbenchModeToggleProps {
  mode: WorkbenchMode;
  onModeChange: (mode: WorkbenchMode) => void;
  hasActiveWorkspace: boolean;
  hasFeedItems: boolean;
  hasActiveComponent: boolean;
}

export const WorkbenchModeToggle: React.FC<WorkbenchModeToggleProps> = ({
  mode,
  onModeChange,
  hasActiveWorkspace,
  hasFeedItems,
  hasActiveComponent
}) => {
  const splitDisabled = !hasActiveWorkspace && !hasFeedItems;
  const focusDisabled = !hasActiveComponent;

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        px: 3,
        py: 1,
        borderBottom: `1px solid ${surface.border}`,
        backgroundColor: surface.base,
      }}
    >
      <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 700, letterSpacing: '0.05em' }}>
        WORKBENCH MODE: <span style={{ color: accent.violet }}>{mode.toUpperCase()}</span>
      </Typography>

      <Stack direction="row" spacing={1}>
        <Tooltip title="Shows orchestrator chat as the primary center view." arrow>
          <span>
            <Button
              size="small"
              variant={mode === 'conversation' ? 'contained' : 'outlined'}
              onClick={() => onModeChange('conversation')}
              startIcon={<ForumIcon sx={{ fontSize: 14 }} />}
              sx={{
                fontSize: '0.65rem',
                py: 0.25,
                px: 1.5,
                borderRadius: `${radius.sm}px`,
                backgroundColor: mode === 'conversation' ? accent.violet : 'transparent',
                borderColor: surface.border,
                color: mode === 'conversation' ? ink.onAccent : ink.secondary,
                transition: transition(['background-color', 'border-color', 'color']),
                '&:hover': {
                  backgroundColor: mode === 'conversation' ? accent.violet : surface.overlay,
                },
              }}
            >
              Chat
            </Button>
          </span>
        </Tooltip>
        
        <Tooltip title={splitDisabled ? "No active workspace or feed items available." : "Show chat and the selected Intelligence Feed component side by side."} arrow>
          <span>
            <Button
              size="small"
              variant={mode === 'split' ? 'contained' : 'outlined'}
              onClick={() => onModeChange('split')}
              disabled={splitDisabled}
              startIcon={<SplitScreenIcon sx={{ fontSize: 14 }} />}
              sx={{
                fontSize: '0.65rem',
                py: 0.25,
                px: 1.5,
                borderRadius: `${radius.sm}px`,
                backgroundColor: mode === 'split' ? accent.violet : 'transparent',
                borderColor: surface.border,
                color: mode === 'split' ? ink.onAccent : ink.secondary,
                transition: transition(['background-color', 'border-color', 'color']),
                '&:hover': {
                  backgroundColor: mode === 'split' ? accent.violet : surface.overlay,
                },
              }}
            >
              Split
            </Button>
          </span>
        </Tooltip>

        <Tooltip title={focusDisabled ? "Select a file, dependency map, or intelligence card first." : "Focuses the currently selected Intelligence Feed component."} arrow>
          <span>
            <Button
              size="small"
              variant={mode === 'native-focus' ? 'contained' : 'outlined'}
              onClick={() => onModeChange('native-focus')}
              disabled={focusDisabled}
              startIcon={<VisibilityIcon sx={{ fontSize: 14 }} />}
              sx={{
                fontSize: '0.65rem',
                py: 0.25,
                px: 1.5,
                borderRadius: `${radius.sm}px`,
                backgroundColor: mode === 'native-focus' ? accent.violet : 'transparent',
                borderColor: surface.border,
                color: mode === 'native-focus' ? ink.onAccent : ink.secondary,
                transition: transition(['background-color', 'border-color', 'color']),
                '&:hover': {
                  backgroundColor: mode === 'native-focus' ? accent.violet : surface.overlay,
                },
              }}
            >
              Focus Active UI
            </Button>
          </span>
        </Tooltip>

        <Tooltip title="Local App Workbench" arrow>
          <span>
            <Button
              size="small"
              variant={mode === 'local-app' ? 'contained' : 'outlined'}
              onClick={() => onModeChange('local-app')}
              startIcon={<CodeIcon sx={{ fontSize: 14 }} />}
              sx={{
                fontSize: '0.65rem',
                py: 0.25,
                px: 1.5,
                borderRadius: `${radius.sm}px`,
                backgroundColor: mode === 'local-app' ? accent.violet : 'transparent',
                borderColor: surface.border,
                color: mode === 'local-app' ? ink.onAccent : ink.secondary,
                transition: transition(['background-color', 'border-color', 'color']),
                '&:hover': {
                  backgroundColor: mode === 'local-app' ? accent.violet : surface.overlay,
                },
              }}
            >
              Local App
            </Button>
          </span>
        </Tooltip>

      </Stack>
    </Box>
  );
};
