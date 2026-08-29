// src/components/schema/widgets/DiffWidget.tsx
import React from 'react';
import { Box, Paper, Typography, Stack } from '@mui/material';
import { PaneTeraCardSchema } from '../../../../shared/schemaTypes';
import { ink, radius, status, surface, typography } from '../../../theme/cssTokens';

interface DiffLine {
  type: 'add' | 'delete' | 'same';
  leftLine?: number;
  rightLine?: number;
  content: string;
}

interface DiffWidgetProps {
  schema: PaneTeraCardSchema;
  data: {
    leftTitle?: string;
    rightTitle?: string;
    lines?: DiffLine[];
  };
  onAction?: (actionId: string, payload: Record<string, unknown>) => void;
}

export const DiffWidget: React.FC<DiffWidgetProps> = ({ schema, data }) => {
  const lines = data.lines || [];

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        backgroundColor: surface.raised,
        borderColor: surface.border,
        borderRadius: `${radius.md}px`,
        transition: 'border-color 200ms ease',
        '&:hover': {
          borderColor: surface.borderStrong,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, pb: 1.5, borderBottom: `1px solid ${surface.border}` }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 650, color: ink.primary }}>
            {schema.title || 'Side-by-Side Comparison'}
          </Typography>
          {schema.description && (
            <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mt: 0.5 }}>
              {schema.description}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={2}>
          <Typography variant="caption" sx={{ fontFamily: typography.mono, color: status.danger, fontWeight: 600 }}>
            {data.leftTitle || 'Before'}
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: typography.mono, color: status.success, fontWeight: 600 }}>
            {data.rightTitle || 'After'}
          </Typography>
        </Stack>
      </Box>

      <Paper
        variant="outlined"
        sx={{
          backgroundColor: surface.sunken,
          borderColor: surface.border,
          borderRadius: `${radius.sm}px`,
          fontFamily: typography.mono,
          fontSize: '0.75rem',
          maxHeight: 360,
          overflowY: 'auto',
          p: 1,
        }}
      >
        <Stack spacing={0.25}>
          {lines.map((line, idx) => {
            const isAdd = line.type === 'add';
            const isDel = line.type === 'delete';

            const bg = isAdd ? status.successMuted : isDel ? status.dangerMuted : 'transparent';
            const color = isAdd ? status.success : isDel ? status.danger : ink.secondary;
            const prefix = isAdd ? '+' : isDel ? '-' : ' ';

            return (
              <Box
                key={idx}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 1,
                  py: 0.25,
                  borderRadius: '2px',
                  backgroundColor: bg,
                  borderLeft: isAdd ? `3px solid ${status.success}` : isDel ? `3px solid ${status.danger}` : '3px solid transparent',
                }}
              >
                <Typography variant="caption" sx={{ width: 24, textAlign: 'right', color: ink.disabled, fontFamily: typography.mono, userSelect: 'none' }}>
                  {line.leftLine || ''}
                </Typography>
                <Typography variant="caption" sx={{ width: 24, textAlign: 'right', color: ink.disabled, fontFamily: typography.mono, userSelect: 'none' }}>
                  {line.rightLine || ''}
                </Typography>
                <Typography variant="caption" sx={{ width: 12, fontWeight: 700, color, fontFamily: typography.mono, userSelect: 'none' }}>
                  {prefix}
                </Typography>
                <Typography variant="caption" sx={{ fontFamily: typography.mono, color, whiteSpace: 'pre', flexGrow: 1 }}>
                  {line.content}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      </Paper>
    </Paper>
  );
};
