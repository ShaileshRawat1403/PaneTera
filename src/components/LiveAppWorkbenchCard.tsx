import React from 'react';
import { Box, Typography, Button, Chip, Stack, List, ListItem, ListItemText, Divider } from '@mui/material';
import type { LiveAppWorkbenchData } from '../../server/liveApp';

export interface LiveAppWorkbenchCardProps {
  data: LiveAppWorkbenchData;
  onCancel?: () => void;
  variant?: 'chat' | 'feed';
}

export const LiveAppWorkbenchCard: React.FC<LiveAppWorkbenchCardProps> = ({
  data,
  onCancel,
  variant = 'chat',
}) => {
  const {
    appName,
    url,
    configured,
    reachable,
    manifestAvailable,
    manifestUrl,
    environment,
    version,
    routes,
    features,
    workflows,
    health,
    sourceLabels,
    personaLenses,
    warnings,
  } = data;

  const outerSx = variant === 'chat' ? { mt: 2, mb: 1 } : {};

  // Status mapping colors
  const getSourceStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'success';
      case 'unavailable':
        return 'error';
      case 'unverified':
        return 'warning';
      case 'future':
      default:
        return 'default';
    }
  };

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
      {/* Title Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="caption" sx={{ color: '#a78bfa', fontWeight: 700, letterSpacing: '0.06em' }}>
          LIVE APP WORKBENCH
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

      {/* App details */}
      <Typography variant="body2" sx={{ color: '#f4f4f5', mb: 0.5, lineHeight: 1.5 }}>
        Application:{' '}
        <Box component="span" sx={{ fontWeight: 700, color: '#c084fc' }}>
          {appName}
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
        URL: {url || 'Not configured'}
      </Typography>

      {/* Main Status Indicators */}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2.5 }}>
        <Chip
          label={configured ? 'Configured' : 'Unconfigured'}
          size="small"
          color={configured ? 'success' : 'error'}
          variant="outlined"
          sx={{ height: 20, fontSize: '0.7rem' }}
        />
        <Chip
          label={reachable === null ? 'Reachable: Unchecked' : reachable ? 'Reachable' : 'Unreachable'}
          size="small"
          color={reachable === null ? 'default' : reachable ? 'success' : 'error'}
          variant="outlined"
          sx={{ height: 20, fontSize: '0.7rem' }}
        />
        <Chip
          label={manifestAvailable ? 'Manifest Available' : 'Manifest Missing'}
          size="small"
          color={manifestAvailable ? 'success' : 'warning'}
          variant="outlined"
          sx={{ height: 20, fontSize: '0.7rem' }}
        />
        <Chip
          label="Browser Observation: Future"
          size="small"
          color="default"
          variant="outlined"
          sx={{ height: 20, fontSize: '0.7rem', opacity: 0.6 }}
        />
      </Stack>

      <Divider sx={{ my: 1.5, borderColor: 'rgba(255, 255, 255, 0.06)' }} />

      {/* Truth Sources Section */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" sx={{ color: '#a1a1aa', fontWeight: 700, display: 'block', mb: 1 }}>
          Integration Truth Sources:
        </Typography>
        <Stack spacing={1}>
          {sourceLabels.map((sl) => (
            <Box
              key={sl.source}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                p: 1,
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
              }}
            >
              <Box sx={{ mr: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#e2e8f0', display: 'block' }}>
                  {sl.source === 'user-config'
                    ? 'Portal config'
                    : sl.source === 'url-preview'
                    ? 'Lightweight URL Ping'
                    : sl.source === 'manifest'
                    ? 'App-Native Manifest'
                    : 'Chrome Extension'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                  {sl.note}
                </Typography>
              </Box>
              <Chip
                label={sl.status.toUpperCase()}
                size="small"
                color={getSourceStatusColor(sl.status)}
                sx={{ height: 16, fontSize: '0.55rem', fontWeight: 800 }}
              />
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Manifest details if loaded */}
      {manifestAvailable && (
        <>
          <Divider sx={{ my: 1.5, borderColor: 'rgba(255, 255, 255, 0.06)' }} />
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="caption" sx={{ color: '#c084fc', fontWeight: 700 }}>
                Manifest Telemetry:
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontFamily: 'monospace' }}>
                {environment} / v{version}
              </Typography>
            </Box>

            {routes.length > 0 && (
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="caption" sx={{ color: '#a1a1aa', display: 'block', mb: 0.5 }}>
                  Active API Endpoints ({routes.length}):
                </Typography>
                <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                  {routes.slice(0, 5).map((r, idx) => (
                    <Chip
                      key={idx}
                      label={`${r.label || 'ANY'} ${r.path}`}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        fontFamily: 'monospace',
                        background: 'rgba(255, 255, 255, 0.03)',
                        color: '#cbd5e1',
                      }}
                    />
                  ))}
                  {routes.length > 5 && (
                    <Typography variant="caption" sx={{ color: '#94a3b8', alignSelf: 'center', fontSize: '0.65rem' }}>
                      +{routes.length - 5} more
                    </Typography>
                  )}
                </Stack>
              </Box>
            )}

            {features.length > 0 && (
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="caption" sx={{ color: '#a1a1aa', display: 'block', mb: 0.5 }}>
                  Ecosystem Modules:
                </Typography>
                <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                  {features.map((f) => (
                    <Chip
                      key={f.id}
                      label={f.label}
                      size="small"
                      variant="outlined"
                      sx={{ height: 18, fontSize: '0.65rem', color: '#818cf8', borderColor: 'rgba(129,140,248,0.2)' }}
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {workflows.length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ color: '#a1a1aa', display: 'block', mb: 0.5 }}>
                  Active Workflows:
                </Typography>
                <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                  {workflows.map((w) => (
                    <Chip
                      key={w.id}
                      label={w.label}
                      size="small"
                      sx={{ height: 18, fontSize: '0.65rem', background: 'rgba(16,185,129,0.1)', color: '#34d399' }}
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {health && (
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="caption" sx={{ color: '#a1a1aa', display: 'block', mb: 0.5 }}>
                  Health Metrics:
                </Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#34d399', display: 'block' }}>
                  {JSON.stringify(health)}
                </Typography>
              </Box>
            )}
          </Box>
        </>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Stack spacing={0.5} sx={{ mb: 2, mt: 1.5 }}>
          {warnings.map((warning, idx) => (
            <Typography key={idx} variant="caption" sx={{ color: '#fbbf24', display: 'block' }}>
              ⚠️ {warning}
            </Typography>
          ))}
        </Stack>
      )}

      <Divider sx={{ my: 1.5, borderColor: 'rgba(255, 255, 255, 0.06)' }} />

      {/* Persona Lenses */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" sx={{ color: '#a1a1aa', display: 'block', mb: 1 }}>
          Persona Lenses (Future View Modes):
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {personaLenses.map((lens) => (
            <Button
              key={lens}
              disabled
              size="small"
              sx={{
                height: 24,
                fontSize: '0.65rem',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.03)',
                color: 'rgba(255,255,255,0.3)',
                border: '1px solid rgba(255,255,255,0.06)',
                px: 1.5,
              }}
            >
              {lens.toUpperCase()}
            </Button>
          ))}
        </Stack>
      </Box>

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
