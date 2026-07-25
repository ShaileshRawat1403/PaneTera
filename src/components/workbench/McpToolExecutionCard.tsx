import React, { useState } from 'react';
import { Box, Typography, Chip, Button, IconButton } from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { surface, ink, accent, status, radius, typography, elevation } from '../../theme/cssTokens';

interface McpToolExecutionCardProps {
  toolName: string;
  serverName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  durationMs?: number;
  isError?: boolean;
  onRerun?: (toolName: string, args?: Record<string, unknown>) => void;
}

export function McpToolExecutionCard({
  toolName,
  serverName = 'Connected MCP Server',
  args = {},
  result,
  durationMs,
  isError = false,
  onRerun,
}: McpToolExecutionCardProps) {
  const [copied, setCopied] = useState(false);
  const [showArgs, setShowArgs] = useState(false);

  const formattedResult = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box
      sx={{
        backgroundColor: surface.raised,
        border: `1px solid ${isError ? status.danger : surface.border}`,
        borderRadius: `${radius.md}px`,
        boxShadow: elevation.card,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          backgroundColor: surface.sunken,
          borderBottom: `1px solid ${surface.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <BuildIcon sx={{ color: isError ? status.danger : accent.violet, fontSize: 18 }} />
          <Box>
            <Typography variant="subtitle2" sx={{ color: ink.primary, fontWeight: 600 }}>
              {toolName}
            </Typography>
            <Typography variant="caption" sx={{ color: ink.muted, fontSize: '11px' }}>
              {serverName} {durationMs !== undefined ? `• ${durationMs}ms` : ''}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={isError ? 'Failed' : 'Executed'}
            size="small"
            sx={{
              height: 20,
              fontSize: '10px',
              fontWeight: 600,
              backgroundColor: isError ? status.dangerMuted : surface.sunken,
              color: isError ? status.danger : status.neutral,
              border: `1px solid ${isError ? status.danger : surface.border}`,
            }}
          />

          <IconButton size="small" onClick={handleCopy} title="Copy result">
            {copied ? <CheckIcon sx={{ color: status.success, fontSize: 16 }} /> : <ContentCopyIcon sx={{ color: ink.muted, fontSize: 16 }} />}
          </IconButton>

          {onRerun && (
            <Button
              size="small"
              onClick={() => onRerun(toolName, args)}
              sx={{
                fontSize: '11px',
                color: ink.secondary,
                border: `1px solid ${surface.border}`,
                px: 1,
                py: 0.25,
                borderRadius: `${radius.sm}px`,
                textTransform: 'none',
              }}
            >
              Re-run
            </Button>
          )}
        </Box>
      </Box>

      {/* Arguments Toggle */}
      {Object.keys(args).length > 0 && (
        <Box sx={{ px: 2, py: 1, borderBottom: `1px solid ${surface.border}` }}>
          <Button
            size="small"
            onClick={() => setShowArgs(!showArgs)}
            sx={{
              fontSize: '11px',
              color: ink.muted,
              textTransform: 'none',
              p: 0,
              minWidth: 'auto',
            }}
          >
            {showArgs ? 'Hide arguments ▲' : 'Show arguments ▼'}
          </Button>
          {showArgs && (
            <Box
              component="pre"
              sx={{
                mt: 1,
                p: 1.5,
                backgroundColor: surface.sunken,
                borderRadius: `${radius.sm}px`,
                fontSize: '11px',
                fontFamily: typography.mono,
                color: ink.secondary,
                overflow: 'auto',
                maxHeight: '150px',
              }}
            >
              {JSON.stringify(args, null, 2)}
            </Box>
          )}
        </Box>
      )}

      {/* Result Area */}
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 600, display: 'block', mb: 1, fontSize: '11px' }}>
          TOOL RESULT
        </Typography>
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 1.5,
            backgroundColor: surface.sunken,
            borderRadius: `${radius.sm}px`,
            fontSize: '12px',
            fontFamily: typography.mono,
            color: isError ? status.danger : ink.primary,
            overflow: 'auto',
            maxHeight: '300px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.5,
          }}
        >
          {formattedResult || 'No result returned'}
        </Box>
      </Box>
    </Box>
  );
}
