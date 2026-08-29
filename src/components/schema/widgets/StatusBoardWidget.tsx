// src/components/schema/widgets/StatusBoardWidget.tsx
import React, { useState } from 'react';
import { Box, Paper, Typography, Grid, Chip, Stack } from '@mui/material';
import { PaneTeraCardSchema } from '../../../../shared/schemaTypes';
import { accent, ink, radius, status, surface, typography } from '../../../theme/cssTokens';

interface Column {
  id: string;
  name: string;
  color?: string;
}

interface BoardItem {
  id: string;
  columnId: string;
  title: string;
  subtitle?: string;
  status?: 'ok' | 'warn' | 'bad' | 'info';
  metadata?: Record<string, string>;
}

interface StatusBoardWidgetProps {
  schema: PaneTeraCardSchema;
  data: {
    columns?: Column[];
    items?: BoardItem[];
  };
  onAction?: (actionId: string, payload: Record<string, unknown>) => void;
}

export const StatusBoardWidget: React.FC<StatusBoardWidgetProps> = ({ schema, data }) => {
  const columns = data.columns || [
    { id: 'backlog', name: 'Backlog', color: ink.muted },
    { id: 'in_progress', name: 'In Progress', color: accent.violet },
    { id: 'review', name: 'Under Review', color: status.brass },
    { id: 'completed', name: 'Completed', color: status.success },
  ];

  const [items] = useState<BoardItem[]>(data.items || []);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        backgroundColor: surface.raised,
        borderColor: surface.border,
        borderRadius: `${radius.md}px`,
        transition: 'border-color 200ms ease, box-shadow 200ms ease',
        '&:hover': {
          borderColor: surface.borderStrong,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, pb: 1.5, borderBottom: `1px solid ${surface.border}` }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 650, color: ink.primary }}>
            {schema.title || 'Status Pipeline Board'}
          </Typography>
          {schema.description && (
            <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mt: 0.5 }}>
              {schema.description}
            </Typography>
          )}
        </Box>
        {schema.renderHints?.badge && (
          <Chip
            label={schema.renderHints.badge}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              fontWeight: 700,
              backgroundColor: accent.violetMuted,
              color: accent.violet,
              border: `1px solid ${accent.violetBorder}`,
            }}
          />
        )}
      </Box>

      <Grid container spacing={2}>
        {columns.map((col) => {
          const colItems = items.filter((item) => item.columnId === col.id);
          return (
            <Grid item xs={12} sm={6} md={3} key={col.id}>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  backgroundColor: surface.sunken,
                  borderColor: surface.border,
                  borderRadius: `${radius.sm}px`,
                  minHeight: 180,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, pb: 1, borderBottom: `1px solid ${surface.border}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: col.color || accent.violet }} />
                    <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: ink.secondary }}>
                      {col.name}
                    </Typography>
                  </Box>
                  <Chip label={colItems.length} size="small" sx={{ height: 16, fontSize: '0.6rem', backgroundColor: surface.raised, color: ink.muted }} />
                </Box>

                <Stack spacing={1.5} sx={{ flexGrow: 1 }}>
                  {colItems.length === 0 ? (
                    <Typography variant="caption" sx={{ color: ink.muted, fontStyle: 'italic', textAlign: 'center', py: 3, display: 'block' }}>
                      No items
                    </Typography>
                  ) : (
                    colItems.map((item) => (
                      <Paper
                        key={item.id}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          backgroundColor: surface.raised,
                          borderColor: surface.border,
                          borderRadius: `${radius.sm}px`,
                          transition: 'border-color 150ms ease, transform 150ms ease',
                          '&:hover': {
                            borderColor: surface.borderStrong,
                            transform: 'translateY(-1px)',
                          },
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600, color: ink.primary }}>
                          {item.title}
                        </Typography>
                        {item.subtitle && (
                          <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mt: 0.5 }}>
                            {item.subtitle}
                          </Typography>
                        )}
                        {item.metadata && (
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                            {Object.entries(item.metadata).map(([k, v]) => (
                              <Chip
                                key={k}
                                label={`${k}: ${v}`}
                                size="small"
                                sx={{ height: 16, fontSize: '0.6rem', fontFamily: typography.mono, backgroundColor: surface.sunken, color: ink.secondary }}
                              />
                            ))}
                          </Stack>
                        )}
                      </Paper>
                    ))
                  )}
                </Stack>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Paper>
  );
};
