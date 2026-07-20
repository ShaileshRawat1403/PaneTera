import React from 'react';
import { Box, Typography, Button, Chip, Stack, Divider } from '@mui/material';
import type { LiveAppWorkbenchData } from '../../server/liveApp';

export interface LiveAppWorkbenchCardProps {
  data: LiveAppWorkbenchData;
  onCancel?: () => void;
  variant?: 'chat' | 'feed' | 'active';
  activeLens?: string;
}

export const LiveAppWorkbenchCard: React.FC<LiveAppWorkbenchCardProps> = ({
  data,
  onCancel,
  variant = 'chat',
  activeLens = 'engineer',
}) => {
  const {
    appName,
    url,
    configured,
    urlReachable,
    manifestReachable,
    manifestAvailable,
    environment,
    version,
    routes,
    features,
    workflows,
    health: healthRaw,
    sourceLabels,
    personaLenses,
    warnings,
  } = data;

  const health = healthRaw as any;

  // Visual emphasis highlights based on active lens
  const highlightEndpoints = activeLens === 'engineer';
  const highlightWorkflows = activeLens === 'pm' || activeLens === 'ba';
  const highlightEcosystem = activeLens === 'qa';
  const highlightHealth = activeLens === 'qa' || activeLens === 'exec';
  const highlightTruth = activeLens === 'exec';

  const filteredWarnings = warnings ? warnings.filter(w => 
    !(!manifestAvailable && urlReachable && (
      w.includes("404") || w.includes("manifest endpoint unavailable")
    ))
  ) : [];

  const getSourceStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return '#22c55e';
      case 'unavailable':
        return '#ef4444';
      case 'unverified':
        return '#fbbf24';
      case 'future':
      default:
        return '#71717a';
    }
  };

  return (
    <Box
      sx={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        p: 3,
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        '&:hover': {
          borderColor: 'rgba(127, 85, 240, 0.25)',
        }
      }}
    >
      {/* Title & Badge */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ color: '#7f5af0', fontWeight: 800, letterSpacing: '0.06em' }}>
            LIVE APP WORKBENCH (EXPERIMENTAL)
          </Typography>
          {health && (
            <Chip
              label={health.status.toUpperCase()}
              size="small"
              sx={{
                height: 16,
                fontSize: '0.55rem',
                fontWeight: 800,
                background: health.status === 'available' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                color: health.status === 'available' ? '#22c55e' : '#cbd5e1',
                border: health.status === 'available' ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid transparent',
              }}
            />
          )}
        </Box>
        <Chip
          label="PREVIEW ONLY"
          size="small"
          sx={{
            height: 18,
            fontSize: '0.65rem',
            fontWeight: 800,
            background: 'rgba(127, 85, 240, 0.08)',
            color: '#b794f4',
            border: '1px solid rgba(127, 85, 240, 0.18)',
          }}
        />
      </Box>

      {/* Identifiers */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#f4f4f5', letterSpacing: '-0.02em' }}>
          {appName}
        </Typography>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#71717a', display: 'block', mt: 0.5 }}>
          {url || 'Not configured'}
        </Typography>
      </Box>

      {/* Experimental Helper Copy */}
      <Box sx={{ mb: 2, p: 1.5, background: 'rgba(127, 85, 240, 0.03)', border: '1px solid rgba(127, 85, 240, 0.15)', borderRadius: '6px' }}>
        <Typography variant="caption" sx={{ color: '#cbd5e1', display: 'block', lineHeight: 1.4 }}>
          ℹ️ <strong>Experimental:</strong> live app manifest integration. Not required for local workspace inspection.
        </Typography>
      </Box>

      {!manifestAvailable && (
        <Box sx={{ mb: 2, p: 1.5, background: 'rgba(251, 191, 36, 0.05)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: '6px' }}>
          <Typography variant="caption" sx={{ color: '#fbbf24', display: 'block', lineHeight: 1.4 }}>
            ⚠️ This deployed app does not expose a Tessera manifest yet. Use Workspace Mission Control for local repo inspection.
          </Typography>
        </Box>
      )}

      {/* Main Status Indicators */}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
        <Chip
          label={configured ? 'Configured' : 'Unconfigured'}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.65rem',
            fontWeight: 600,
            background: configured ? 'rgba(34, 197, 94, 0.06)' : 'rgba(239, 68, 68, 0.06)',
            color: configured ? '#22c55e' : '#ef4444',
            border: `1px solid ${configured ? 'rgba(34, 197, 94, 0.18)' : 'rgba(239, 68, 68, 0.18)'}`,
          }}
        />
        <Chip
          label={urlReachable ? 'URL Reachable' : 'URL Unreachable'}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.65rem',
            fontWeight: 600,
            background: urlReachable ? 'rgba(34, 197, 94, 0.06)' : 'rgba(239, 68, 68, 0.06)',
            color: urlReachable ? '#22c55e' : '#ef4444',
            border: `1px solid ${urlReachable ? 'rgba(34, 197, 94, 0.18)' : 'rgba(239, 68, 68, 0.18)'}`,
          }}
        />
        <Chip
          label={manifestReachable ? 'Manifest Reachable' : 'Manifest Unreachable'}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.65rem',
            fontWeight: 600,
            background: manifestReachable ? 'rgba(34, 197, 94, 0.06)' : 'rgba(239, 68, 68, 0.06)',
            color: manifestReachable ? '#22c55e' : '#ef4444',
            border: `1px solid ${manifestReachable ? 'rgba(34, 197, 94, 0.18)' : 'rgba(239, 68, 68, 0.18)'}`,
          }}
        />
        <Chip
          label={manifestAvailable ? 'Manifest Available' : 'Manifest Missing'}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.65rem',
            fontWeight: 600,
            background: manifestAvailable ? 'rgba(34, 197, 94, 0.06)' : 'rgba(251, 191, 36, 0.06)',
            color: manifestAvailable ? '#22c55e' : '#fbbf24',
            border: `1px solid ${manifestAvailable ? 'rgba(34, 197, 94, 0.18)' : 'rgba(251, 191, 36, 0.18)'}`,
          }}
        />
      </Stack>

      <Divider sx={{ my: 2, borderColor: 'rgba(255, 255, 255, 0.06)' }} />

      {/* Integration Truth Sources */}
      <Box sx={{ mb: 2.5, opacity: highlightTruth ? 1 : 0.8, p: highlightTruth ? 1.5 : 0, borderRadius: '8px', border: highlightTruth ? '1px solid rgba(127, 85, 240, 0.3)' : 'none', background: highlightTruth ? 'rgba(127, 85, 240, 0.02)' : 'none' }}>
        <Typography variant="caption" sx={{ color: highlightTruth ? '#b794f4' : '#a1a1aa', fontWeight: 800, display: 'block', mb: 1.5 }}>
          Integration Truth Sources {highlightTruth && '— Focused Lens'}
        </Typography>
        <Stack spacing={1}>
          {sourceLabels.map((sl) => (
            <Box
              key={sl.source}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1,
                px: 1.5,
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
              }}
            >
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#e2e8f0', display: 'block' }}>
                  {sl.source === 'user-config'
                    ? 'Portal config'
                    : sl.source === 'url-preview'
                    ? 'Lightweight URL Ping'
                    : sl.source === 'manifest'
                    ? 'App-Native Manifest'
                    : 'Chrome Extension'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#71717a', fontSize: '0.65rem' }}>
                  {sl.note}
                </Typography>
              </Box>
              <Chip
                label={sl.status.toUpperCase()}
                size="small"
                sx={{
                  height: 16,
                  fontSize: '0.55rem',
                  fontWeight: 800,
                  background: 'rgba(255,255,255,0.03)',
                  color: getSourceStatusColor(sl.status)
                }}
              />
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Manifest details if loaded */}
      {manifestAvailable && (
        <>
          {/* Active endpoints */}
          <Box sx={{ mb: 2, opacity: highlightEndpoints ? 1 : 0.8, p: highlightEndpoints ? 1.5 : 0, borderRadius: '8px', border: highlightEndpoints ? '1px solid rgba(127, 85, 240, 0.3)' : 'none', background: highlightEndpoints ? 'rgba(127, 85, 240, 0.02)' : 'none' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: highlightEndpoints ? '#b794f4' : '#a1a1aa', fontWeight: 800 }}>
                Active Endpoints ({routes.length}) {highlightEndpoints && '— Focused Lens'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#71717a', fontFamily: 'monospace' }}>
                {environment} / v{version}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
              {routes.slice(0, 5).map((r, idx) => (
                <Chip
                  key={idx}
                  label={`${r.label || 'ANY'} ${r.path}`}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.6rem',
                    fontFamily: 'monospace',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    color: '#cbd5e1',
                  }}
                />
              ))}
            </Stack>
          </Box>

          {/* Ecosystem modules */}
          <Box sx={{ mb: 2, opacity: highlightEcosystem ? 1 : 0.8, p: highlightEcosystem ? 1.5 : 0, borderRadius: '8px', border: highlightEcosystem ? '1px solid rgba(127, 85, 240, 0.3)' : 'none', background: highlightEcosystem ? 'rgba(127, 85, 240, 0.02)' : 'none' }}>
            <Typography variant="caption" sx={{ color: highlightEcosystem ? '#b794f4' : '#a1a1aa', fontWeight: 800, display: 'block', mb: 1 }}>
              Ecosystem Modules ({features.length}) {highlightEcosystem && '— Focused Lens'}
            </Typography>
            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
              {features.map((f) => (
                <Chip
                  key={f.id}
                  label={f.label}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.6rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    color: '#cbd5e1',
                  }}
                />
              ))}
            </Stack>
          </Box>

          {/* Active workflows */}
          <Box sx={{ mb: 2, opacity: highlightWorkflows ? 1 : 0.8, p: highlightWorkflows ? 1.5 : 0, borderRadius: '8px', border: highlightWorkflows ? '1px solid rgba(127, 85, 240, 0.3)' : 'none', background: highlightWorkflows ? 'rgba(127, 85, 240, 0.02)' : 'none' }}>
            <Typography variant="caption" sx={{ color: highlightWorkflows ? '#b794f4' : '#a1a1aa', fontWeight: 800, display: 'block', mb: 1 }}>
              Governed Workflows ({workflows.length}) {highlightWorkflows && '— Focused Lens'}
            </Typography>
            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
              {workflows.map((w) => (
                <Chip
                  key={w.id}
                  label={w.label}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.6rem',
                    background: 'rgba(34, 197, 94, 0.05)',
                    color: '#22c55e',
                    border: '1px solid rgba(34, 197, 94, 0.15)',
                  }}
                />
              ))}
            </Stack>
          </Box>

          {/* Health metrics */}
          {health && (
            <Box sx={{ mb: 2, opacity: highlightHealth ? 1 : 0.8, p: highlightHealth ? 1.5 : 0, borderRadius: '8px', border: highlightHealth ? '1px solid rgba(127, 85, 240, 0.3)' : 'none', background: highlightHealth ? 'rgba(127, 85, 240, 0.02)' : 'none' }}>
              <Typography variant="caption" sx={{ color: highlightHealth ? '#b794f4' : '#a1a1aa', fontWeight: 800, display: 'block', mb: 1 }}>
                Health Check Endpoint {highlightHealth && '— Focused Lens'}
              </Typography>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#22c55e', display: 'block', mt: 0.5 }}>
                {health.endpoint} [Status: Available]
              </Typography>
            </Box>
          )}
        </>
      )}

      {/* Friendly message if manifest is missing but app is reachable */}
      {!manifestAvailable && urlReachable && (
        <Box sx={{ p: 1.8, mb: 2, background: 'rgba(127, 85, 240, 0.05)', border: '1px solid rgba(127, 85, 240, 0.25)', borderRadius: '8px' }}>
          <Typography variant="body2" sx={{ color: '#cbd5e1', fontSize: '0.78rem', lineHeight: 1.4 }}>
            Live app is reachable, but it does not expose a PaneTera manifest yet. Local project inspection is still available.
          </Typography>
        </Box>
      )}

      {/* Warnings block (only show if filtered warnings exist) */}
      {filteredWarnings.length > 0 && (
        <Box sx={{ p: 1.5, mb: 2, background: 'rgba(251, 191, 36, 0.05)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: '8px' }}>
          <Stack spacing={0.5}>
            {filteredWarnings.map((warning, idx) => (
              <Typography key={idx} variant="caption" sx={{ color: '#fbbf24', display: 'block' }}>
                ⚠️ {warning}
              </Typography>
            ))}
          </Stack>
        </Box>
      )}

      <Divider sx={{ my: 2, borderColor: 'rgba(255, 255, 255, 0.06)' }} />

      {/* Persona lenses selectors display (readout format) */}
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="caption" sx={{ color: '#71717a', display: 'block', mb: 1 }}>
          Persona Lenses (Current Context: {activeLens.toUpperCase()})
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {personaLenses.map((lens) => (
            <Chip
              key={lens}
              label={lens.toUpperCase()}
              size="small"
              variant={activeLens === lens ? 'filled' : 'outlined'}
              sx={{
                height: 20,
                fontSize: '0.55rem',
                fontWeight: 700,
                color: activeLens === lens ? '#b794f4' : 'rgba(255,255,255,0.3)',
                borderColor: activeLens === lens ? 'rgba(127, 85, 240, 0.3)' : 'rgba(255,255,255,0.06)',
                background: activeLens === lens ? 'rgba(127, 85, 240, 0.12)' : 'transparent',
              }}
            />
          ))}
        </Stack>
      </Box>

      {/* Footer controls */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          size="small"
          variant="contained"
          disabled
          sx={{
            background: 'rgba(255, 255, 255, 0.04)',
            color: 'rgba(255, 255, 255, 0.3) !important',
            borderRadius: '6px',
            textTransform: 'none',
            fontSize: '0.75rem',
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
              color: '#71717a',
              borderColor: 'rgba(255,255,255,0.1)',
              borderRadius: '6px',
              textTransform: 'none',
              fontSize: '0.75rem',
              '&:hover': {
                borderColor: 'rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.02)',
              },
            }}
          >
            Dismiss
          </Button>
        )}
      </Box>
    </Box>
  );
};
