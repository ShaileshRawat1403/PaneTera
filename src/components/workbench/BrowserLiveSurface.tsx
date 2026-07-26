import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import {
  type BrowserInspectedComponent,
  type BrowserLiveFrame,
  requestBrowserLiveCommand,
} from '../../utils/browserOperatorBridge';
import { accent, ink, radius, status, surface, typography } from '../../theme/cssTokens';

interface BrowserLiveSurfaceProps {
  initialFrame: BrowserLiveFrame;
  onClose: () => void;
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" sx={{ color: ink.muted, display: 'block' }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: ink.primary,
          fontFamily: mono ? typography.mono : undefined,
          overflowWrap: 'anywhere',
        }}
      >
        {value || '—'}
      </Typography>
    </Box>
  );
}

export function BrowserLiveSurface({ initialFrame, onClose }: BrowserLiveSurfaceProps) {
  const [frame, setFrame] = useState(initialFrame);
  const [component, setComponent] = useState<BrowserInspectedComponent | null>(null);
  const [inspectMode, setInspectMode] = useState(false);
  const [clickMode, setClickMode] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [captured, setCaptured] = useState(false);
  const inFlight = useRef(false);

  const captureAsEvidence = async () => {
    try {
      const resp = await fetch('/api/browser/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: crypto.randomUUID(),
          idempotencyKey: crypto.randomUUID(),
          capability: 'browser.dom.observe',
          isPhase1: true,
          target: { tabId: 0, frameId: 0, expectedOrigin: new URL(frame.url).origin },
          payload: {
            title: frame.title,
            url: frame.url,
            origin: new URL(frame.url).origin,
            selectedText: '',
          },
          capturedAt: frame.capturedAt,
        }),
      });
      if (resp.ok) setCaptured(true);
    } catch {
      // Silent — evidence capture is best-effort from the live surface
    }
  };

  const run = async (action: 'snapshot' | 'focus') => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      const result = await requestBrowserLiveCommand(frame.sessionId, action);
      if (action === 'snapshot' && result && 'screenshotDataUrl' in result) {
        setFrame(result as BrowserLiveFrame);
      }
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  const handleScroll = async (direction: 'up' | 'down') => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      const result = await requestBrowserLiveCommand(frame.sessionId, 'scroll', { direction });
      if (result && 'screenshotDataUrl' in result) {
        setFrame(result as BrowserLiveFrame);
      }
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) void run('snapshot');
    }, 2_500);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.sessionId]);

  const handleImageClick = async (event: React.MouseEvent<HTMLImageElement>) => {
    if (inFlight.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const xRatio = (event.clientX - rect.left) / Math.max(rect.width, 1);
    const yRatio = (event.clientY - rect.top) / Math.max(rect.height, 1);

    if (inspectMode) {
      inFlight.current = true;
      setPending(true);
      try {
        const result = await requestBrowserLiveCommand(frame.sessionId, 'inspect', { xRatio, yRatio });
        setComponent(result as BrowserInspectedComponent);
        setError('');
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        inFlight.current = false;
        setPending(false);
      }
      return;
    }

    if (clickMode) {
      inFlight.current = true;
      setPending(true);
      try {
        const result = await requestBrowserLiveCommand(frame.sessionId, 'click', { xRatio, yRatio });
        if (result && 'screenshotDataUrl' in result) {
          setFrame(result as BrowserLiveFrame);
        }
        setError('');
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    }
  };

  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', backgroundColor: surface.base }}>
      <Box
        role="status"
        sx={{
          px: 2,
          py: 1,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
          borderBottom: `1px solid ${surface.border}`,
          backgroundColor: surface.raised,
        }}
      >
        <Chip
          size="small"
          label="Real Chrome · untrusted"
          sx={{ color: status.brass, backgroundColor: status.brassMuted, fontWeight: 650 }}
        />
        <Typography variant="caption" sx={{ color: ink.secondary, flexGrow: 1 }}>
          Mirrored from a managed Chrome tab. Page scripts run in Chrome, not in PaneTera.
        </Typography>
        <Button
          size="small"
          variant={clickMode ? 'contained' : 'outlined'}
          startIcon={<TouchAppIcon fontSize="small" />}
          onClick={() => {
            setClickMode(prev => !prev);
            if (!clickMode) setInspectMode(false);
          }}
          aria-pressed={clickMode}
          sx={{
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': { transform: 'scale(1.02)' },
          }}
        >
          {clickMode ? 'Click Mode Active' : 'Click Mode'}
        </Button>
        <Button
          size="small"
          variant={inspectMode ? 'contained' : 'outlined'}
          startIcon={<SearchIcon />}
          onClick={() => {
            setInspectMode(prev => !prev);
            if (!inspectMode) setClickMode(false);
          }}
          aria-pressed={inspectMode}
          sx={{
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': { transform: 'scale(1.02)' },
          }}
        >
          {inspectMode ? 'Inspecting' : 'Inspect elements'}
        </Button>
        <Tooltip title="Refresh the live frame">
          <span>
            <IconButton
              size="small"
              aria-label="Refresh real Chrome frame"
              disabled={pending}
              onClick={() => void run('snapshot')}
              sx={{ transition: 'all 0.2s ease', '&:hover': { transform: 'rotate(45deg)' } }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ArrowDownwardIcon fontSize="small" />}
          disabled={pending}
          onClick={() => void handleScroll('down')}
          sx={{
            transition: 'all 0.2s ease',
            '&:hover': { transform: 'translateY(1px)' },
          }}
        >
          Scroll Down
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ArrowUpwardIcon fontSize="small" />}
          disabled={pending}
          onClick={() => void handleScroll('up')}
          sx={{
            transition: 'all 0.2s ease',
            '&:hover': { transform: 'translateY(-1px)' },
          }}
        >
          Scroll Up
        </Button>
        <Button size="small" startIcon={<OpenInNewIcon />} onClick={() => void run('focus')}>
          Open Chrome tab
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={captureAsEvidence}
          disabled={captured}
        >
          {captured ? 'Captured' : 'Capture as evidence'}
        </Button>
        <Button size="small" color="error" startIcon={<StopCircleOutlinedIcon />} onClick={onClose}>
          End live view
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ borderRadius: 0 }}>{error}</Alert>}

      <Box sx={{ flexGrow: 1, minHeight: 0, display: 'grid', gridTemplateColumns: component ? { xs: '1fr', lg: 'minmax(0, 1fr) 340px' } : '1fr' }}>
        <Box
          sx={{
            minWidth: 0,
            minHeight: 0,
            overflow: 'auto',
            p: { xs: 1, md: 2 },
            backgroundColor: surface.canvas,
          }}
        >
          <Box sx={{ maxWidth: frame.viewport.width, mx: 'auto', position: 'relative' }}>
            <Box
              component="img"
              src={frame.screenshotDataUrl}
              alt={`Live Chrome view of ${frame.title}`}
              onClick={handleImageClick}
              sx={{
                width: '100%',
                height: 'auto',
                display: 'block',
                cursor: inspectMode ? 'crosshair' : clickMode ? 'pointer' : 'default',
                border: `1px solid ${inspectMode ? accent.violet : clickMode ? accent.violetBorder : surface.border}`,
                borderRadius: `${radius.sm}px`,
                boxShadow: inspectMode ? `0 0 0 2px ${accent.violetSelected}` : clickMode ? `0 0 12px ${accent.violetMuted}` : 'none',
              }}
            />
            {pending && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  px: 1,
                  py: 0.5,
                  borderRadius: `${radius.sm}px`,
                  color: ink.primary,
                  backgroundColor: surface.overlay,
                  border: `1px solid ${surface.border}`,
                }}
              >
                <Typography variant="caption">Syncing…</Typography>
              </Box>
            )}
          </Box>
        </Box>

        {component && (
          <Box
            component="aside"
            aria-label="Inspected webpage component"
            sx={{
              minWidth: 0,
              minHeight: 0,
              overflowY: 'auto',
              borderLeft: { lg: `1px solid ${surface.border}` },
              borderTop: { xs: `1px solid ${surface.border}`, lg: 0 },
              backgroundColor: surface.raised,
              p: 2,
            }}
          >
            <Stack spacing={1.5}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CenterFocusStrongIcon sx={{ color: accent.violet }} />
                <Typography variant="subtitle2" sx={{ color: ink.primary, fontWeight: 650 }}>
                  Selected component
                </Typography>
              </Box>
              <Fact label="Element" value={`<${component.tagName}>`} mono />
              <Fact label="DOM path" value={component.path} mono />
              {component.role && <Fact label="Accessibility role" value={component.role} />}
              {component.id && <Fact label="ID" value={component.id} mono />}
              {component.classNames.length > 0 && <Fact label="Classes" value={component.classNames.join(' ')} mono />}
              {component.text && <Fact label="Visible text" value={component.text} />}
              <Divider />
              <Typography variant="caption" sx={{ color: ink.secondary, fontWeight: 650 }}>
                Computed presentation
              </Typography>
              {Object.entries(component.styles).map(([key, value]) => (
                <Fact key={key} label={key} value={value} mono />
              ))}
              {Object.keys(component.attributes).length > 0 && (
                <>
                  <Divider />
                  <Typography variant="caption" sx={{ color: ink.secondary, fontWeight: 650 }}>
                    Safe attributes
                  </Typography>
                  {Object.entries(component.attributes).map(([key, value]) => (
                    <Fact key={key} label={key} value={value} mono />
                  ))}
                </>
              )}
            </Stack>
          </Box>
        )}
      </Box>

      <Box
        sx={{
          px: 2,
          py: 0.75,
          flexShrink: 0,
          display: 'flex',
          gap: 1,
          alignItems: 'center',
          borderTop: `1px solid ${surface.border}`,
          backgroundColor: surface.raised,
        }}
      >
        <Typography variant="caption" sx={{ color: ink.secondary, flexGrow: 1 }} noWrap>
          {frame.title} · {frame.url}
        </Typography>
        <Typography variant="caption" sx={{ color: ink.muted }}>
          {new Date(frame.capturedAt).toLocaleTimeString()}
        </Typography>
      </Box>
    </Box>
  );
}
