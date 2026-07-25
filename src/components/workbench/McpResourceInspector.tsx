import React, { useState, useMemo } from 'react';
import { Box, Typography, Button, TextField, Chip, IconButton } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import SearchIcon from '@mui/icons-material/Search';
import CodeIcon from '@mui/icons-material/Code';
import DescriptionIcon from '@mui/icons-material/Description';
import { surface, ink, accent, status, radius, typography, elevation } from '../../theme/cssTokens';
import { transition } from '../../theme/motion';

interface McpResource {
  uri: string;
  name: string;
  mimeType?: string;
  description?: string;
  text?: string;
  blob?: string;
}

interface McpResourceInspectorProps {
  resource: McpResource;
  serverName?: string;
  onAttachToComposer?: (resource: McpResource) => void;
  onClose?: () => void;
}

export function McpResourceInspector({
  resource,
  serverName = 'Connected MCP Server',
  onAttachToComposer,
  onClose,
}: McpResourceInspectorProps) {
  const [activeTab, setActiveTab] = useState<'formatted' | 'raw'>('formatted');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const rawContent = useMemo(() => {
    if (resource.text) return resource.text;
    if (resource.blob) return resource.blob;
    return '';
  }, [resource]);

  const isJson = useMemo(() => {
    if (resource.mimeType === 'application/json') return true;
    try {
      JSON.parse(rawContent);
      return true;
    } catch {
      return false;
    }
  }, [resource.mimeType, rawContent]);

  const parsedJson = useMemo(() => {
    if (!isJson || !rawContent) return null;
    try {
      return JSON.parse(rawContent);
    } catch {
      return null;
    }
  }, [isJson, rawContent]);

  const filteredContent = useMemo(() => {
    if (!searchQuery.trim()) return rawContent;
    const lines = rawContent.split('\n');
    return lines.filter((line) => line.toLowerCase().includes(searchQuery.toLowerCase())).join('\n');
  }, [rawContent, searchQuery]);

  const handleCopy = () => {
    navigator.clipboard.writeText(rawContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: surface.raised,
        border: `1px solid ${surface.border}`,
        borderRadius: `${radius.md}px`,
        boxShadow: elevation.card,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: `1px solid ${surface.border}`,
          backgroundColor: surface.sunken,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <CodeIcon sx={{ color: accent.violet, fontSize: 20 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap sx={{ color: ink.primary, fontWeight: 600 }}>
              {resource.name || 'MCP Resource'}
            </Typography>
            <Typography variant="caption" noWrap sx={{ color: ink.muted, display: 'block', fontSize: '11px' }}>
              {resource.uri}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <Chip
            label={serverName}
            size="small"
            sx={{
              height: 20,
              fontSize: '10px',
              backgroundColor: accent.violetMuted,
              color: accent.violet,
              border: `1px solid ${accent.violetBorder}`,
              borderRadius: `${radius.sm}px`,
            }}
          />
          {onClose && (
            <Button
              size="small"
              onClick={onClose}
              sx={{ color: ink.muted, minWidth: 'auto', px: 1, py: 0.5 }}
            >
              ✕
            </Button>
          )}
        </Box>
      </Box>

      {/* Toolbar */}
      <Box
        sx={{
          px: 2,
          py: 1,
          borderBottom: `1px solid ${surface.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button
            size="small"
            onClick={() => setActiveTab('formatted')}
            sx={{
              textTransform: 'none',
              fontSize: '12px',
              fontWeight: 600,
              px: 1.5,
              py: 0.5,
              borderRadius: `${radius.sm}px`,
              backgroundColor: activeTab === 'formatted' ? accent.violetMuted : 'transparent',
              color: activeTab === 'formatted' ? accent.violet : ink.secondary,
              border: `1px solid ${activeTab === 'formatted' ? accent.violetBorder : 'transparent'}`,
            }}
          >
            Formatted
          </Button>
          <Button
            size="small"
            onClick={() => setActiveTab('raw')}
            sx={{
              textTransform: 'none',
              fontSize: '12px',
              fontWeight: 600,
              px: 1.5,
              py: 0.5,
              borderRadius: `${radius.sm}px`,
              backgroundColor: activeTab === 'raw' ? accent.violetMuted : 'transparent',
              color: activeTab === 'raw' ? accent.violet : ink.secondary,
              border: `1px solid ${activeTab === 'raw' ? accent.violetBorder : 'transparent'}`,
            }}
          >
            Raw Payload
          </Button>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            placeholder="Search resource..."
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: ink.muted, fontSize: 16, mr: 0.5 }} />,
            }}
            sx={{
              width: 180,
              '& .MuiOutlinedInput-root': {
                height: 28,
                fontSize: '12px',
                backgroundColor: surface.sunken,
                '& fieldset': { borderColor: surface.border },
                '&:hover fieldset': { borderColor: surface.borderStrong },
                '&.Mui-focused fieldset': { borderColor: accent.violet },
              },
            }}
          />

          <IconButton size="small" onClick={handleCopy} title="Copy payload">
            {copied ? <CheckIcon sx={{ color: status.success, fontSize: 16 }} /> : <ContentCopyIcon sx={{ color: ink.muted, fontSize: 16 }} />}
          </IconButton>

          {onAttachToComposer && (
            <Button
              size="small"
              onClick={() => onAttachToComposer(resource)}
              sx={{
                backgroundColor: accent.violet,
                color: ink.onAccent,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '12px',
                px: 1.5,
                py: 0.5,
                borderRadius: `${radius.sm}px`,
                transition: transition(['background-color']),
                '&:hover': { backgroundColor: accent.violetHover },
              }}
            >
              Attach to Context
            </Button>
          )}
        </Box>
      </Box>

      {/* Content Area */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {activeTab === 'formatted' && parsedJson ? (
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              backgroundColor: surface.sunken,
              borderRadius: `${radius.sm}px`,
              fontSize: '12px',
              fontFamily: typography.mono,
              color: ink.primary,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {JSON.stringify(parsedJson, null, 2)}
          </Box>
        ) : (
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              backgroundColor: surface.sunken,
              borderRadius: `${radius.sm}px`,
              fontSize: '12px',
              fontFamily: typography.mono,
              color: ink.secondary,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {filteredContent || rawContent || 'No content available'}
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          px: 2,
          py: 1,
          borderTop: `1px solid ${surface.border}`,
          backgroundColor: surface.sunken,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="caption" sx={{ color: ink.muted, fontSize: '11px' }}>
          {resource.mimeType || (isJson ? 'application/json' : 'text/plain')} • {new Blob([rawContent]).size} bytes
        </Typography>
        <Typography variant="caption" sx={{ color: status.neutral, fontSize: '11px', fontWeight: 500 }}>
          Governed Read-Only Resource
        </Typography>
      </Box>
    </Box>
  );
}
