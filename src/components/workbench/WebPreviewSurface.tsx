// src/components/workbench/WebPreviewSurface.tsx
// The untrusted public web preview.
//
// Migrated to theme tokens in the Phase 3 pass. The brass palette is
// deliberate: an untrusted surface is an attention state, not a neutral one,
// and brass is what the contract reserves for attention. It should not read as
// an ordinary panel.

import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Chip, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import LanguageIcon from '@mui/icons-material/Language';
import BlockIcon from '@mui/icons-material/Block';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { BrowserEvidenceSurface } from './BrowserEvidenceSurface';
import { BrowserLiveSurface } from './BrowserLiveSurface';
import type { BrowserEvidenceRecord } from './browserEvidenceSurfaceModel';
import type { BrowserLiveFrame } from '../../utils/browserOperatorBridge';
import { resolvePublicWebPreviewSandbox } from '../../utils/webPreviewIntent';
import { accent, ink, radius, status, surface, typography } from '../../theme/cssTokens';
import { transition } from '../../theme/motion';
import {
  type OperatorAvailability,
  type PreviewRemedy,
  type WebPreviewOutcome,
  presentPreviewStatus,
  presentOutcome,
} from './webPreviewOutcome';

interface WebPreviewSurfaceProps {
  name: string;
  url: string;
  onClose: () => void;
  /** Whether Browser Operator can be offered as an alternative route in. */
  operator?: OperatorAvailability;
  /** Invoked when the person asks to inspect the page instead of framing it. */
  onInspectWithOperator?: () => void;
  /** Invoked when the person asks to connect Browser Operator. */
  onConnectOperator?: () => void;
  /**
   * Reported once the probe settles.
   *
   * The surface owns the probe and tells the app what it found. An earlier
   * version had both run their own, which meant the message and the canvas
   * could describe different outcomes for the same page.
   */
  onOutcome?: (outcome: WebPreviewOutcome) => void;
  /** Injectable so the outcome logic can be tested without a network. */
  probe?: (url: string) => Promise<WebPreviewOutcome>;
  inspection?:
    | { kind: 'idle' }
    | { kind: 'requesting' }
    | { kind: 'live'; frame: BrowserLiveFrame }
    | { kind: 'evidence'; record: BrowserEvidenceRecord }
    | { kind: 'error'; detail: string };
  onClearEvidence?: () => void;
}

