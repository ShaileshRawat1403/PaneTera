// src/components/composer/WebLinkEntry.tsx
// Inline entry for attaching a public web address as a reference.
//
// Explicit Add and Cancel, deliberately. There is no commit-on-blur here for
// the same reason the note editor lost it: blur fires against the pre-update
// value when focus moves, so "did it attach or not" becomes a race the person
// cannot see.
//
// Attaching a link alone does not act. A later submitted question may open the
// preview and request explicit Browser Operator inspection for this address.

import React, { useState } from 'react';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';
import { describeWebLinkRejection, resolveWebLink } from '../../composer/webLink';
import { elevation, ink, radius, status, surface } from '../../theme/cssTokens';
import { enterStyles } from '../../theme/motion';

interface Props {
  onAdd: (link: { url: string; label: string }) => void;
  onCancel: () => void;
}

export const WebLinkEntry: React.FC<Props> = ({ onAdd, onCancel }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const result = resolveWebLink(value);
    if (!result.ok) {
      setError(describeWebLinkRejection(result.reason));
      return;
    }
    // Normalised before it leaves this surface, so the tray never holds the
    // raw typed string.
    onAdd({ url: result.url, label: result.label });
  };

  return (
    <Paper
      sx={{
        p: 1.25,
        mb: 1,
        borderRadius: `${radius.md}px`,
        backgroundColor: surface.overlay,
        border: `1px solid ${surface.border}`,
        boxShadow: elevation.raised,
        ...enterStyles(),
      }}
    >
      <TextField
        fullWidth
        size="small"
        autoFocus
        placeholder="https://example.com"
        value={value}
        error={Boolean(error)}
        onChange={(event) => {
          setValue(event.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            submit();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          }
        }}
        inputProps={{ 'aria-label': 'Web address' }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
        <Typography variant="caption" sx={{ color: ink.secondary, flex: 1 }}>
          {/*
            Says what attaching does and does not do. Without this the chip
            could be read as "PaneTera has this page".
          */}
          Attaches the address as a reference. The page is not read or opened.
        </Typography>
        <Button size="small" onClick={onCancel} sx={{ color: ink.secondary }}>
          Cancel
        </Button>
        <Button size="small" variant="contained" disableElevation onClick={submit}>
          Add
        </Button>
      </Box>

      {error && (
        <Typography
          role="alert"
          variant="caption"
          sx={{ color: status.danger, display: 'block', mt: 0.75 }}
        >
          {error}
        </Typography>
      )}
    </Paper>
  );
};
