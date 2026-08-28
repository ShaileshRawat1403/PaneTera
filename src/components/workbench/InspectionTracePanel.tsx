// src/components/workbench/InspectionTracePanel.tsx
import React from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemText, Chip, Stack } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import { accent, ink, status } from '../../theme/cssTokens';

export interface TraceRecord {
  timestamp: string;
  relativePath: string;
  tool: string;
  allowed: boolean;
  reason?: string;
}

interface TraceProps {
  records: TraceRecord[];
  onSelectFile?: (relPath: string) => void;
}

export const InspectionTracePanel: React.FC<TraceProps> = ({ records, onSelectFile }) => {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        background: 'rgba(255, 255, 255, 0.005)',
        borderColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: '8px',
        maxHeight: '300px',
        overflowY: 'auto'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <VisibilityIcon sx={{ color: accent.violet, fontSize: 14 }} />
        <Typography variant="caption" sx={{ color: ink.disabled, fontWeight: 800, letterSpacing: '0.05em' }}>
          AGENT INSPECTION TRACE
        </Typography>
      </Box>

      {records.length === 0 ? (
        <Box sx={{ py: 1.5, textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: ink.disabled, fontStyle: 'italic' }}>
            No workspace inspection traces recorded in this session.
          </Typography>
        </Box>
      ) : (
        <List dense disablePadding>
          {records.map((rec, idx) => (
            <ListItem
              key={idx}
              onClick={() => rec.allowed && onSelectFile && onSelectFile(rec.relativePath)}
              sx={{
                py: 0.75,
                px: 1,
                borderRadius: '4px',
                mb: 0.5,
                cursor: rec.allowed && onSelectFile ? 'pointer' : 'default',
                background: 'rgba(255, 255, 255, 0.005)',
                border: '1px solid rgba(255, 255, 255, 0.02)',
                '&:hover': {
                  background: rec.allowed && onSelectFile ? 'rgba(255,255,255,0.02)' : 'transparent'
                }
              }}
            >
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: rec.allowed ? accent.violet : status.danger,
                        fontFamily: 'monospace',
                        textDecoration: rec.allowed && onSelectFile ? 'underline' : 'none'
                      }}
                    >
                      {rec.relativePath}
                    </Typography>
                    <Chip
                      label={rec.tool}
                      size="small"
                      sx={{
                        height: 14,
                        fontSize: '0.52rem',
                        background: 'rgba(255,255,255,0.02)',
                        color: ink.disabled,
                        fontFamily: 'monospace'
                      }}
                    />
                  </Stack>
                }
                secondary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mt: 0.2 }}>
                    <Typography variant="caption" sx={{ fontSize: '0.58rem', color: ink.disabled }}>
                      {new Date(rec.timestamp).toLocaleTimeString()}
                    </Typography>
                    {!rec.allowed && (
                      <Typography variant="caption" sx={{ fontSize: '0.58rem', color: status.dangerMuted, fontWeight: 600 }}>
                        {rec.reason || 'Blocked by host policy'}
                      </Typography>
                    )}
                  </Box>
                }
              />
              <Box sx={{ ml: 1 }}>
                {rec.allowed ? (
                  <Chip
                    label="ALLOWED"
                    size="small"
                    sx={{ height: 14, fontSize: '0.5rem', fontWeight: 900, background: 'rgba(34, 197, 94, 0.08)', color: status.success }}
                  />
                ) : (
                  <Chip
                    label="DENIED"
                    size="small"
                    sx={{ height: 14, fontSize: '0.5rem', fontWeight: 900, background: 'rgba(239, 68, 68, 0.08)', color: status.danger }}
                  />
                )}
              </Box>
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
};
