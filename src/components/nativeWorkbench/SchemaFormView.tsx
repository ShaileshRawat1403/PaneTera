import React, { useState } from 'react';
import { Box, Typography, Paper, TextField, Button, MenuItem, Stack, Chip, FormHelperText } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import { accent, ink, status } from '../../theme/cssTokens';

interface Field {
  name: string;
  label: string;
  type: 'string' | 'select';
  required?: boolean;
  options?: string[];
  description?: string;
}

interface Action {
  id: string;
  label: string;
  kind: string;
  risk: string;
  requiresApproval: boolean;
}

interface SchemaFormProps {
  inputSchema: {
    fields: Field[];
  };
  actions?: Action[];
  initialValues?: Record<string, string>;
  onSubmitProposal?: (actionId: string, formValues: Record<string, string>) => void;
}

export const SchemaFormView: React.FC<SchemaFormProps> = ({
  inputSchema,
  actions = [],
  initialValues = {},
  onSubmitProposal
}) => {
  const fields = inputSchema?.fields || [];
  const proposalActions = actions.filter((act) => act.kind === 'proposal' && act.requiresApproval === true);
  const unsafeActionCount = actions.length - proposalActions.length;
  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    fields.forEach((f) => {
      initial[f.name] = initialValues[f.name] || '';
    });
    return initial;
  });

  const [submittedAction, setSubmittedAction] = useState<string | null>(null);

  const handleFieldChange = (name: string, val: string) => {
    setFormValues((prev) => ({ ...prev, [name]: val }));
  };

  const isFormValid = fields.every((f) => {
    if (f.required && !formValues[f.name]?.trim()) {
      return false;
    }
    return true;
  });

  const handleTriggerAction = (actionId: string) => {
    const action = proposalActions.find((act) => act.id === actionId);
    if (!action) {
      return;
    }
    setSubmittedAction(actionId);
    if (onSubmitProposal) {
      onSubmitProposal(actionId, formValues);
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        background: 'rgba(255, 255, 255, 0.01)',
        borderColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5
      }}
    >
      <Box>
        <Typography variant="subtitle1" sx={{ color: ink.primary, fontWeight: 800 }}>
          Interactive Execution Inputs
        </Typography>
        <Typography variant="caption" sx={{ color: ink.disabled, display: 'block', mt: 0.5 }}>
          Input schemas are owned by the native application and synced dynamically.
        </Typography>
      </Box>

      <Stack spacing={2}>
        {fields.map((f) => {
          if (f.type === 'select') {
            return (
              <TextField
                key={f.name}
                select
                fullWidth
                label={`${f.label}${f.required ? ' *' : ''}`}
                value={formValues[f.name] || ''}
                onChange={(e) => handleFieldChange(f.name, e.target.value)}
                variant="outlined"
                InputLabelProps={{ sx: { color: ink.disabled, fontSize: '0.9rem' } }}
                SelectProps={{ sx: { color: ink.secondary } }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&.Mui-focused fieldset': { borderColor: accent.violet }
                  }
                }}
              >
                {(f.options || []).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {opt}
                  </MenuItem>
                ))}
              </TextField>
            );
          }

          return (
            <Box key={f.name}>
              <TextField
                fullWidth
                label={`${f.label}${f.required ? ' *' : ''}`}
                placeholder={f.description}
                value={formValues[f.name] || ''}
                onChange={(e) => handleFieldChange(f.name, e.target.value)}
                variant="outlined"
                InputLabelProps={{ sx: { color: ink.disabled, fontSize: '0.9rem' } }}
                inputProps={{ sx: { color: ink.secondary } }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&.Mui-focused fieldset': { borderColor: accent.violet }
                  }
                }}
              />
            </Box>
          );
        })}
      </Stack>

      {/* Governing Rules Notice */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'flex-start',
          p: 1.5,
          background: 'rgba(127, 85, 240, 0.05)',
          border: '1px solid rgba(127, 85, 240, 0.15)',
          borderRadius: '8px'
        }}
      >
        <InfoIcon sx={{ color: accent.violet, fontSize: 16, mt: 0.2 }} />
        <Typography variant="caption" sx={{ color: ink.secondary, lineHeight: 1.4 }}>
          <strong>Governed Space:</strong> Direct mutations are blocked. Action triggers generate a formal execution proposal that must be signed off by the local workspace operator before runs commence.
        </Typography>
      </Box>

      {unsafeActionCount > 0 && (
        <Box
          sx={{
            p: 1.5,
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.14)',
            borderRadius: '8px'
          }}
        >
          <Typography variant="caption" sx={{ color: status.dangerMuted, fontWeight: 700 }}>
            {unsafeActionCount} app action{unsafeActionCount === 1 ? '' : 's'} hidden because only proposal actions requiring approval can be rendered.
          </Typography>
        </Box>
      )}

      {/* Dynamic Actions Render */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 1 }}>
        {proposalActions.length === 0 && (
          <Typography variant="caption" sx={{ color: ink.disabled, fontWeight: 700 }}>
            No approved proposal actions are available for this form.
          </Typography>
        )}
        {proposalActions.map((act) => {
          const isSubmitted = submittedAction === act.id;
          const label = act.label?.toLowerCase().includes('propose') ? act.label : 'Propose governed run';
          return (
            <Stack key={act.id} direction="row" alignItems="center" spacing={1.5}>
              {act.risk && (
                <Chip
                  label={`${act.risk.toUpperCase()} RISK`}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.55rem',
                    fontWeight: 800,
                    background: act.risk === 'high' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                    color: act.risk === 'high' ? status.danger : status.brass,
                    border: act.risk === 'high' ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid rgba(245, 158, 11, 0.15)'
                  }}
                />
              )}
              <Button
                variant="contained"
                disabled={!isFormValid || isSubmitted}
                onClick={() => handleTriggerAction(act.id)}
                sx={{
                  background: accent.violet,
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: '8px',
                  '&:hover': { background: accent.violetHover }
                }}
              >
                {isSubmitted ? 'Proposal Submitted' : label}
              </Button>
            </Stack>
          );
        })}
      </Box>
    </Paper>
  );
};
