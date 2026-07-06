import React from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';

interface StatusBoardProps {
  data: {
    reviewState?: string;
    evidenceSummary?: string;
    checks?: Array<{ name: string; status: 'passed' | 'warning' | 'failed' }>;
  };
}

export const StatusBoardView: React.FC<StatusBoardProps> = ({ data }) => {
  const { reviewState = 'Pending evaluation', evidenceSummary = 'None', checks = [] } = data;

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
        <Typography variant="subtitle1" sx={{ color: '#f4f4f5', fontWeight: 800 }}>
          Session Review Status
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, display: 'block', mb: 0.5, letterSpacing: '0.05em' }}>
            REVIEW STATE
          </Typography>
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              background: 'rgba(245, 158, 11, 0.02)',
              borderColor: 'rgba(245, 158, 11, 0.08)',
              borderRadius: '8px'
            }}
          >
            <Typography variant="body2" sx={{ color: '#f59e0b', fontWeight: 700 }}>
              {reviewState}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, display: 'block', mb: 0.5, letterSpacing: '0.05em' }}>
            INTELLIGENCE EVIDENCE
          </Typography>
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              background: 'rgba(34, 197, 94, 0.02)',
              borderColor: 'rgba(34, 197, 94, 0.08)',
              borderRadius: '8px'
            }}
          >
            <Typography variant="caption" sx={{ color: '#a0aec0', display: 'block', lineHeight: 1.4 }}>
              {evidenceSummary}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {checks.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, display: 'block', mb: 1, letterSpacing: '0.05em' }}>
            VERIFICATION CHECKLIST
          </Typography>
          <Grid container spacing={1.5}>
            {checks.map((chk, idx) => (
              <Grid item xs={12} sm={6} key={idx}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1,
                    background: 'rgba(0, 0, 0, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    borderRadius: '6px'
                  }}
                >
                  <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 600 }}>
                    {chk.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      fontSize: '0.65rem',
                      color:
                        chk.status === 'passed'
                          ? '#22c55e'
                          : chk.status === 'warning'
                          ? '#f59e0b'
                          : '#ef4444'
                    }}
                  >
                    {chk.status.toUpperCase()}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Paper>
  );
};
