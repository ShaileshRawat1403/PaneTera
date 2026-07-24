// src/components/composer/SlashMenu.tsx
// Keyboard-navigable `/` command menu.
//
// The menu selects a command. It does not resolve intent, execute anything, or
// decide readiness. Choosing an entry writes text into the composer, and the
// resolver sees that text exactly as if it had been typed.

import React from 'react';
import { Box, List, ListItemButton, Paper, Typography } from '@mui/material';
import type { SlashCommand } from '../../composer/slashCommands';
import { accent, elevation, ink, radius, surface, typography } from '../../theme/cssTokens';
import { enterStyles, transition } from '../../theme/motion';

interface Props {
  commands: SlashCommand[];
  activeIndex: number;
  onSelect: (command: SlashCommand) => void;
  onPointIndex: (index: number) => void;
  listId: string;
  optionId: (index: number) => string;
}

const panelSx = {
  mb: 1,
  borderRadius: `${radius.md}px`,
  backgroundColor: surface.overlay,
  border: `1px solid ${surface.border}`,
  boxShadow: elevation.overlay,
  overflow: 'hidden',
  ...enterStyles(),
} as const;

export const SlashMenu: React.FC<Props> = ({
  commands,
  activeIndex,
  onSelect,
  onPointIndex,
  listId,
  optionId,
}) => {
  // Last pointer position seen inside the menu. Null until the pointer moves,
  // so a menu opening beneath a resting cursor changes nothing.
  const lastPointer = React.useRef<{ x: number; y: number } | null>(null);

  if (commands.length === 0) {
    return (
      <Paper sx={{ ...panelSx, px: 2, py: 1.5 }}>
        <Typography variant="caption" sx={{ color: ink.muted }}>
          No matching actions.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={panelSx}>
      <List
        id={listId}
        role="listbox"
        aria-label="Composer actions"
        dense
        disablePadding
        sx={{ p: 0.5, maxHeight: 280, overflowY: 'auto' }}
      >
        {commands.map((command, index) => {
          const active = index === activeIndex;
          return (
            <ListItemButton
              key={command.name}
              id={optionId(index)}
              role="option"
              aria-selected={active}
              selected={active}
              onMouseMove={(event) => {
                // `mousemove` still fires once on mount in some browsers if the
                // pointer is inside the new element, so the coordinates are
                // compared against the last seen position. No movement, no
                // selection change.
                const { clientX, clientY } = event;
                const last = lastPointer.current;
                if (last && last.x === clientX && last.y === clientY) return;
                lastPointer.current = { x: clientX, y: clientY };
                onPointIndex(index);
              }}
              onClick={() => onSelect(command)}
              sx={{
                borderRadius: `${radius.sm}px`,
                px: 1.25,
                py: 0.875,
                gap: 1.5,
                alignItems: 'baseline',
                transition: transition(['background-color', 'box-shadow']),
                // A left marker rather than a full-bleed fill: it marks position
                // without repainting the row, which is quieter to arrow through.
                boxShadow: active ? `inset 2px 0 0 ${accent.violet}` : 'none',
                '&.Mui-selected': { backgroundColor: accent.violetMuted },
                '&.Mui-selected:hover': { backgroundColor: accent.violetHover },
                '&:hover': { backgroundColor: accent.violetMuted },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, minWidth: 168 }}>
                {/* Monospace is correct here: these are identifiers a user types. */}
                <Typography
                  component="span"
                  sx={{
                    fontFamily: typography.mono,
                    fontSize: 13,
                    color: active ? ink.primary : ink.secondary,
                    transition: transition(['color']),
                  }}
                >
                  /{command.name}
                </Typography>
                {command.argHint && (
                  <Typography
                    component="span"
                    sx={{ fontFamily: typography.mono, fontSize: 12, color: ink.muted }}
                  >
                    {`<${command.argHint}>`}
                  </Typography>
                )}
              </Box>
              <Typography
                component="span"
                sx={{ fontSize: 12.5, color: ink.muted, lineHeight: 1.4 }}
              >
                {command.summary}
              </Typography>
            </ListItemButton>
          );
        })}
      </List>
    </Paper>
  );
};
