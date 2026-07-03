// src/components/ChatInput.tsx
import React, { useState, KeyboardEvent } from 'react';
import { Box, TextField, IconButton, Paper } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

interface Props {
  onSend: (text: string) => void;
}

const ChatInput: React.FC<Props> = ({ onSend }) => {
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
    <Paper elevation={0} sx={{ p: 1 }} component="form" onSubmit={e => { e.preventDefault(); handleSend(); }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          variant="filled"
          placeholder="Type a question..."
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKey}
          sx={{ background: 'rgba(255,255,255,0.08)', borderRadius: 1, flexGrow: 1 }}
        />
        <IconButton color="primary" onClick={handleSend} sx={{ ml: 1 }} aria-label="send message">
          <SendIcon />
        </IconButton>
      </Box>
    </Paper>
  );
};

export default ChatInput;
