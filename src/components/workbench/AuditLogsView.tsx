// src/components/workbench/AuditLogsView.tsx
import React, { useState, useEffect } from 'react';
import { Box, Dialog, DialogTitle, DialogContent, DialogActions, Typography, List, ListItem, Button, Chip, Stack, CircularProgress, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface AuditRecord {
  timestamp: string;
  event: string;
  details: {
    workspaceId?: string;
    path?: string;
    tool?: string;
    args?: any;
    error?: string;
    reason?: string;
  };
}

interface AuditLogsProps {
  token: string;
  open: boolean;
  onClose: () => void;
}

export const AuditLogsView: React.FC<AuditLogsProps> = ({ token, open, onClose }) => {
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/myai-workspaces/audit', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchLogs();
    }
  }, [open, token]);

  const getEventColors = (event: string) => {
    const ev = event.toLowerCase();
    if (ev.includes('denied') || ev.includes('violation') || ev.includes('error')) {
      return { bg: 'rgba(239, 68, 68, 0.08)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.15)' };
    }
    if (ev.includes('allowed') || ev.includes('enabled') || ev.includes('start') || ev.includes('success')) {
      return { bg: 'rgba(34, 197, 94, 0.08)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.15)' };
    }
    return { bg: 'rgba(127, 85, 240, 0.08)', text: '#b794f4', border: 'rgba(127, 85, 240, 0.15)' };
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: '#0e0f12',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1.5, borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon sx={{ color: '#7f5af0', fontSize: 18 }} />
          <Typography variant="body2" sx={{ color: '#f4f4f5', fontWeight: 800, fontSize: '0.9rem' }}>
            Authoritative Gateway Security Audit Trail
          </Typography>
        </Box>
        <Button size="small" onClick={fetchLogs} startIcon={<RefreshIcon sx={{ fontSize: 12 }} />} sx={{ color: '#cbd5e1', textTransform: 'none', fontSize: '0.7rem' }}>
          Refresh Trail
        </Button>
      </DialogTitle>
      
      <DialogContent sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress size={20} sx={{ color: '#7f5af0' }} />
          </Box>
        ) : logs.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: '#71717a' }}>No audit logs recorded yet.</Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {logs.map((log, idx) => {
              const colors = getEventColors(log.event);
              return (
                <ListItem
                  key={idx}
                  disablePadding
                  sx={{
                    mb: 1.2,
                    display: 'block'
                  }}
                >
                  <Accordion
                    disableGutters
                    sx={{
                      background: 'rgba(255,255,255,0.005)',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px !important',
                      color: '#cbd5e1',
                      '&:before': { display: 'none' }
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon sx={{ fontSize: 16, color: '#71717a' }} />}
                      sx={{
                        minHeight: 38,
                        py: 0,
                        px: 1.5,
                        '& .MuiAccordionSummary-content': { margin: '8px 0 !important' }
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
                        <Chip
                          label={log.event.toUpperCase()}
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: '0.52rem',
                            fontWeight: 900,
                            backgroundColor: colors.bg,
                            color: colors.text,
                            border: `1px solid ${colors.border}`
                          }}
                        />
                        <Typography variant="caption" sx={{ color: '#71717a', fontFamily: 'monospace', fontSize: '0.62rem' }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </Typography>
                        {log.details?.workspaceId && (
                          <Chip
                            label={`WS: ${log.details.workspaceId}`}
                            size="small"
                            sx={{ height: 14, fontSize: '0.5rem', background: 'rgba(255,255,255,0.02)', color: '#a1a1aa' }}
                          />
                        )}
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{
                            color: '#cbd5e1',
                            fontSize: '0.7rem',
                            fontFamily: 'monospace',
                            flexGrow: 1,
                            maxWidth: '300px'
                          }}
                        >
                          {log.details?.path || log.details?.tool || log.details?.error || 'View Parameters'}
                        </Typography>
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails
                      sx={{
                        p: 1.5,
                        background: 'rgba(9, 9, 11, 0.4)',
                        borderTop: '1px solid rgba(255,255,255,0.03)'
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, display: 'block', mb: 0.5 }}>
                        DETAILED JSON PARAMETERS
                      </Typography>
                      <pre
                        style={{
                          margin: 0,
                          padding: '8px',
                          background: 'rgba(0,0,0,0.2)',
                          borderRadius: '4px',
                          fontFamily: 'monospace',
                          fontSize: '0.68rem',
                          color: '#a1a1aa',
                          overflowX: 'auto',
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </AccordionDetails>
                  </Accordion>
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 0, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <Button size="small" onClick={onClose} sx={{ color: '#cbd5e1', fontSize: '0.72rem' }}>
          Close Auditor
        </Button>
      </DialogActions>
    </Dialog>
  );
};