export function WebPreviewSurface({
  name,
  url,
  onClose,
  operator = 'not-connected',
  onInspectWithOperator,
  onConnectOperator,
  onOutcome,
  probe,
  inspection = { kind: 'idle' },
  onClearEvidence,
}: WebPreviewSurfaceProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const [embedRevealed, setEmbedRevealed] = useState(false);
  const [outcome, setOutcome] = useState<WebPreviewOutcome>({ kind: 'checking' });
  const portalOrigin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  const sandbox = resolvePublicWebPreviewSandbox(url, portalOrigin);

  const reload = useCallback(() => {
    onClearEvidence?.();
    setEmbedRevealed(false);
    setReloadKey((current) => current + 1);
  }, [onClearEvidence]);

  useEffect(() => {
    let cancelled = false;
    setOutcome({ kind: 'checking' });
    setEmbedRevealed(false);

    const run =
      probe ??
      (async (target: string): Promise<WebPreviewOutcome> => {
        // The probe route sits behind the master-token boundary, so the token
        // is required. Without it every probe returned 401 and every page was
        // reported unreachable, including ones that frame perfectly well.
        const token =
          typeof window === 'undefined' ? '' : localStorage.getItem('panetera-token') ?? '';
        try {
          const response = await fetch('/api/web-preview/probe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ url: target }),
          });
          if (!response.ok) {
            // A probe that cannot run has established nothing. Attempt the
            // frame and let the permanent status offer a way out, rather than reporting a
            // refusal or a failure that was never observed.
            return { kind: 'permitted' };
          }
          const body = await response.json();
          return (body?.outcome as WebPreviewOutcome) ?? { kind: 'permitted' };
        } catch {
          return { kind: 'permitted' };
        }
      });

    run(url).then((result) => {
      if (cancelled) return;
      setOutcome(result);
      if (result.kind === 'permitted') {
        setEmbedRevealed(true);
      }
      onOutcome?.(result);
    });

    return () => {
      cancelled = true;
    };
    // `onOutcome` is deliberately excluded: it is a reporting callback, and
    // including it would re-probe whenever the parent re-rendered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, reloadKey, probe]);

  const presentation = presentOutcome(outcome, { siteName: name, operator });
  const previewStatus = presentPreviewStatus({ siteName: name, operator });
  const hasOperatorSurface = inspection.kind === 'live' || inspection.kind === 'evidence';

  const runRemedy = (kind: string) => {
    if (inspection.kind === 'requesting') return;
    if (kind === 'retry') return reload();
    if (kind === 'inspect-with-operator') return onInspectWithOperator?.();
    if (kind === 'connect-operator') return onConnectOperator?.();
  };

  const renderRemedy = (remedy: PreviewRemedy, size: 'small' = 'small') =>
    remedy.kind === 'open-in-browser' ? (
      <Button
        key={remedy.kind}
        size={size}
        variant={remedy.primary ? 'contained' : 'outlined'}
        startIcon={<OpenInNewIcon />}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {remedy.label}
      </Button>
    ) : (
      <Button
        key={remedy.kind}
        size={size}
        variant={remedy.primary ? 'contained' : 'outlined'}
        onClick={() => runRemedy(remedy.kind)}
        disabled={inspection.kind === 'requesting'}
      >
        {remedy.label}
      </Button>
    );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        backgroundColor: surface.base,
      }}
    >
      <Box
        sx={{
          minHeight: 56,
          px: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          borderBottom: `1px solid ${surface.border}`,
          backgroundColor: surface.raised,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          <LanguageIcon sx={{ color: ink.secondary, fontSize: 20 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ color: ink.primary, fontWeight: 600 }} noWrap>
              {name}
            </Typography>
            {/* The address is an identifier, so it renders in the mono face. */}
            <Typography
              variant="caption"
              sx={{ color: ink.secondary, display: 'block', fontFamily: typography.mono }}
              noWrap
            >
              {url}
            </Typography>
          </Box>
          <Tooltip title="External page. No credentials or PaneTera authority are shared.">
            <Chip
              label="External · untrusted"
              size="small"
              sx={{
                display: { xs: 'none', lg: 'inline-flex' },
                height: 22,
                color: status.brass,
                backgroundColor: status.brassMuted,
                border: `1px solid ${status.brass}`,
                borderRadius: `${radius.sm}px`,
              }}
            />
          </Tooltip>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Tooltip title="Reload preview">
            <IconButton onClick={reload} aria-label="Reload website preview" sx={{ color: ink.secondary }}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            startIcon={<OpenInNewIcon />}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: accent.violet, ml: 0.5 }}
          >
            Open in browser
          </Button>
          <Tooltip title="Close preview">
            <IconButton
              onClick={onClose}
              aria-label="Close website preview"
              sx={{ color: ink.secondary, ml: 0.5 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/*
        The white ground applies only when a page is actually rendering, because
        white is the site's own canvas rather than PaneTera's. A degraded state
        is PaneTera speaking, so it keeps PaneTera's surface. The previous
        version kept the white ground unconditionally, which is what turned a
        framing refusal into a blank white rectangle with nothing to read.
      */}
      <Box
        sx={{
          flexGrow: 1,
          minHeight: 0,
          backgroundColor: surface.base,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {inspection.kind === 'evidence' && (
          <BrowserEvidenceSurface
            record={inspection.record}
            onReturnToPreview={() => onClearEvidence?.()}
          />
        )}

        {inspection.kind === 'live' && (
          <BrowserLiveSurface
            initialFrame={inspection.frame}
            onClose={() => onClearEvidence?.()}
          />
        )}

        {!hasOperatorSurface && presentation.showFrame && !embedRevealed && (
          <Box
            role="region"
            aria-label="Website viewing options"
            sx={{
              flexGrow: 1,
              minHeight: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: { xs: 2, md: 4 },
              backgroundColor: surface.base,
            }}
          >
            <Box
              sx={{
                width: '100%',
                maxWidth: 680,
                border: `1px solid ${surface.border}`,
                borderRadius: `${radius.lg}px`,
                backgroundColor: surface.raised,
                p: { xs: 2.5, md: 3.5 },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    flexShrink: 0,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: `${radius.md}px`,
                    color: status.brass,
                    backgroundColor: status.brassMuted,
                  }}
                >
                  <ShieldOutlinedIcon fontSize="small" />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h6" sx={{ color: ink.primary, fontWeight: 650, lineHeight: 1.3 }}>
                    How would you like to view this page?
                  </Typography>
                  <Typography variant="body2" sx={{ color: ink.secondary, lineHeight: 1.65, mt: 0.75 }}>
                    Embedded previews are quick, but some sites return a blank frame. Browser Operator is
                    the reliable route: it asks for approval, opens the real page in Chrome, and mirrors it here.
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mt: 3 }}>
                {previewStatus.remedies.slice(0, 1).map((remedy) => renderRemedy(remedy))}
                {sandbox && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<VisibilityOutlinedIcon />}
                    onClick={() => setEmbedRevealed(true)}
                  >
                    Try embedded preview
                  </Button>
                )}
                {previewStatus.remedies.slice(1).map((remedy) => renderRemedy(remedy))}
              </Box>

              <Typography variant="caption" sx={{ color: ink.muted, display: 'block', mt: 2 }}>
                No site credentials or PaneTera authority are passed to the embedded preview.
              </Typography>
            </Box>
          </Box>
        )}

        {!hasOperatorSurface && presentation.showFrame && embedRevealed && sandbox && (
          <Box
            sx={{
              flexGrow: 1,
              minHeight: 0,
              // eslint-disable-next-line no-restricted-syntax -- the guest page paints its own ground; PaneTera's theme must not tint it
              backgroundColor: '#ffffff',
            }}
          >
            <iframe
              key={reloadKey}
              src={url}
              title={`${name} website preview`}
              sandbox={sandbox}
              referrerPolicy="strict-origin-when-cross-origin"
              // eslint-disable-next-line no-restricted-syntax -- see above: the embedded document owns this surface
              style={{ width: '100%', height: '100%', border: 0, background: '#ffffff' }}
            />
          </Box>
        )}

        {!hasOperatorSurface && presentation.showFrame && embedRevealed && (
          <Box
            role="status"
            sx={{
              flexShrink: 0,
              px: 2,
              py: 1,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 1,
              backgroundColor: surface.raised,
              borderTop: `1px solid ${surface.border}`,
            }}
          >
            <Typography variant="caption" sx={{ color: ink.secondary, flexGrow: 1, minWidth: 240 }}>
              {inspection.kind === 'requesting'
                ? 'Waiting for Browser Operator approval…'
                : inspection.kind === 'error'
                  ? `Inspection did not complete: ${inspection.detail}`
                  : previewStatus.detail}
            </Typography>
            {inspection.kind === 'requesting' ? (
              <CircularProgress size={18} sx={{ color: status.brass }} />
            ) : (
              previewStatus.remedies.map((remedy) => renderRemedy(remedy))
            )}
          </Box>
        )}

        {!hasOperatorSurface && !presentation.showFrame && (
          <Box
            role={outcome.kind === 'checking' ? 'status' : 'alert'}
            aria-live="polite"
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              px: 4,
              gap: 1.5,
              transition: transition(['opacity']),
            }}
          >
            {outcome.kind === 'checking' ? (
              <CircularProgress size={22} sx={{ color: ink.muted }} />
            ) : (
              <BlockIcon sx={{ fontSize: 32, color: status.brass }} />
            )}

            <Typography variant="subtitle1" sx={{ color: ink.primary, fontWeight: 600 }}>
              {presentation.headline}
            </Typography>

            <Typography variant="body2" sx={{ color: ink.secondary, maxWidth: 460 }}>
              {presentation.detail}
            </Typography>

            {inspection.kind === 'requesting' && (
              <Typography role="status" variant="caption" sx={{ color: status.brass }}>
                Waiting for Browser Operator approval…
              </Typography>
            )}
            {inspection.kind === 'error' && (
              <Typography role="alert" variant="caption" sx={{ color: status.danger }}>
                Inspection did not complete: {inspection.detail}
              </Typography>
            )}

            {presentation.remedies.length > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1,
                  justifyContent: 'center',
                  mt: 0.5,
                }}
              >
                {presentation.remedies.map((remedy) => renderRemedy(remedy))}
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
