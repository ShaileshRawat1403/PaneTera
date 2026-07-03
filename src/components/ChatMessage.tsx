// src/components/ChatMessage.tsx
import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { InteractiveComponent } from './InteractiveComponent';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  uiComponent?: {
    type: 'WorkspaceList' | 'FileList' | 'CodePreview' | 'SearchResults';
    data: any;
  };
  onAction?: (query: string) => void;
  shouldStream?: boolean;
}

const ChatMessage: React.FC<Props> = ({ role, content, uiComponent, onAction, shouldStream = false }) => {
  const isUser = role === 'user';
  const [displayedText, setDisplayedText] = useState(shouldStream ? '' : content);
  const [streamComplete, setStreamComplete] = useState(!shouldStream);

  useEffect(() => {
    if (shouldStream) {
      setStreamComplete(false);
      setDisplayedText('');
      let index = 0;
      const words = content.split(' ');
      
      const interval = setInterval(() => {
        if (index < words.length) {
          setDisplayedText(prev => prev + (prev ? ' ' : '') + words[index]);
          index++;
        } else {
          setStreamComplete(true);
          clearInterval(interval);
        }
      }, 35); // word-by-word streaming every 35ms

      return () => clearInterval(interval);
    } else {
      setDisplayedText(content);
      setStreamComplete(true);
    }
  }, [content, shouldStream]);

  return (
    <Box sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', mb: 2, width: '100%' }}>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          maxWidth: '90%',
          minWidth: isUser ? 'auto' : '60%',
          background: isUser ? 'rgba(127,85,240,0.15)' : 'rgba(255,255,255,0.03)',
          borderRadius: 3,
          border: isUser ? '1px solid rgba(127,85,240,0.25)' : '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Typography variant="caption" sx={{ color: isUser ? '#b794f4' : '#a0aec0', fontWeight: 'bold', display: 'block', mb: 0.5 }}>
          {isUser ? 'YOU' : 'PORTAL'}
        </Typography>
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', color: '#e2e8f0', lineHeight: 1.6 }}>
          {displayedText}
          {!isUser && !streamComplete && <span className="terminal-cursor" style={{ width: 4, height: 10, verticalAlign: 'middle', marginLeft: 4 }} />}
        </Typography>
        {uiComponent && onAction && streamComplete && (
          <InteractiveComponent uiComponent={uiComponent} onAction={onAction} />
        )}
      </Paper>
    </Box>
  );
};

export default ChatMessage;
