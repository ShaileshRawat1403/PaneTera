// src/components/composer/ContextChips.tsx
// Removable, includable context chips.
//
// A chip is a reference to something brought into the work. Removing a chip
// mutates no source data. Excluding a chip withholds it from the next message
// without dropping it from the tray.
//
// Excluded chips are dimmed and struck through rather than hidden, because the
// user chose to keep them; hiding would make exclusion look like removal.

import React from 'react';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import type { ContextItem } from '../../composer/contextTypes';
import { accent, ink, radius, status, surface, typography } from '../../theme/cssTokens';
import { chipEnterStyles, transition } from '../../theme/motion';

interface Props {
  items: readonly ContextItem[];
  onRemove: (id: string) => void;
  onToggleIncluded: (id: string, included: boolean) => void;
}

function materializationLabel(item: ContextItem): string {
  switch (item.materialization.mode) {
    case 'reference':
      return 'Reference only, no content sent';
    case 'inline': {
      const measurement = item.materialization.measurement;
      if (measurement.unit === 'bytes') return `Inline, ${measurement.value} bytes`;
      if (measurement.unit === 'tokens') return `Inline, ${measurement.value} tokens`;
      return 'Inline, size not measured';
    }
    case 'retrieved':
      return 'Retrieved on demand';
    default:
      return 'Unknown';
  }
}

/**
 * Freshness colour.
 *
 * `not-measured` is deliberately neutral rather than green. The contract
 * reserves green for meaningful success, and "we have no way to check this" is
 * not a success.
 */
function freshnessColor(item: ContextItem): string {
  switch (item.freshness) {
    case 'current':
      return status.success;
    case 'needs-review':
      return status.brass;
    case 'stale':
      return status.danger;
    default:
      return status.neutral;
  }
}

function chipTitle(item: ContextItem): string {
  return [
    `Source: ${item.source.locator}`,
    `Access: ${item.access}`,
    `Authority: ${item.authority}`,
    `Freshness: ${item.freshness}`,
    materializationLabel(item),
    item.included ? 'Included in next message' : 'Excluded from next message',
  ].join('\n');
}

export const ContextChips: React.FC<Props> = ({ items, onRemove, onToggleIncluded }) => {
  if (items.length === 0) return null;

  return (
    <Box
      component="ul"
      aria-label="Attached context"
      sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, listStyle: 'none', p: 0, m: 0, mb: 1 }}
    >
      {items.map((item) => (
        <Box component="li" key={item.id} sx={{ display: 'flex', ...chipEnterStyles() }}>
          <Tooltip
            title={<span style={{ whiteSpace: 'pre-line' }}>{chipTitle(item)}</span>}
            enterDelay={400}
          >
            <Chip
              size="small"
              icon={
                <Box
                  component="span"
                  aria-hidden
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    ml: 1,
                    flexShrink: 0,
                    backgroundColor: freshnessColor(item),
                    transition: transition(['background-color']),
                  }}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                  <Typography component="span" sx={{ fontSize: 12.5, color: 'inherit' }}>
                    {item.label}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{ fontSize: 11, color: ink.muted, fontFamily: typography.mono }}
                  >
                    {item.kind}
                  </Typography>
                </Box>
              }
              onClick={() => onToggleIncluded(item.id, !item.included)}
              onDelete={() => onRemove(item.id)}
              aria-label={`${item.label}, ${item.kind}, ${
                item.included ? 'included' : 'excluded'
              }. Activate to ${item.included ? 'exclude' : 'include'}.`}
              sx={{
                height: 26,
                pl: 0.25,
                borderRadius: `${radius.sm}px`,
                color: item.included ? ink.primary : ink.muted,
                backgroundColor: item.included ? accent.violetMuted : 'transparent',
                border: `1px solid ${item.included ? accent.violetBorder : surface.border}`,
                transition: transition(['background-color', 'border-color', 'color', 'opacity']),
                '& .MuiChip-label': {
                  textDecoration: item.included ? 'none' : 'line-through',
                  textDecorationColor: ink.muted,
                },
                '& .MuiChip-deleteIcon': {
                  fontSize: 15,
                  color: ink.muted,
                  transition: transition(['color']),
                  '&:hover': { color: status.danger },
                },
                '&:hover': {
                  backgroundColor: item.included ? accent.violetHover : surface.overlay,
                  borderColor: item.included ? accent.violetBorder : surface.borderStrong,
                },
                '&:focus-visible': {
                  outline: 'none',
                  borderColor: accent.violet,
                  boxShadow: `0 0 0 3px ${accent.violetMuted}`,
                },
              }}
            />
          </Tooltip>
        </Box>
      ))}
    </Box>
  );
};
