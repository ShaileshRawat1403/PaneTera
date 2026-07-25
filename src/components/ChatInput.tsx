// src/components/ChatInput.tsx
import React, { useState, KeyboardEvent } from 'react';
import { Box, TextField, IconButton, Paper } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { accent, elevation, ink, radius, surface } from '../theme/cssTokens';
import { transition, duration, easing } from '../theme/motion';
interface Props {
  onSend: (text: string) => void;
  variant?: 'default' | 'studio';
}

const ChatInput: React.FC<Props> = ({ onSend, variant = 'default' }) => {
  const [value, setValue] = useState('');

  const handleSend = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onSend(trimmed);
      setValue('');
    }
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
        transition: transition(['background-color', 'box-shadow', 'border-color'], duration.quick),
        '&:focus-within': {
          borderColor: accent.violetBorder,
          boxShadow: elevation.focusRing
        }
      } : { 
        p: 1,
        borderRadius: `${radius.md}px`,
        background: surface.base,
        transition: transition(['background-color', 'box-shadow', 'border-color'], duration.quick)
      }}
      component="form"
      role="form"
      aria-label="Message composer"
      onSubmit={e => { e.preventDefault(); handleSend(); }}
    >
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
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={!value.trim()}
          sx={variant === 'studio' ? {
            ml: 0.75,
            width: 38,
            height: 38,
            color: ink.onAccent,
            background: accent.violet,
            transition: transition(['background-color', 'transform'], duration.quick),
            '&:hover': { background: accent.violetHover },
            '&.Mui-disabled': { background: accent.violetMuted, color: ink.disabled },
            '&:focus-visible': { outline: `2px solid ${accent.violet}`, outlineOffset: 2 }
          } : { 
            ml: 1,
            color: accent.violet,
            transition: transition(['background-color', 'transform'], duration.quick),
            '&.Mui-disabled': { color: ink.disabled }
          }}
          aria-label="Send message"
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Paper>
  );
};

export default ChatInput;
