import React from 'react';
import { Box, Button, Stack, Typography, Tooltip } from '@mui/material';
import ForumIcon from '@mui/icons-material/Forum';
import SplitScreenIcon from '@mui/icons-material/VerticalSplit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CodeIcon from '@mui/icons-material/Code';

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
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(255, 255, 255, 0.01)',
      }}
    >
      <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>
        WORKBENCH MODE: <span style={{ color: '#b794f4' }}>{mode.toUpperCase()}</span>
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
                borderRadius: '6px',
                background: mode === 'conversation' ? '#7f5af0' : 'transparent',
                borderColor: 'rgba(255,255,255,0.08)',
                color: mode === 'conversation' ? '#fff' : '#cbd5e1',
                '&:hover': {
                  background: mode === 'conversation' ? '#6d47dd' : 'rgba(255,255,255,0.02)'
                }
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
                borderRadius: '6px',
                background: mode === 'split' ? '#7f5af0' : 'transparent',
                borderColor: 'rgba(255,255,255,0.08)',
                color: mode === 'split' ? '#fff' : '#cbd5e1',
                '&:hover': {
                  background: mode === 'split' ? '#6d47dd' : 'rgba(255,255,255,0.02)'
                }
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
                borderRadius: '6px',
                background: mode === 'native-focus' ? '#7f5af0' : 'transparent',
                borderColor: 'rgba(255,255,255,0.08)',
                color: mode === 'native-focus' ? '#fff' : '#cbd5e1',
                '&:hover': {
                  background: mode === 'native-focus' ? '#6d47dd' : 'rgba(255,255,255,0.02)'
                }
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
                borderRadius: '6px',
                background: mode === 'local-app' ? '#7f5af0' : 'transparent',
                borderColor: 'rgba(255,255,255,0.08)',
                color: mode === 'local-app' ? '#fff' : '#cbd5e1',
                '&:hover': {
                  background: mode === 'local-app' ? '#6d47dd' : 'rgba(255,255,255,0.02)'
                }
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
