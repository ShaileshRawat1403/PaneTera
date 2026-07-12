// src/components/workbench/AuditLogsView.tsx
import React, { useState, useEffect } from 'react';
import { Box, Dialog, DialogTitle, DialogContent, DialogActions, Typography, List, ListItem, ListItemText, Button, Chip, Stack, CircularProgress } from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import RefreshIcon from '@mui/icons-material/Refresh';

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

  const getEventColor = (event: string) => {
    switch (event) {
      case 'file read denied':
      case 'policy violation':
      case 'adapter error':
        return '#ef4444'; // Red
      case 'file read allowed':
      case 'workspace enabled':
      case 'adapter start':
        return '#22c55e'; // Green
      default:
        return '#cbd5e1'; // Gray
    }
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
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon sx={{ color: '#7f5af0', fontSize: 20 }} />
          <Typography variant="h6" sx={{ color: '#f4f4f5', fontWeight: 800 }}>
            System Access Audit Logs
          </Typography>
        </Box>
        <Button size="small" onClick={fetchLogs} startIcon={<RefreshIcon sx={{ fontSize: 13 }} />} sx={{ color: '#cbd5e1', textTransform: 'none' }}>
          Refresh
        </Button>
      </DialogTitle>
      
      <DialogContent sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress size={20} sx={{ color: '#7f5af0' }} />
          </Box>
        ) : logs.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#71717a' }}>No audit logs recorded yet.</Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {logs.map((log, idx) => (
              <ListItem
                key={idx}
                sx={{
                  py: 1,
                  px: 1.5,
                  borderRadius: '6px',
                  mb: 0.8,
                  background: 'rgba(255, 255, 255, 0.005)',
                  border: '1px solid rgba(255,255,255,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 0.5
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={log.event.toUpperCase()}
                      size="small"
                      sx={{
                        height: 16,
                        fontSize: '0.55rem',
                        fontWeight: 800,
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        color: getEventColor(log.event),
                        border: `1px solid ${getEventColor(log.event)}22`
                      }}
                    />
                    <Typography variant="caption" sx={{ color: '#71717a', fontFamily: 'monospace' }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </Typography>
                  </Stack>
                  {log.details?.workspaceId && (
                    <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 600 }}>
                      WS: {log.details.workspaceId}
                    </Typography>
                  )}
                </Box>
                <Typography variant="body2" sx={{ color: '#e4e4e7', fontSize: '0.75rem', fontFamily: 'monospace', wordBreak: 'break-all', mt: 0.5 }}>
                  {log.details?.path || log.details?.tool || log.details?.error || JSON.stringify(log.details)}
                  {log.details?.reason && (
                    <span style={{ color: '#ef4444', marginLeft: 8 }}>({log.details.reason})</span>
                  )}
                </Typography>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 0, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Button size="small" onClick={onClose} sx={{ color: '#cbd5e1' }}>
          Close Drawer
        </Button>
      </DialogActions>
    </Dialog>
  );
};
