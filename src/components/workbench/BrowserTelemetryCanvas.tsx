import React, { useState } from 'react';
import { Box, Typography, Button, Chip } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SpeedIcon from '@mui/icons-material/Speed';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { surface, ink, accent, status, radius, elevation, typography } from '../../theme/cssTokens';

export interface TelemetryData {
  url: string;
  viewportWidth: number;
  viewportHeight: number;
  fps: number;
  domElementsCount: number;
  layoutStabilityScore: number;
}

interface BrowserTelemetryCanvasProps {
  telemetry?: TelemetryData;
  onCaptureEvidence?: (telemetry: TelemetryData) => void;
}

const DEFAULT_TELEMETRY: TelemetryData = {
  url: 'http://127.0.0.1:3000/app',
  viewportWidth: 1280,
  viewportHeight: 800,
  fps: 60,
  domElementsCount: 142,
  layoutStabilityScore: 0.98,
};

export function BrowserTelemetryCanvas({
  telemetry = DEFAULT_TELEMETRY,
  onCaptureEvidence,
}: BrowserTelemetryCanvasProps) {
  const [captured, setCaptured] = useState(false);

  const handleCapture = async () => {
    setCaptured(true);
    // Send telemetry as a browser observation to the governed pipeline
    try {
      await fetch('/api/browser/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: crypto.randomUUID(),
          idempotencyKey: crypto.randomUUID(),
          capability: 'browser.telemetry.capture',
          isPhase1: true,
          target: { tabId: 0, frameId: 0, expectedOrigin: 'https://local' },
          payload: {
            title: 'Browser Telemetry Capture',
            url: 'pane://telemetry',
            origin: 'https://local',
            selectedText: JSON.stringify(telemetry),
          },
          capturedAt: new Date().toISOString(),
        }),
      });
    } catch {
      // Silent — telemetry capture is best-effort
    }
    if (onCaptureEvidence) {
      onCaptureEvidence(telemetry);
    }
    setTimeout(() => setCaptured(false), 3000);
  };

  return (
    <Box
      sx={{
        p: 3,
        backgroundColor: surface.raised,
        border: `1px solid ${surface.border}`,
        borderRadius: `${radius.md}px`,
        boxShadow: elevation.card,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <VisibilityIcon sx={{ color: accent.violet, fontSize: 22 }} />
          <Box>
            <Typography variant="h6" sx={{ color: ink.primary, fontWeight: 600, fontSize: '16px' }}>
              Browser Visual Observation & Telemetry
            </Typography>
            <Typography variant="caption" sx={{ color: ink.muted }}>
              Actionable visual evidence metrics captured from active browser session
            </Typography>
          </Box>
        </Box>

        <Button
          variant="contained"
          size="small"
          onClick={handleCapture}
          startIcon={captured ? <CheckCircleIcon /> : <CameraAltIcon />}
          sx={{
            backgroundColor: captured ? status.success : accent.violet,
            '&:hover': { backgroundColor: captured ? status.success : accent.violetHover },
            textTransform: 'none',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: `${radius.sm}px`,
            px: 2,
          }}
        >
          {captured ? 'Evidence Captured' : 'Capture Visual Evidence'}
        </Button>
      </Box>

      {/* Grid Metrics */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
        <Box sx={{ p: 2, backgroundColor: surface.sunken, borderRadius: `${radius.sm}px`, border: `1px solid ${surface.border}` }}>
          <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 600, display: 'block', mb: 0.5 }}>
            TARGET URL
          </Typography>
          <Typography variant="body2" sx={{ color: ink.primary, fontFamily: typography.mono, wordBreak: 'break-all' }}>
            {telemetry.url}
          </Typography>
        </Box>

        <Box sx={{ p: 2, backgroundColor: surface.sunken, borderRadius: `${radius.sm}px`, border: `1px solid ${surface.border}` }}>
          <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 600, display: 'block', mb: 0.5 }}>
            VIEWPORT RESOLUTION
          </Typography>
          <Typography variant="body2" sx={{ color: ink.primary, fontWeight: 600 }}>
            {telemetry.viewportWidth} × {telemetry.viewportHeight} px
          </Typography>
        </Box>

        <Box sx={{ p: 2, backgroundColor: surface.sunken, borderRadius: `${radius.sm}px`, border: `1px solid ${surface.border}` }}>
          <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 600, display: 'block', mb: 0.5 }}>
            RENDERING STABILITY (FPS)
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SpeedIcon sx={{ fontSize: 16, color: ink.secondary }} />
            <Typography variant="body2" sx={{ color: ink.secondary, fontWeight: 600 }}>
              {telemetry.fps} FPS ({Math.round(telemetry.layoutStabilityScore * 100)}% stability)
            </Typography>
          </Box>
        </Box>

        <Box sx={{ p: 2, backgroundColor: surface.sunken, borderRadius: `${radius.sm}px`, border: `1px solid ${surface.border}` }}>
          <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 600, display: 'block', mb: 0.5 }}>
            DOM NODES COUNT
          </Typography>
          <Chip
            label={`${telemetry.domElementsCount} active elements`}
            size="small"
            sx={{
              backgroundColor: surface.canvas,
              color: ink.secondary,
              border: `1px solid ${surface.border}`,
              fontSize: '11px',
              fontWeight: 500,
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
