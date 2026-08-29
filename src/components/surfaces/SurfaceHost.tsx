// src/components/surfaces/SurfaceHost.tsx
//
// Where a surface is seen: the frame that pairs a SurfaceDescriptor's header
// with that surface's body.
//
// App.tsx has always had a SurfaceHost, it just was not called one. The canvas
// is chosen by a conditional chain -- web preview, then local app, then
// evidence, then the active UiComponent, then the workspace, then the empty
// canvas -- and each branch brought its own bespoke chrome. That is why a
// browser preview, a local application and an artifact each looked like a
// different product: nothing made them agree.
//
// This makes the host explicit and gives every branch one header. It is
// deliberately thin, and it is migrated into one branch at a time rather than
// replacing the chain wholesale. The browser branch is first; the rest keep
// their current chrome until each is moved.
//
// WHAT IT DOES NOT DO
//
// It holds no state, resolves no source, and executes nothing. It does not own
// browser, Rig, workspace or provenance state -- those stay authoritative
// where they live, and the descriptor is only a projection of them. Actions
// leave through onAction as metadata, exactly as they do in SurfaceHeader, so
// hosting a surface never becomes a way to act on one.
//
// The body arrives as children. That is the migration affordance: a surface
// can adopt the shared header without first being rewritten to render from a
// typed payload. The destination is a renderer selected from
// descriptor.renderer.type, and PaneTera will own that selection -- external
// systems supply typed data, never components. Until a surface is payload
// driven, children keeps the step small enough to verify.

import React from 'react';
import { Box } from '@mui/material';
import { surface } from '../../theme/cssTokens';
import { SurfaceHeader } from './SurfaceHeader';
import type { SurfaceAction, SurfaceDescriptor } from '../../surfaces/types';

export interface SurfaceHostProps {
  descriptor: SurfaceDescriptor;
  /** The surface's body. Rendered beneath the shared header, filling the frame. */
  children: React.ReactNode;
  /** Reported when a header action is chosen. The host decides what it means. */
  onAction?: (action: SurfaceAction) => void;
  onSplit?: () => void;
  onClose?: () => void;
}

export function SurfaceHost({
  descriptor,
  children,
  onAction,
  onSplit,
  onClose,
}: SurfaceHostProps): React.ReactElement {
  return (
    <Box
      data-testid="surface-host"
      data-surface-kind={descriptor.kind}
      data-surface-id={descriptor.id}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        backgroundColor: surface.base,
      }}
    >
      <SurfaceHeader
        descriptor={descriptor}
        onAction={onAction}
        onSplit={onSplit}
        onClose={onClose}
      />

      {/*
        The body owns the rest of the frame. minHeight:0 matters: without it a
        flex child refuses to shrink below its content, and a surface holding a
        tall iframe or a long log would push the header off the top rather than
        scrolling inside its own box.
      */}
      <Box sx={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </Box>
    </Box>
  );
}
