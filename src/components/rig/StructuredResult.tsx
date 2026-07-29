import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { ink, radius, surface, typography } from '../../theme/cssTokens';
import { inspectStructuredResult } from '../../rig/inspect';

interface StructuredResultProps {
  value: unknown;
  label?: string;
}

export function StructuredResult({ value, label = 'Untrusted MCP result' }: StructuredResultProps): React.ReactElement {
  const text = useMemo(() => JSON.stringify(inspectStructuredResult(value), null, 2), [value]);
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" sx={{ color: ink.secondary, fontWeight: 600, mb: 0.5, display: 'block' }}>
        {label}
      </Typography>
      <Box
        component="pre"
        tabIndex={0}
        aria-label={label}
        sx={{
          m: 0,
          p: 1.5,
          maxHeight: 280,
          overflow: 'auto',
          border: `1px solid ${surface.border}`,
          borderRadius: `${radius.sm}px`,
          color: ink.secondary,
          backgroundColor: surface.sunken,
          fontFamily: typography.mono,
          fontSize: '0.7rem',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          lineHeight: 1.5,
        }}
      >
        {text}
      </Box>
    </Box>
  );
}
