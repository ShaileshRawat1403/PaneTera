import React from 'react';
import { Box, Typography, Button, Chip, Stack } from '@mui/material';
import type { RepoSetupProposal } from '../../server/repoSetup';

export interface RepoSetupProposalCardProps {
  data: RepoSetupProposal;
  onCancel?: () => void;
  variant?: 'chat' | 'feed';
}

export const RepoSetupProposalCard: React.FC<RepoSetupProposalCardProps> = ({
  data,
  onCancel,
  variant = 'chat',
}) => {
  const {
    workspaceName,
    path: resolvedPath,
    exists,
    insideWorkspaceRoot,
    gitDetected,
    packageManager,
    scripts,
    warnings,
    allowed,
  } = data;

  const outerSx = variant === 'chat' ? { mt: 2, mb: 1 } : {};

  // 1. BLOCKED / NOT ALLOWED STATE
  if (!allowed) {
    return (
      <Box
        sx={{
          ...outerSx,
          background: 'rgba(239, 68, 68, 0.04)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '14px',
          p: 2.5,
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: '#ef4444',
            fontWeight: 700,
            letterSpacing: '0.06em',
            display: 'block',
            mb: 1.5,
          }}
        >
          REPO SETUP BLOCKED
        </Typography>
        <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 1, lineHeight: 1.5 }}>
          Proposed repository{' '}
          <Box component="span" sx={{ fontFamily: 'monospace', color: '#f87171', fontWeight: 700 }}>
            {workspaceName || 'Unknown'}
          </Box>{' '}
          cannot be configured.
        </Typography>

        <Stack spacing={1} sx={{ mt: 1.5, mb: 2 }}>
          {warnings.map((warning, idx) => (
            <Typography key={idx} variant="caption" sx={{ color: '#fca5a5', display: 'block' }}>
              ⚠️ {warning}
            </Typography>
          ))}
        </Stack>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="contained"
            disabled
            sx={{
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 700,
            }}
          >
            Blocked
          </Button>
          {onCancel && (
            <Button
              size="small"
              variant="outlined"
              onClick={onCancel}
              sx={{
                color: '#a1a1aa',
                borderColor: 'rgba(255,255,255,0.15)',
                borderRadius: '8px',
                textTransform: 'none',
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.3)',
                  background: 'rgba(255,255,255,0.04)',
                },
              }}
            >
              Dismiss
            </Button>
          )}
        </Box>
      </Box>
    );
  }

  // 2. ALLOWED PREVIEW CARD STATE
  return (
    <Box
      sx={{
        ...outerSx,
        background: 'rgba(127, 85, 240, 0.03)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(127, 85, 240, 0.25)',
        borderRadius: '14px',
        p: 2.5,
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="caption" sx={{ color: '#a78bfa', fontWeight: 700, letterSpacing: '0.06em' }}>
          PROPOSED REPO SETUP
        </Typography>
        <Chip
          label="PREVIEW ONLY"
          size="small"
          sx={{
            height: 18,
            fontSize: '0.6rem',
            fontWeight: 700,
            background: 'rgba(127, 85, 240, 0.12)',
            color: '#d8b4fe',
            border: '1px solid rgba(127, 85, 240, 0.25)',
          }}
        />
      </Box>

      <Typography variant="body2" sx={{ color: '#f4f4f5', mb: 0.5, lineHeight: 1.5 }}>
        Add workspace{' '}
        <Box component="span" sx={{ fontWeight: 700, color: '#c084fc' }}>
          {workspaceName}
        </Box>
      </Typography>

      <Typography
        variant="caption"
        sx={{
          color: '#94a3b8',
          display: 'block',
          fontFamily: 'monospace',
          mb: 1.5,
          wordBreak: 'break-all',
        }}
      >
        Path: {resolvedPath}
      </Typography>

      {/* Status Indicators */}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <Chip
          label={exists ? 'Exists' : 'Missing'}
          size="small"
          color={exists ? 'success' : 'error'}
          variant="outlined"
          sx={{ height: 20, fontSize: '0.7rem' }}
        />
        <Chip
          label={insideWorkspaceRoot ? 'Inside Root' : 'Outside Root'}
          size="small"
          color={insideWorkspaceRoot ? 'success' : 'error'}
          variant="outlined"
          sx={{ height: 20, fontSize: '0.7rem' }}
        />
        <Chip
          label={gitDetected ? 'Git Repo' : 'No Git'}
          size="small"
          color={gitDetected ? 'info' : 'warning'}
          variant="outlined"
          sx={{ height: 20, fontSize: '0.7rem' }}
        />
        {packageManager && (
          <Chip
            label={`PM: ${packageManager}`}
            size="small"
            color="secondary"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.7rem' }}
          />
        )}
      </Stack>

      {/* Package Scripts */}
      {scripts && scripts.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ color: '#a1a1aa', fontWeight: 600, display: 'block', mb: 0.5 }}>
            Detected Scripts:
          </Typography>
          <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
            {scripts.map((script) => (
              <Chip
                key={script}
                label={script}
                size="small"
                variant="outlined"
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  fontFamily: 'monospace',
                  borderColor: 'rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.02)',
                }}
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Stack spacing={0.5} sx={{ mb: 2 }}>
          {warnings.map((warning, idx) => (
            <Typography key={idx} variant="caption" sx={{ color: '#fbbf24', display: 'block' }}>
              ⚠️ {warning}
            </Typography>
          ))}
        </Stack>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          size="small"
          variant="contained"
          disabled
          sx={{
            background: 'rgba(255, 255, 255, 0.05)',
            color: 'rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 700,
          }}
        >
          Preview only
        </Button>
        {onCancel && (
          <Button
            size="small"
            variant="outlined"
            onClick={onCancel}
            sx={{
              color: '#a1a1aa',
              borderColor: 'rgba(255,255,255,0.15)',
              borderRadius: '8px',
              textTransform: 'none',
              '&:hover': {
                borderColor: 'rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.04)',
              },
            }}
          >
            Reject
          </Button>
        )}
      </Box>
    </Box>
  );
};
