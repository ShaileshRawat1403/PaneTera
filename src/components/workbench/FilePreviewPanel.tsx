// src/components/workbench/FilePreviewPanel.tsx
import React, { useState } from 'react';
import { Box, Typography, Paper, IconButton, Chip, Button, Stack } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

interface PreviewProps {
  filePath: string | null;
  content: string;
  error: string;
  reading: boolean;
  onExplainCode?: (fileName: string) => void;
}

export const FilePreviewPanel: React.FC<PreviewProps> = ({
  filePath,
  content,
  error,
  reading,
  onExplainCode
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFileSizeLabel = () => {
    const bytes = new Blob([content]).size;
    if (bytes === 0) return '';
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const renderCodeLines = () => {
    const lines = content.split('\n');
    return (
      <Box sx={{ display: 'flex', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: '1.4', overflowX: 'auto' }}>
        {/* Line Numbers Column */}
        <Box sx={{ pr: 1.5, borderRight: '1px solid rgba(255, 255, 255, 0.05)', color: '#71717a', textAlign: 'right', userSelect: 'none', minWidth: '24px' }}>
          {lines.map((_, idx) => (
            <div key={idx}>{idx + 1}</div>
          ))}
        </Box>
        {/* Code Column */}
        <Box sx={{ pl: 1.5, color: '#e4e4e7', whiteSpace: 'pre', flexGrow: 1 }}>
          {lines.map((line, idx) => (
            <div key={idx}>{line || ' '}</div>
          ))}
        </Box>
      </Box>
    );
  };

  if (!filePath) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', opacity: 0.35, minHeight: 250 }}>
        <InsertDriveFileIcon sx={{ fontSize: 40, color: '#71717a', mb: 1.5 }} />
        <Typography variant="body2" sx={{ color: '#a1a1aa' }}>Select a file from the explorer tree to inspect its contents.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Panel Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, borderBottom: '1px solid rgba(255,255,255,0.06)', mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#f4f4f5', fontFamily: 'monospace', fontSize: '0.75rem' }}>
            {filePath}
          </Typography>
          {getFileSizeLabel() && (
            <Chip label={getFileSizeLabel()} size="small" sx={{ height: 16, fontSize: '0.55rem', background: 'rgba(255,255,255,0.03)', color: '#a1a1aa' }} />
          )}
        </Stack>
        
        <Stack direction="row" spacing={1} alignItems="center">
          {onExplainCode && !error && !reading && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => onExplainCode(filePath)}
              startIcon={<HelpOutlineIcon sx={{ fontSize: 10 }} />}
              sx={{
                height: 20,
                fontSize: '0.62rem',
                textTransform: 'none',
                borderColor: 'rgba(127, 85, 240, 0.3)',
                color: '#b794f4',
                '&:hover': { borderColor: '#7f5af0', background: 'rgba(127, 85, 240, 0.05)' }
              }}
            >
              Explain Code
            </Button>
          )}

          {!error && !reading && (
            <IconButton onClick={handleCopy} size="small" sx={{ color: '#cbd5e1' }} title="Copy file contents">
              <ContentCopyIcon sx={{ fontSize: 12 }} />
            </IconButton>
          )}
          {copied && <Typography variant="caption" sx={{ color: '#22c55e', fontSize: '0.6rem' }}>Copied!</Typography>}
        </Stack>
      </Box>

      {/* Code Text Content */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', minHeight: 0 }}>
        {reading ? (
          <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', p: 5 }}>
            <span style={{ color: '#71717a', fontSize: '0.7rem' }}>Reading file...</span>
          </Box>
        ) : error ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', p: 3, textAlign: 'center', minHeight: 200 }}>
            <LockOutlinedIcon sx={{ fontSize: 28, color: '#ef4444', mb: 1.5 }} />
            <Typography variant="body2" sx={{ color: '#ef4444', fontWeight: 800, mb: 0.5, fontSize: '0.78rem' }}>
              ACCESS BLOCKED BY HOST POLICY
            </Typography>
            <Typography variant="caption" sx={{ color: '#a1a1aa', maxWidth: 280, display: 'block', lineHeight: 1.4 }}>
              {error}
            </Typography>
          </Box>
        ) : (
          renderCodeLines()
        )}
      </Box>
    </Box>
  );
};
