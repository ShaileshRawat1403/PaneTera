import React, { useState, useCallback } from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';
import { surface, ink, accent, status, radius, elevation } from '../../theme/cssTokens';

interface StatusBoardProps {
  data: {
    reviewState?: string;
    evidenceSummary?: string;
    checks?: Array<{ name: string; status: 'passed' | 'warning' | 'failed' }>;
  };
}

export const StatusBoardView: React.FC<StatusBoardProps> = ({ data }) => {
  const { reviewState = 'Pending evaluation', evidenceSummary = 'None', checks = [] } = data;
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const handleCheckToggle = useCallback((name: string) => {
    setCheckedItems((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  const computeCheckId = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        backgroundColor: surface.raised,
        borderColor: surface.border,
        borderRadius: `${radius.md}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
        boxShadow: elevation.card,
      }}
    >
      <Box>
        <Typography variant="subtitle1" sx={{ color: ink.primary, fontWeight: 700 }}>
          Session Review Status
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Typography
            variant="caption"
            sx={{ color: ink.muted, fontWeight: 600, display: 'block', mb: 0.5, letterSpacing: '0.05em', fontSize: '11px' }}
          >
            REVIEW STATE
          </Typography>
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              backgroundColor: status.brassMuted,
              borderColor: `${status.brass}40`,
              borderRadius: `${radius.sm}px`,
            }}
          >
            <Typography variant="body2" sx={{ color: status.brass, fontWeight: 600 }}>
              {reviewState}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography
            variant="caption"
            sx={{ color: ink.muted, fontWeight: 600, display: 'block', mb: 0.5, letterSpacing: '0.05em', fontSize: '11px' }}
          >
            INTELLIGENCE EVIDENCE
          </Typography>
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              backgroundColor: surface.sunken,
              borderColor: surface.border,
              borderRadius: `${radius.sm}px`,
            }}
          >
            <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', lineHeight: 1.4 }}>
              {evidenceSummary}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {checks.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography
            variant="caption"
            sx={{ color: ink.muted, fontWeight: 600, display: 'block', mb: 1, letterSpacing: '0.05em', fontSize: '11px' }}
          >
            VERIFICATION CHECKLIST
          </Typography>
          <Grid container spacing={1.5}>
            {checks.map((chk, idx) => {
              const checkId = computeCheckId(chk.name);
              const isChecked = checkedItems[checkId] || false;
              const statusColor =
                chk.status === 'passed'
                  ? status.success
                  : chk.status === 'warning'
                  ? status.brass
                  : status.danger;

              return (
                <Grid item xs={12} sm={6} key={idx}>
                  <Box
                    onClick={() => handleCheckToggle(checkId)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1,
                      backgroundColor: isChecked ? accent.violetMuted : surface.sunken,
                      border: `1px solid ${isChecked ? accent.violetBorder : surface.border}`,
                      borderRadius: `${radius.sm}px`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        backgroundColor: isChecked ? accent.violetHover : surface.raisedHover,
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '4px',
                          border: `2px solid ${isChecked ? accent.violet : surface.borderStrong}`,
                          backgroundColor: isChecked ? accent.violet : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isChecked && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path
                              d="M2 5L4.5 7.5L8 2.5"
                              stroke={ink.onAccent}
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </Box>
                      <Typography variant="caption" sx={{ color: ink.primary, fontWeight: 500 }}>
                        {chk.name}
                      </Typography>
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 600,
                        fontSize: '10px',
                        color: statusColor,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: `${statusColor}15`,
                      }}
                    >
                      {chk.status.toUpperCase()}
                    </Typography>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      )}
    </Paper>
  );
};
