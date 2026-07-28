// src/components/schema/widgets/MetricGroupWidget.tsx
import React from 'react';
import { Box, Paper, Typography, Grid, Chip } from '@mui/material';
import { PaneTeraCardSchema } from '../../../../shared/schemaTypes';
import { accent, ink, radius, status, surface } from '../../../theme/cssTokens';

interface MetricItem {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  status?: 'ok' | 'warn' | 'bad';
}

interface MetricGroupWidgetProps {
  schema: PaneTeraCardSchema;
  data: {
    metrics?: MetricItem[];
  };
  onAction?: (actionId: string, payload: Record<string, unknown>) => void;
}

export const MetricGroupWidget: React.FC<MetricGroupWidgetProps> = ({ schema, data }) => {
  const metrics = data.metrics || [];

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        backgroundColor: surface.raised,
        borderColor: surface.border,
        borderRadius: `${radius.md}px`,
        backdropFilter: 'blur(12px)',
        transition: 'border-color 200ms ease, box-shadow 200ms ease',
        '&:hover': {
          borderColor: surface.borderStrong,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, pb: 1.5, borderBottom: `1px solid ${surface.border}` }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 650, color: ink.primary }}>
            {schema.title || 'Metrics & Operations Dashboard'}
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
              backgroundColor: status.successMuted,
              color: status.success,
              border: `1px solid ${status.success}`,
            }}
          />
        )}
      </Box>

      <Grid container spacing={2}>
        {metrics.map((m) => {
          const statusBg =
            m.status === 'ok' ? status.successMuted : m.status === 'warn' ? status.brassMuted : status.dangerMuted;
          const statusColor =
            m.status === 'ok' ? status.success : m.status === 'warn' ? status.brass : status.danger;

          return (
            <Grid item xs={12} sm={6} md={3} key={m.id}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  backgroundColor: surface.sunken,
                  borderColor: surface.border,
                  borderRadius: `${radius.sm}px`,
                  display: 'flex',
                  flexDirection: 'column',
                  justify: 'space-between',
                  transition: 'border-color 150ms ease, transform 150ms ease',
                  '&:hover': {
                    borderColor: surface.borderStrong,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <Typography variant="caption" sx={{ color: ink.secondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {m.label}
                </Typography>
                <Box sx={{ my: 1, display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: ink.primary }}>
                    {m.value}
                  </Typography>
                  {m.unit && (
                    <Typography variant="caption" sx={{ color: ink.secondary }}>
                      {m.unit}
                    </Typography>
                  )}
                </Box>
                {m.change && (
                  <Chip
                    label={`${m.trend === 'up' ? '↑' : m.trend === 'down' ? '↓' : '•'} ${m.change}`}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                      fontWeight: 650,
                      alignSelf: 'flex-start',
                      backgroundColor: statusBg,
                      color: statusColor,
                      border: `1px solid ${statusColor}`,
                    }}
                  />
                )}
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Paper>
  );
};
