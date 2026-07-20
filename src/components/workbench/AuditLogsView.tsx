// src/components/workbench/AuditLogsView.tsx
import React, { useState, useEffect } from 'react';
import { Box, Dialog, DialogTitle, DialogContent, DialogActions, Typography, List, ListItem, Button, Chip, Stack, CircularProgress, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { accent, ink, status, surface, typography } from '../../theme/tokens';
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

  /**
   * Audit outcome colours.
   *
   * A denied or failed event is a refusal and reads as one. Everything else is
   * routine and stays neutral: an audit log is mostly a list of ordinary
   * operations, and colouring "allowed" green would make the log a wall of
   * green with nothing meaning anything. The contract reserves green for a
   * completed verification, which an allowlist check is not.
   */
  const getEventColors = (event: string) => {
    const ev = event.toLowerCase();
    if (ev.includes('denied') || ev.includes('violation') || ev.includes('error')) {
      return { bg: status.dangerMuted, text: status.danger, border: status.danger };
    }
    return { bg: 'transparent', text: ink.secondary, border: surface.border };
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: surface.raised,
          border: `1px solid ${surface.border}`,
          borderRadius: '12px',
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1.5, borderBottom: `1px solid ${surface.border}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon sx={{ color: accent.violet, fontSize: 18 }} />
          <Typography variant="body2" sx={{ color: ink.primary, fontWeight: 600, fontSize: '0.9rem' }}>
            Authoritative Gateway Security Audit Trail
          </Typography>
        </Box>
        <Button size="small" onClick={fetchLogs} startIcon={<RefreshIcon sx={{ fontSize: 12 }} />} sx={{ color: ink.secondary, textTransform: 'none', fontSize: '0.7rem' }}>
          Refresh Trail
        </Button>
      </DialogTitle>
      
      <DialogContent sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress size={20} sx={{ color: accent.violet }} />
          </Box>
        ) : logs.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: ink.secondary }}>No audit logs recorded yet.</Typography>
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
                      background: surface.sunken,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px !important',
                      color: ink.secondary,
                      '&:before': { display: 'none' }
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon sx={{ fontSize: 16, color: ink.secondary }} />}
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
                        <Typography variant="caption" sx={{ color: ink.secondary, fontFamily: typography.mono, fontSize: '0.62rem' }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </Typography>
                        {log.details?.workspaceId && (
                          <Chip
                            label={`Project: ${log.details.workspaceId}`}
                            size="small"
                            sx={{ height: 14, fontSize: '0.5rem', background: surface.overlay, color: ink.secondary }}
                          />
                        )}
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{
                            color: ink.secondary,
                            fontSize: '0.7rem',
                            fontFamily: typography.mono,
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
                        background: surface.sunken,
                        borderTop: `1px solid ${surface.border}`
                      }}
                    >
                      <Typography variant="caption" sx={{ color: ink.secondary, fontWeight: 600, display: 'block', mb: 0.5 }}>
                        DETAILED JSON PARAMETERS
                      </Typography>
                      <pre
                        style={{
                          margin: 0,
                          padding: '8px',
                          background: surface.sunken,
                          borderRadius: '4px',
                          fontFamily: typography.mono,
                          fontSize: '0.68rem',
                          color: ink.secondary,
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

      <DialogActions sx={{ p: 2, pt: 0, borderTop: `1px solid ${surface.border}` }}>
        <Button size="small" onClick={onClose} sx={{ color: ink.secondary, fontSize: '0.72rem' }}>
          Close Auditor
        </Button>
      </DialogActions>
    </Dialog>
  );
};
