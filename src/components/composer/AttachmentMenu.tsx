// src/components/composer/AttachmentMenu.tsx
// The `+` menu. Adds context, and only adds context.
//
// Every row here does something. The previous version listed image, evidence,
// MCP resource and live application as permanently disabled entries that
// explained their own absence in implementation language, which turned a menu
// into a roadmap: four rows to read and dismiss before reaching the two that
// worked.
//
// Models, agents, servers and permanent connections are absent by design. Those
// belong to Rig. This menu means "bring something into this conversation", and
// nothing in it reaches the intent resolver.

import React from 'react';
import { Box, Menu, MenuItem, Typography } from '@mui/material';
import { attachmentOptions, noProjectsExplanation } from '../../composer/contextTypes';
import type { AttachmentAvailability, ContextKind } from '../../composer/contextTypes';
import { ink } from '../../theme/cssTokens';

interface Props {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onDismiss?: () => void;
  onChoose: (kind: ContextKind) => void;
  availability: AttachmentAvailability;
}

export const AttachmentMenu: React.FC<Props> = ({
  anchorEl,
  open,
  onClose,
  onDismiss,
  onChoose,
  availability,
}) => {
  const options = attachmentOptions(availability);
  const emptyExplanation = noProjectsExplanation(availability);
  const pendingChoice = React.useRef<ContextKind | null>(null);

  const finishClose = () => {
    const choice = pendingChoice.current;
    pendingChoice.current = null;
    if (choice) onChoose(choice);
    else onDismiss?.();
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      MenuListProps={{ 'aria-label': 'Add context', dense: true }}
      // MUI returns focus to the trigger when a Menu closes. For "Paste text or
      // note" and "Add web link" that fights the editor those choices open:
      // focus landed back on the Add context button while a text field was
      // waiting for input. The chosen surface focuses itself instead.
      disableRestoreFocus
      TransitionProps={{ onExited: finishClose }}
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      slotProps={{ paper: { sx: { minWidth: 232 } } }}
    >
      {options.map((option) => (
        <MenuItem
          key={option.kind}
          onClick={() => {
            // Mount inline editors only after the Menu has finished exiting.
            // Mounting them before this point lets the closing Modal move
            // focus away after the editor's autoFocus has already run.
            pendingChoice.current = option.kind;
            onClose();
          }}
          sx={{ py: 0.875, px: 1.25, fontSize: 13.5 }}
        >
          {option.label}
        </MenuItem>
      ))}

      {/*
        One sentence, shown only when it is true. Not a disabled row, because a
        disabled row invites clicking and explains nothing about what to do.
      */}
      {emptyExplanation && (
        <Box sx={{ px: 1.5, py: 1, maxWidth: 260 }}>
          <Typography variant="caption" sx={{ color: ink.secondary, lineHeight: 1.5 }}>
            {emptyExplanation}
          </Typography>
        </Box>
      )}
    </Menu>
  );
};
