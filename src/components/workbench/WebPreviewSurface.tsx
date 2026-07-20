// src/components/workbench/WebPreviewSurface.tsx
// The untrusted public web preview.
//
// Migrated to theme tokens in the Phase 3 pass. The brass palette is
// deliberate: an untrusted surface is an attention state, not a neutral one,
// and brass is what the contract reserves for attention. It should not read as
// an ordinary panel.

import React, { useState } from 'react';
import { Box, Button, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import LanguageIcon from '@mui/icons-material/Language';
import { resolvePublicWebPreviewSandbox } from '../../utils/webPreviewIntent';
import { accent, ink, radius, status, surface, typography } from '../../theme/tokens';

interface WebPreviewSurfaceProps {
  name: string;
  url: string;
  onClose: () => void;
}

export function WebPreviewSurface({ name, url, onClose }: WebPreviewSurfaceProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const portalOrigin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  const sandbox = resolvePublicWebPreviewSandbox(url, portalOrigin);

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
          <Chip
            label="Untrusted web preview"
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
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Tooltip title="Reload preview">
            <IconButton
              onClick={() => setReloadKey(current => current + 1)}
              aria-label="Reload website preview"
              sx={{ color: ink.secondary }}
            >
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

      <Box
        sx={{
          px: 2,
          py: 0.75,
          color: ink.secondary,
          backgroundColor: status.brassMuted,
          borderBottom: `1px solid ${surface.border}`,
        }}
      >
        <Typography variant="caption">
          This public website keeps its own origin but receives no PaneTera authority or
          credentials. If framing is refused, use “Open in browser”.
        </Typography>
      </Box>

      {/*
        The iframe keeps a white ground because that is the site's own canvas,
        not PaneTera's. Tinting it would misrepresent someone else's page as
        part of this product.
      */}
      <Box sx={{ flexGrow: 1, minHeight: 0, backgroundColor: '#ffffff' }}>
        {sandbox && (
          <iframe
            key={reloadKey}
            src={url}
            title={`${name} website preview`}
            sandbox={sandbox}
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ width: '100%', height: '100%', border: 0, background: '#ffffff' }}
          />
        )}
      </Box>
    </Box>
  );
}
