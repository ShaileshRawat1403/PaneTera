// src/components/composer/AttachmentPicker.tsx
// Durable project selection only.
//
// Local files and folders never enter this component. App asks the backend to
// open the operating system's native picker and receives an explicit one-off
// selection grant. Keeping those paths separate makes their authority visible:
// a project is a durable workspace, while a file or folder is selected context.

import React from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  Typography,
} from '@mui/material';
import type { AttachableWorkspace } from '../../composer/contextTypes';
import { accent, ink, radius, surface, typography } from '../../theme/tokens';
import { transition } from '../../theme/motion';

export type PickerKind = 'project';

export interface AttachmentPickerProps {
  kind: PickerKind | null;
  projects: readonly AttachableWorkspace[];
  onCancel: () => void;
  onExited?: () => void;
  onChoose: (selection: { kind: PickerKind; project: AttachableWorkspace }) => void;
}

export function AttachmentPicker({
  kind,
  projects,
  onCancel,
  onExited,
  onChoose,
}: AttachmentPickerProps): React.ReactElement {
  return (
    <Dialog
      open={kind === 'project'}
      onClose={onCancel}
      fullWidth
      maxWidth="sm"
      aria-labelledby="project-picker-title"
      TransitionProps={{ onExited }}
      PaperProps={{
        sx: {
          backgroundColor: surface.raised,
          border: `1px solid ${surface.border}`,
          borderRadius: `${radius.lg}px`,
        },
      }}
    >
      <DialogTitle id="project-picker-title" sx={{ color: ink.primary, fontSize: '1rem' }}>
        Choose a project
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: surface.border, minHeight: 220 }}>
        {projects.length === 0 ? (
          <Typography variant="body2" sx={{ color: ink.secondary }}>
            No projects are registered yet.
          </Typography>
        ) : (
          <List disablePadding aria-label="Registered projects">
            {projects.map((project) => (
              <ListItemButton
                key={project.id}
                onClick={() => onChoose({ kind: 'project', project })}
                sx={{
                  borderRadius: `${radius.sm}px`,
                  py: 0.75,
                  transition: transition(['background-color']),
                  '&:hover': { backgroundColor: accent.violetMuted },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ color: ink.primary }}>
                    {project.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: ink.secondary, fontFamily: typography.mono, fontSize: 11 }}
                    noWrap
                  >
                    {project.path}
                  </Typography>
                </Box>
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
