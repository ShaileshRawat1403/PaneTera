import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  Stack,
  Typography,
} from '@mui/material';
import { accent, ink, radius, surface, typography } from '../../theme/cssTokens';
import { transition } from '../../theme/motion';
import type { RigResourceChoice } from '../../rig/types';

interface McpResourcePickerProps {
  open: boolean;
  resources: readonly RigResourceChoice[];
  loading: boolean;
  error: string | null;
  onCancel: () => void;
  onExited?: () => void;
  onChoose: (resource: RigResourceChoice) => void;
}

export function McpResourcePicker({
  open,
  resources,
  loading,
  error,
  onCancel,
  onExited,
  onChoose,
}: McpResourcePickerProps): React.ReactElement {
  return (
    <Dialog open={open} onClose={onCancel} TransitionProps={{ onExited }} fullWidth maxWidth="sm" aria-labelledby="mcp-resource-picker-title">
      <DialogTitle id="mcp-resource-picker-title">Choose an MCP resource</DialogTitle>
      <DialogContent dividers sx={{ borderColor: surface.border, minHeight: 220 }}>
        {loading && <Typography role="status" variant="body2" sx={{ color: ink.secondary }}>Loading enabled resources…</Typography>}
        {error && <Typography role="alert" variant="body2" sx={{ color: ink.primary }}>{error}</Typography>}
        {!loading && !error && resources.length === 0 && (
          <Typography variant="body2" sx={{ color: ink.secondary }}>
            No enabled MCP resources are available. Enable one in Rig first.
          </Typography>
        )}
        <List disablePadding aria-label="Enabled MCP resources">
          {resources.map((resource) => (
            <ListItemButton
              key={`${resource.connectionId}:${resource.capabilityId}`}
              onClick={() => onChoose(resource)}
              sx={{ borderRadius: `${radius.sm}px`, transition: transition(['background-color']), '&:hover': { backgroundColor: accent.violetMuted } }}
            >
              <Stack sx={{ minWidth: 0 }}>
                <Typography variant="body2">{resource.label}</Typography>
                <Typography variant="caption" sx={{ color: ink.secondary }}>{resource.connectionName}</Typography>
                <Typography variant="caption" noWrap sx={{ color: ink.secondary, fontFamily: typography.mono }}>{resource.uri}</Typography>
              </Stack>
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
}
