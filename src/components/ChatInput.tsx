// src/components/ChatInput.tsx
// Refined conversation composer input field with warm graphite glassmorphism,
// explicit native file/folder attachment grants, and smooth micro-animations.

import React, { useState, KeyboardEvent } from 'react';
import { Box, TextField, IconButton, Paper, Stack, Chip, Tooltip } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import FolderIcon from '@mui/icons-material/Folder';
import CloseIcon from '@mui/icons-material/Close';
import { accent, elevation, ink, radius, surface } from '../theme/cssTokens';
import { transition, duration, easing } from '../theme/motion';
import { NativePickerModal, NativeGrantResult } from './workstation/NativePickerModal';

interface Props {
  onSend: (text: string, grants?: NativeGrantResult[]) => void;
  variant?: 'default' | 'studio';
  token?: string;
}

const ChatInput: React.FC<Props> = ({ onSend, variant = 'default', token }) => {
  const [value, setValue] = useState('');
  const [activeGrants, setActiveGrants] = useState<NativeGrantResult[]>([]);
  const [pickerState, setPickerState] = useState<{ open: boolean; type: 'file' | 'folder' }>({
    open: false,
    type: 'file',
  });

  const handleSend = () => {
    const trimmed = value.trim();
    if (trimmed || activeGrants.length > 0) {
      onSend(trimmed, activeGrants);
      setValue('');
      setActiveGrants([]);
    }
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGrantCreated = (grant: NativeGrantResult) => {
    setActiveGrants(prev => [...prev.filter(g => g.token !== grant.token), grant]);
  };

  const handleRemoveGrant = (tokenToRemove: string) => {
    setActiveGrants(prev => prev.filter(g => g.token !== tokenToRemove));
  };

  return (
    <Paper
      elevation={0}
      sx={variant === 'studio' ? {
        p: 0.75,
        borderRadius: `${radius.md}px`,
        background: surface.raised,
        border: `1px solid ${surface.border}`,
        boxShadow: elevation.card,
        transition: transition(['background-color', 'box-shadow', 'border-color', 'transform'], duration.settled, easing.enter),
        '&:focus-within': {
          borderColor: accent.violetBorder,
          boxShadow: `0 0 20px ${accent.violetMuted}, ${elevation.focusRing}`,
        }
      } : { 
        p: 1,
        borderRadius: `${radius.md}px`,
        background: surface.base,
        border: `1px solid ${surface.border}`,
        transition: transition(['background-color', 'box-shadow', 'border-color'], duration.quick),
        '&:focus-within': {
          borderColor: accent.violetBorder,
          boxShadow: elevation.focusRing,
        }
      }}
      component="form"
      role="form"
      aria-label="Message composer"
      onSubmit={e => { e.preventDefault(); handleSend(); }}
    >
      {/* Active native grant chips */}
      {activeGrants.length > 0 && (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ px: 1, pt: 0.5, pb: 1 }}>
          {activeGrants.map(grant => (
            <Chip
              key={grant.token}
              icon={grant.type === 'file' ? <InsertDriveFileIcon sx={{ fontSize: 14 }} /> : <FolderIcon sx={{ fontSize: 14 }} />}
              label={`${grant.name} (15m grant)`}
              onDelete={() => handleRemoveGrant(grant.token)}
              deleteIcon={<CloseIcon sx={{ fontSize: 12 }} />}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.75rem',
                backgroundColor: accent.violetMuted,
                border: `1px solid ${accent.violetBorder}`,
                color: ink.primary,
                '& .MuiChip-deleteIcon': {
                  color: ink.secondary,
                  '&:hover': { color: ink.primary },
                },
              }}
            />
          ))}
        </Stack>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          variant="filled"
          placeholder={variant === 'studio' ? 'Ask, inspect, or describe what you want to make…' : 'Type a question...'}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKey}
          InputProps={{
            disableUnderline: variant === 'studio',
            inputProps: { 'aria-label': 'Message PaneTera' }
          }}
          sx={variant === 'studio' ? {
            flexGrow: 1,
            '& .MuiFilledInput-root': {
              background: 'transparent',
              borderRadius: `${radius.sm}px`,
              fontSize: '0.9rem',
              lineHeight: 1.5,
              '&:hover': { background: surface.raisedHover },
              '&.Mui-focused': { background: 'transparent' }
            },
            '& textarea::placeholder': { color: ink.muted, opacity: 1 }
          } : { 
            background: surface.raised, 
            borderRadius: `${radius.sm}px`, 
            flexGrow: 1,
            '& textarea::placeholder': { color: ink.muted, opacity: 1 }
          }}
        />

        {/* Native attachment buttons */}
        <Tooltip title="Attach File Grant">
          <IconButton
            size="small"
            aria-label="Attach explicit file grant"
            onClick={() => setPickerState({ open: true, type: 'file' })}
            sx={{ color: ink.secondary, p: 0.75, ml: 0.5, '&:hover': { color: accent.violet } }}
          >
            <InsertDriveFileIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Attach Folder Grant">
          <IconButton
            size="small"
            aria-label="Attach explicit folder grant"
            onClick={() => setPickerState({ open: true, type: 'folder' })}
            sx={{ color: ink.secondary, p: 0.75, mr: 0.25, '&:hover': { color: accent.violet } }}
          >
            <FolderIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={!value.trim() && activeGrants.length === 0}
          sx={variant === 'studio' ? {
            ml: 0.5,
            width: 38,
            height: 38,
            color: ink.onAccent,
            background: accent.violet,
            transition: transition(['background-color', 'transform', 'box-shadow'], duration.quick),
            '&:hover': {
              background: accent.violetHover,
              transform: 'scale(1.05)',
              boxShadow: `0 0 12px ${accent.violetMuted}`,
            },
            '&:active': {
              transform: 'scale(0.95)',
            },
            '&.Mui-disabled': { background: accent.violetMuted, color: ink.disabled },
            '&:focus-visible': { outline: `2px solid ${accent.violet}`, outlineOffset: 2 }
          } : { 
            ml: 1,
            color: accent.violet,
            transition: transition(['background-color', 'transform'], duration.quick),
            '&:hover': { transform: 'scale(1.05)' },
            '&:active': { transform: 'scale(0.95)' },
            '&.Mui-disabled': { color: ink.disabled }
          }}
          aria-label="Send message"
        >
          <SendIcon />
        </IconButton>
      </Box>

      {/* Native file/folder chooser modal */}
      <NativePickerModal
        open={pickerState.open}
        type={pickerState.type}
        token={token}
        onClose={() => setPickerState(prev => ({ ...prev, open: false }))}
        onGrantCreated={handleGrantCreated}
      />
    </Paper>
  );
};

export default ChatInput;
