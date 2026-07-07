import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import ForumIcon from '@mui/icons-material/Forum';
import SplitScreenIcon from '@mui/icons-material/VerticalSplit';
import VisibilityIcon from '@mui/icons-material/Visibility';

export type WorkbenchMode = 'conversation' | 'native-focus' | 'split';

interface WorkbenchModeToggleProps {
  mode: WorkbenchMode;
  onModeChange: (mode: WorkbenchMode) => void;
  hasActiveComponent: boolean;
}

export const WorkbenchModeToggle: React.FC<WorkbenchModeToggleProps> = ({
  mode,
  onModeChange,
  hasActiveComponent
}) => {
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
        
        <Button
          size="small"
          variant={mode === 'split' ? 'contained' : 'outlined'}
          onClick={() => onModeChange('split')}
          disabled={!hasActiveComponent}
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

        <Button
          size="small"
          variant={mode === 'native-focus' ? 'contained' : 'outlined'}
          onClick={() => onModeChange('native-focus')}
          disabled={!hasActiveComponent}
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
      </Stack>
    </Box>
  );
};
