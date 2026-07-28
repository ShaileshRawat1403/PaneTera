// src/components/schema/widgets/ProposalGateWidget.tsx
import React from 'react';
import { Box, Paper, Typography, Button, Stack, Chip } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

import { PaneTeraCardSchema } from '../../../../shared/schemaTypes';
import { accent, ink, radius, status, surface, typography } from '../../../theme/cssTokens';

interface CheckItem {
  id: string;
  rule: string;
  status: 'pass' | 'warn' | 'fail';
  detail?: string;
}

interface ProposalGateWidgetProps {
  schema: PaneTeraCardSchema;
  data: {
    proposalId?: string;
    proposalTitle?: string;
    summary?: string;
    checkList?: CheckItem[];
    status?: 'pending' | 'approved' | 'rejected';
  };
  onAction?: (actionId: string, payload: Record<string, unknown>) => void;
}

export const ProposalGateWidget: React.FC<ProposalGateWidgetProps> = ({ schema, data, onAction }) => {
  const checkList = data.checkList || [];

  const handleActionClick = (actionId: string, requiresApproval?: boolean) => {
    if (onAction) {
      onAction(actionId, { proposalId: data.proposalId, requiresApproval });
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
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
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, pb: 1.5, borderBottom: `1px solid ${surface.border}` }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <WarningAmberIcon sx={{ fontSize: 16, color: status.brass }} />
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: status.brass }}>
              Human Approval Required
            </Typography>
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: ink.primary }}>
            {data.proposalTitle || schema.title || 'Governed Proposal Gate'}
          </Typography>
          {data.summary && (
            <Typography variant="body2" sx={{ color: ink.secondary, mt: 0.5, lineHeight: 1.5 }}>
              {data.summary}
            </Typography>
          )}
        </Box>

        <Chip
          label={`ID: ${data.proposalId || 'prop_001'}`}
          size="small"
          sx={{ height: 22, fontSize: '0.68rem', fontFamily: typography.mono, backgroundColor: surface.sunken, color: ink.muted, border: `1px solid ${surface.border}` }}
        />
      </Box>

      <Box sx={{ my: 2.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em', color: ink.muted, display: 'block', mb: 1 }}>
          Pre-flight Verification Checklist
        </Typography>
        <Stack spacing={1}>
          {checkList.map((chk) => {
            const isPass = chk.status === 'pass';
            const isWarn = chk.status === 'warn';

            const badgeBg = isPass ? status.successMuted : isWarn ? status.brassMuted : status.dangerMuted;
            const badgeColor = isPass ? status.success : isWarn ? status.brass : status.danger;
            const icon = isPass ? <CheckCircleIcon sx={{ fontSize: 13 }} /> : isWarn ? <WarningAmberIcon sx={{ fontSize: 13 }} /> : <CancelIcon sx={{ fontSize: 13 }} />;

            return (
              <Paper
                key={chk.id}
                variant="outlined"
                sx={{
                  p: 1.5,
                  backgroundColor: surface.sunken,
                  borderColor: surface.border,
                  borderRadius: `${radius.sm}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'border-color 150ms ease',
                  '&:hover': {
                    borderColor: surface.borderStrong,
                  },
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: ink.primary }}>
                    {chk.rule}
                  </Typography>
                  {chk.detail && (
                    <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mt: 0.25 }}>
                      {chk.detail}
                    </Typography>
                  )}
                </Box>
                <Chip
                  icon={icon}
                  label={chk.status.toUpperCase()}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    backgroundColor: badgeBg,
                    color: badgeColor,
                    border: `1px solid ${badgeColor}`,
                    '& .MuiChip-icon': { color: badgeColor },
                  }}
                />
              </Paper>
            );
          })}
        </Stack>
      </Box>

      <Stack direction="row" spacing={2} sx={{ pt: 2, borderTop: `1px solid ${surface.border}` }}>
        {schema.actions && schema.actions.length > 0 ? (
          schema.actions.map((act) => {
            const isDanger = act.variant === 'danger' || act.type === 'reject';
            return (
              <Button
                key={act.id}
                onClick={() => handleActionClick(act.id, act.requiresApproval)}
                variant={isDanger ? 'outlined' : 'contained'}
                color={isDanger ? 'error' : 'primary'}
                fullWidth
                sx={{
                  py: 1,
                  fontSize: '0.8rem',
                  fontWeight: 650,
                  textTransform: 'none',
                  borderRadius: `${radius.sm}px`,
                  backgroundColor: isDanger ? status.dangerMuted : accent.violet,
                  color: isDanger ? status.danger : ink.onAccent,
                  borderColor: isDanger ? status.danger : accent.violet,
                  '&:hover': {
                    backgroundColor: isDanger ? status.dangerMuted : accent.violetHover,
                  },
                }}
              >
                {act.label}
              </Button>
            );
          })
        ) : (
          <>
            <Button
              onClick={() => handleActionClick('reject', false)}
              variant="outlined"
              color="error"
              fullWidth
              sx={{
                py: 1,
                fontSize: '0.8rem',
                fontWeight: 650,
                textTransform: 'none',
                borderRadius: `${radius.sm}px`,
                backgroundColor: status.dangerMuted,
                color: status.danger,
                borderColor: status.danger,
                transition: 'background-color 150ms ease, transform 100ms ease',
                '&:hover': {
                  transform: 'translateY(-1px)',
                },
              }}
            >
              Reject Proposal
            </Button>
            <Button
              onClick={() => handleActionClick('approve', true)}
              variant="contained"
              fullWidth
              sx={{
                py: 1,
                fontSize: '0.8rem',
                fontWeight: 650,
                textTransform: 'none',
                borderRadius: `${radius.sm}px`,
                backgroundColor: status.success,
                color: ink.onAccent,
                transition: 'background-color 150ms ease, transform 100ms ease',
                '&:hover': {
                  backgroundColor: accent.violetHover,
                  transform: 'translateY(-1px)',
                },
              }}
            >
              Approve &amp; Execute
            </Button>
          </>
        )}
      </Stack>
    </Paper>
  );
};
