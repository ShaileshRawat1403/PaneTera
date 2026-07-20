// src/components/ChatInput.tsx
import React, { useState, KeyboardEvent } from 'react';
import { Box, TextField, IconButton, Paper } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

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
        borderRadius: '14px',
        background: '#171d27',
        border: '1px solid rgba(226, 232, 240, 0.12)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.18)',
        '&:focus-within': {
          borderColor: 'rgba(167, 139, 250, 0.72)',
          boxShadow: '0 0 0 3px rgba(167, 139, 250, 0.12)'
        }
      } : { p: 1 }}
      component="form"
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
              borderRadius: '10px',
              fontSize: '0.9rem',
              lineHeight: 1.5,
              '&:hover': { background: 'rgba(255,255,255,0.025)' },
              '&.Mui-focused': { background: 'transparent' }
            },
            '& textarea::placeholder': { color: '#7f8998', opacity: 1 }
          } : { background: 'rgba(255,255,255,0.08)', borderRadius: 1, flexGrow: 1 }}
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={!value.trim()}
          sx={variant === 'studio' ? {
            ml: 0.75,
            width: 38,
            height: 38,
            color: '#0f131a',
            background: '#a78bfa',
            '&:hover': { background: '#b9a4ff' },
            '&.Mui-disabled': { background: 'rgba(167, 139, 250, 0.1)', color: '#626b78' },
            '&:focus-visible': { outline: '2px solid #d8ccff', outlineOffset: 2 }
          } : { ml: 1 }}
          aria-label="Send message"
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Paper>
  );
};

export default ChatInput;
