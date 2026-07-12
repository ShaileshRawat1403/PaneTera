// src/components/workbench/WorkspaceNavigator.tsx
import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Switch, List, ListItem, ListItemText, ListItemSecondaryAction, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, Stack, Divider, Paper, IconButton } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import SecurityIcon from '@mui/icons-material/Security';
import ListAltIcon from '@mui/icons-material/ListAlt';

export interface Workspace {
  id: string;
  name: string;
  path: string;
  type: string;
  enabled: boolean;
  status: 'online' | 'offline';
  suggested?: boolean;
}

export interface AuditLog {
  timestamp: string;
  event: string;
  details: any;
}

interface NavigatorProps {
  token: string;
  activeWorkspace: Workspace | null;
  onSelectWorkspace: (ws: Workspace | null) => void;
  onAuditLogsClick?: () => void;
}

export const WorkspaceNavigator: React.FC<NavigatorProps> = ({ token, activeWorkspace, onSelectWorkspace, onAuditLogsClick }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [suggestions, setSuggestions] = useState<Workspace[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch workspaces & suggested scans
  const fetchData = async () => {
    setLoading(true);
    try {
      const wResp = await fetch('/api/myai-workspaces', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const wData = await wResp.json();
      if (wData.workspaces) {
        setWorkspaces(wData.workspaces);
      }

      const sResp = await fetch('/api/myai-workspaces/scan', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const sData = await sResp.json();
      if (sData.suggestions) {
        setSuggestions(sData.suggestions);
      }
    } catch (err: any) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleToggleWorkspace = async (id: string, enabled: boolean) => {
    try {
      const resp = await fetch('/api/myai-workspaces/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id, enabled })
      });
      if (resp.ok) {
        const data = await resp.json();
        // Update workspaces catalog list locally
        setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, enabled, status: enabled ? 'online' : 'offline' } : w));
        
        // Handle active selection change if current workspace is disabled
        if (!enabled && activeWorkspace?.id === id) {
          onSelectWorkspace(null);
        } else if (enabled && data.workspace) {
          onSelectWorkspace(data.workspace);
        }
      }
    } catch (err) {
      console.error('Failed to toggle workspace:', err);
    }
  };

  const handleAddWorkspace = async () => {
    setErrorMsg('');
    if (!newId || !newName || !newPath) {
      setErrorMsg('All fields are required.');
      return;
    }
    try {
      const resp = await fetch('/api/myai-workspaces/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id: newId, name: newName, path: newPath })
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setIsAddOpen(false);
        setNewId('');
        setNewName('');
        setNewPath('');
        fetchData();
      } else {
        setErrorMsg(data.error || 'Failed to register workspace.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred.');
    }
  };

  const handleAddSuggested = async (suggested: Workspace) => {
    try {
      const resp = await fetch('/api/myai-workspaces/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id: suggested.id.replace('suggested-', ''),
          name: suggested.name.replace(' (Suggested)', ''),
          path: suggested.path
        })
      });
      if (resp.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to add suggested workspace:', err);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, letterSpacing: '0.05em' }}>
          WORKSPACES ({workspaces.length})
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" onClick={fetchData} sx={{ color: '#cbd5e1' }} title="Scan and refresh catalog">
            <RefreshIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <IconButton size="small" onClick={() => setIsAddOpen(true)} sx={{ color: '#7f5af0' }} title="Add workspace manually">
            <AddIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Stack>
      </Box>

      {/* Workspace List */}
      <Paper variant="outlined" sx={{ flexGrow: 1, background: 'rgba(255, 255, 255, 0.01)', borderColor: 'rgba(255, 255, 255, 0.04)', overflowY: 'auto', p: 1, mb: 2 }}>
        {workspaces.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: '#71717a' }}>No workspaces registered.</Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {workspaces.map((ws) => {
              const isActive = activeWorkspace?.id === ws.id;
              return (
                <ListItem
                  key={ws.id}
                  onClick={() => ws.enabled && onSelectWorkspace(ws)}
                  sx={{
                    borderRadius: '6px',
                    mb: 0.5,
                    cursor: ws.enabled ? 'pointer' : 'default',
                    background: isActive ? 'rgba(127, 85, 240, 0.06)' : 'transparent',
                    border: isActive ? '1px solid rgba(127, 85, 240, 0.15)' : '1px solid transparent',
                    opacity: ws.enabled ? 1 : 0.6,
                    '&:hover': {
                      background: ws.enabled ? (isActive ? 'rgba(127, 85, 240, 0.1)' : 'rgba(255,255,255,0.02)') : 'transparent'
                    }
                  }}
                >
                  <FolderIcon sx={{ mr: 1.5, fontSize: 16, color: ws.enabled ? '#7f5af0' : '#71717a' }} />
                  <ListItemText
                    primary={<Typography variant="body2" sx={{ fontWeight: isActive ? 700 : 500, color: '#f4f4f5' }}>{ws.name}</Typography>}
                    secondary={<Typography variant="caption" sx={{ color: '#71717a', fontSize: '0.65rem' }}>{ws.path}</Typography>}
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      size="small"
                      checked={ws.enabled}
                      onChange={(e) => handleToggleWorkspace(ws.id, e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: '#7f5af0' },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#7f5af0' }
                      }}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              );
            })}
          </List>
        )}
      </Paper>

      {/* Suggested suggestions section */}
      {suggestions.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, display: 'block', mb: 1, letterSpacing: '0.05em' }}>
            SUGGESTED WORKSPACES ({suggestions.length})
          </Typography>
          <Paper variant="outlined" sx={{ p: 1.5, background: 'rgba(255,255,255,0.005)', borderColor: 'rgba(255,255,255,0.03)' }}>
            <Stack spacing={1}>
              {suggestions.map((sug) => (
                <Box key={sug.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#e4e4e7', fontSize: '0.75rem' }}>{sug.name.replace(' (Suggested)', '')}</Typography>
                    <Typography variant="caption" sx={{ color: '#71717a', display: 'block', fontSize: '0.6rem' }}>{sug.path}</Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleAddSuggested(sug)}
                    sx={{
                      fontSize: '0.65rem',
                      height: 20,
                      textTransform: 'none',
                      borderColor: 'rgba(127, 85, 240, 0.4)',
                      color: '#b794f4',
                      '&:hover': { borderColor: '#7f5af0', background: 'rgba(127,85,240,0.05)' }
                    }}
                  >
                    Register
                  </Button>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Box>
      )}

      {/* Logs/Security link at bottom of left panel */}
      {onAuditLogsClick && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<SecurityIcon sx={{ fontSize: 13 }} />}
          onClick={onAuditLogsClick}
          sx={{
            mt: 'auto',
            textTransform: 'none',
            fontSize: '0.7rem',
            borderColor: 'rgba(255,255,255,0.08)',
            color: '#a1a1aa',
            borderRadius: '6px',
            '&:hover': { borderColor: 'rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.02)' }
          }}
        >
          Inspect System Audit Logs
        </Button>
      )}

      {/* Manual Registration Dialog */}
      <Dialog open={isAddOpen} onClose={() => setIsAddOpen(false)} PaperProps={{ sx: { background: '#0e0f12', border: '1px solid rgba(255,255,255,0.1)' } }}>
        <DialogTitle sx={{ color: '#f4f4f5', fontWeight: 800, fontSize: '1rem' }}>Register Local Workspace</DialogTitle>
        <DialogContent sx={{ minWidth: 320 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {errorMsg && <Typography variant="caption" sx={{ color: '#ef4444' }}>{errorMsg}</Typography>}
            <TextField
              label="Workspace Unique ID"
              size="small"
              value={newId}
              onChange={(e) => setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
              placeholder="e.g. backend-api"
              variant="outlined"
              fullWidth
              InputLabelProps={{ style: { color: '#71717a' } }}
              inputProps={{ style: { color: '#f4f4f5' } }}
            />
            <TextField
              label="Workspace Name"
              size="small"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Backend API Core"
              variant="outlined"
              fullWidth
              InputLabelProps={{ style: { color: '#71717a' } }}
              inputProps={{ style: { color: '#f4f4f5' } }}
            />
            <TextField
              label="Absolute Directory Path"
              size="small"
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              placeholder="e.g. /Users/Name/Projects/my-app"
              variant="outlined"
              fullWidth
              InputLabelProps={{ style: { color: '#71717a' } }}
              inputProps={{ style: { color: '#f4f4f5' } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button size="small" onClick={() => setIsAddOpen(false)} sx={{ color: '#a1a1aa' }}>Cancel</Button>
          <Button size="small" onClick={handleAddWorkspace} variant="contained" sx={{ background: '#7f5af0', '&:hover': { background: '#6d47dd' } }}>Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
