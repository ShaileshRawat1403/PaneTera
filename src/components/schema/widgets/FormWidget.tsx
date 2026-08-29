// src/components/schema/widgets/FormWidget.tsx
import React, { useState } from 'react';
import { Box, Paper, Typography, TextField, MenuItem, Button, Stack } from '@mui/material';
import { PaneTeraCardSchema } from '../../../../shared/schemaTypes';
import { accent, ink, radius, surface } from '../../../theme/cssTokens';

interface FormWidgetProps {
  schema: PaneTeraCardSchema;
  data: Record<string, unknown>;
  onAction?: (actionId: string, payload: Record<string, unknown>) => void;
}

export const FormWidget: React.FC<FormWidgetProps> = ({ schema, data, onAction }) => {
  const [formData, setFormData] = useState<Record<string, unknown>>(data || {});

  const handleChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onAction) {
      onAction('submit_form', { formData });
    }
  };

  return (
    <Paper
      component="form"
      onSubmit={handleSubmit}
      variant="outlined"
      sx={{
        p: 3,
        backgroundColor: surface.raised,
        borderColor: surface.border,
        borderRadius: `${radius.md}px`,
        transition: 'border-color 200ms ease',
        '&:hover': {
          borderColor: surface.borderStrong,
        },
      }}
    >
      <Box sx={{ mb: 2, pb: 1.5, borderBottom: `1px solid ${surface.border}` }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 650, color: ink.primary }}>
          {schema.title || 'Schema Input Form'}
        </Typography>
        {schema.description && (
          <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mt: 0.5 }}>
            {schema.description}
          </Typography>
        )}
      </Box>

      <Stack spacing={2.5}>
        {schema.fields.map((f) => {
          const val = formData[f.name] !== undefined ? String(formData[f.name]) : f.defaultValue !== undefined ? String(f.defaultValue) : '';

          return (
            <Box key={f.name}>
              {f.options && f.options.length > 0 ? (
                <TextField
                  select
                  fullWidth
                  size="small"
                  label={f.label || f.name}
                  value={val}
                  onChange={(e) => handleChange(f.name, e.target.value)}
                  required={f.required}
                  helperText={f.description}
                  FormHelperTextProps={{ sx: { color: ink.muted, fontSize: '0.7rem' } }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: surface.sunken,
                      '& fieldset': { borderColor: surface.border },
                    },
                    '& .MuiInputLabel-root': { color: ink.secondary },
                  }}
                >
                  <MenuItem value="">
                    <em>Select option...</em>
                  </MenuItem>
                  {f.options.map((opt) => (
                    <MenuItem key={String(opt.value)} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <TextField
                  fullWidth
                  size="small"
                  type={f.type === 'number' ? 'number' : 'text'}
                  label={f.label || f.name}
                  value={val}
                  placeholder={f.placeholder || `Enter ${f.label || f.name}`}
                  onChange={(e) => handleChange(f.name, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                  required={f.required}
                  helperText={f.description}
                  FormHelperTextProps={{ sx: { color: ink.muted, fontSize: '0.7rem' } }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: surface.sunken,
                      '& fieldset': { borderColor: surface.border },
                    },
                    '& .MuiInputLabel-root': { color: ink.secondary },
                  }}
                />
              )}
            </Box>
          );
        })}
      </Stack>

      <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${surface.border}`, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          sx={{
            backgroundColor: accent.violet,
            color: ink.onAccent,
            fontWeight: 650,
            fontSize: '0.8rem',
            textTransform: 'none',
            borderRadius: `${radius.sm}px`,
            px: 3,
            transition: 'background-color 150ms ease, transform 100ms ease',
            '&:hover': {
              backgroundColor: accent.violetHover,
              transform: 'translateY(-1px)',
            },
          }}
        >
          Submit Form
        </Button>
      </Box>
    </Paper>
  );
};
