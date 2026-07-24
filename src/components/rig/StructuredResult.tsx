import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { ink, surface, typography } from '../../theme/cssTokens';
import { inspectStructuredResult } from '../../rig/inspect';

interface StructuredResultProps {
  value: unknown;
  label?: string;
}

export function StructuredResult({ value, label = 'Untrusted MCP result' }: StructuredResultProps): React.ReactElement {
  const text = useMemo(() => JSON.stringify(inspectStructuredResult(value), null, 2), [value]);
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" sx={{ color: ink.secondary }}>{label}</Typography>
      <Box
        component="pre"
        tabIndex={0}
        aria-label={label}
        sx={{
          m: 0,
          mt: 0.5,
          p: 1,
          maxHeight: 280,
          overflow: 'auto',
          border: `1px solid ${surface.border}`,
          color: ink.secondary,
          backgroundColor: surface.sunken,
          fontFamily: typography.mono,
          fontSize: 11,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {text}
      </Box>
    </Box>
  );
}
