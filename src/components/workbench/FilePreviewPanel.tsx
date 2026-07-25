// src/components/workbench/FilePreviewPanel.tsx
import React, { useState, useCallback } from 'react';
import { Box, Typography, Paper, IconButton, Chip, Button, Stack, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { surface, ink, accent, status, radius, typography } from '../../theme/cssTokens';
import { transition } from '../../theme/motion';

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
  const [copiedPath, setCopiedPath] = useState(false);
  const [wrapLines, setWrapLines] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedLines, setSelectedLines] = useState<{ start: number; end: number } | null>(null);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);

  const getFileExtension = (path: string | null): string => {
    if (!path) return '';
    const parts = path.split('.');
    return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
  };

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPath = () => {
    if (!filePath) return;
    navigator.clipboard.writeText(filePath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleLineNumberClick = useCallback((lineNumber: number) => {
    if (selectionStart === null) {
      setSelectionStart(lineNumber);
      setSelectedLines(null);
    } else {
      const start = Math.min(selectionStart, lineNumber);
      const end = Math.max(selectionStart, lineNumber);
      setSelectedLines({ start, end });
      setSelectionStart(null);
    }
  }, [selectionStart]);

  const getFileSizeLabel = () => {
    const bytes = new Blob([content]).size;
    if (bytes === 0) return '';
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const renderCodeLines = () => {
    const lines = content.split('\n');
    return (
      <Box sx={{ display: 'flex', fontFamily: typography.mono, fontSize: '0.72rem', lineHeight: '1.4', overflowX: 'auto' }}>
        {/* Line Numbers Column */}
        <Box sx={{ pr: 1.5, borderRight: `1px solid ${surface.border}`, color: ink.muted, textAlign: 'right', userSelect: 'none', minWidth: '24px' }}>
          {lines.map((_, idx) => {
            const lineNumber = idx + 1;
            const isSelected = selectedLines && lineNumber >= selectedLines.start && lineNumber <= selectedLines.end;
            const isSelecting = selectionStart === lineNumber;
            return (
              <Box
                key={idx}
                component="button"
                onClick={() => handleLineNumberClick(lineNumber)}
                sx={{
                  display: 'block',
                  width: '100%',
                  border: 'none',
                  background: isSelecting ? accent.violetMuted : 'transparent',
                  color: isSelecting ? accent.violet : isSelected ? accent.violet : ink.muted,
                  fontWeight: isSelecting || isSelected ? 600 : 400,
                  cursor: 'pointer',
                  padding: '0 4px 0 0',
                  textAlign: 'right',
                  transition: transition(['background-color', 'color']),
                  '&:hover': {
                    backgroundColor: surface.raisedHover,
                    color: ink.primary,
                  },
                }}
              >
                {lineNumber}
              </Box>
            );
          })}
        </Box>
        {/* Code Column */}
        <Box 
          sx={{ 
            pl: 1.5, 
            color: ink.primary, 
            whiteSpace: wrapLines ? 'pre-wrap' : 'pre', 
            wordBreak: wrapLines ? 'break-word' : 'normal',
            flexGrow: 1 
          }}
        >
          {lines.map((line, idx) => {
            const lineNumber = idx + 1;
            const isSelected = selectedLines && lineNumber >= selectedLines.start && lineNumber <= selectedLines.end;
            return (
              <Box
                key={idx}
                sx={{
                  backgroundColor: isSelected ? accent.violetMuted : 'transparent',
                  borderLeft: isSelected ? `2px solid ${accent.violet}` : '2px solid transparent',
                  pl: 1,
                  transition: transition(['background-color']),
                }}
              >
                {line || ' '}
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  };

  if (!filePath) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', opacity: 0.35, minHeight: 250 }}>
        <InsertDriveFileIcon sx={{ fontSize: 40, color: ink.muted, mb: 1.5 }} />
        <Typography variant="body2" sx={{ color: ink.muted }}>Select a file from the explorer tree to inspect its contents.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Panel Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, borderBottom: `1px solid ${surface.border}`, mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 700, color: ink.primary, fontFamily: typography.mono, fontSize: '0.75rem' }}>
            {filePath}
          </Typography>
          {getFileSizeLabel() && (
            <Chip label={getFileSizeLabel()} size="small" sx={{ height: 16, fontSize: '0.55rem', background: surface.sunken, color: ink.muted }} />
          )}
          <Tooltip title="This panel cannot edit files. PaneTera only reads safe workspace files in Alpha." arrow>
            <Chip 
              icon={<LockOutlinedIcon style={{ fontSize: 10, color: status.danger }} />}
              label="Read-only preview" 
              size="small" 
              sx={{ 
                height: 18, 
                fontSize: '0.55rem', 
                fontWeight: 800, 
                background: status.dangerMuted, 
                color: status.danger, 
                border: `1px solid ${status.danger}` 
              }} 
            />
          </Tooltip>
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
                borderColor: accent.violetBorder,
                color: accent.violet,
                '&:hover': { borderColor: accent.violet, background: accent.violetMuted }
              }}
            >
              Explain Code
            </Button>
          )}

          {!error && !reading && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => setWrapLines(!wrapLines)}
              sx={{
                height: 20,
                fontSize: '0.62rem',
                textTransform: 'none',
                borderColor: surface.border,
                color: wrapLines ? accent.violet : ink.muted,
                background: wrapLines ? accent.violetMuted : 'transparent',
                '&:hover': { borderColor: surface.borderStrong }
              }}
            >
              {wrapLines ? 'Unwrap' : 'Wrap'}
            </Button>
          )}

          {!error && !reading && (
            <IconButton onClick={handleCopy} size="small" sx={{ color: ink.secondary }} title="Copy file contents">
              <ContentCopyIcon sx={{ fontSize: 12 }} />
            </IconButton>
          )}
          {copied && <Typography variant="caption" sx={{ color: status.success, fontSize: '0.6rem' }}>Copied!</Typography>}
        </Stack>
      </Box>
 
      {/* Code Text Content */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', minHeight: 0 }}>
        {reading ? (
          <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', p: 5 }}>
            <span style={{ color: ink.muted, fontSize: '0.7rem' }}>Reading file...</span>
          </Box>
        ) : error ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', p: 3, textAlign: 'center', minHeight: 200 }}>
            <LockOutlinedIcon sx={{ fontSize: 28, color: status.danger, mb: 1.5 }} />
            <Typography variant="body2" sx={{ color: status.danger, fontWeight: 800, mb: 0.5, fontSize: '0.78rem' }}>
              ACCESS BLOCKED BY HOST POLICY
            </Typography>
            <Typography variant="caption" sx={{ color: ink.muted, maxWidth: 280, display: 'block', lineHeight: 1.4 }}>
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
