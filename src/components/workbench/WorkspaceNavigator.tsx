// src/components/workbench/WorkspaceNavigator.tsx
// The workspace selector, opened from the top bar as a contextual popover.
//
// Migrated to theme tokens in the Phase 3 pass. Weight 800 headings were also
// brought down to 600: the contract caps weight at 700, and a section label in
// a popover does not need to shout.

import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Switch, List, ListItem, ListItemText, ListItemSecondaryAction, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, Stack, Divider, Paper, IconButton } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import { accent, ink, surface } from '../../theme/tokens';
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
  onTestingCockpitClick?: () => void;
}

export const WorkspaceNavigator: React.FC<NavigatorProps> = ({ token, activeWorkspace, onSelectWorkspace, onAuditLogsClick, onTestingCockpitClick }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [suggestions, setSuggestions] = useState<Workspace[]>([]);
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
    try {
      const browseResp = await fetch('/api/workspaces/browse', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const browseData = await browseResp.json();

      if (browseData.canceled || !browseData.path) {
        return;
      }

      const folderPath = browseData.path;
      const folderName = browseData.name;

      const resp = await fetch('/api/workspaces/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: folderName, folder: folderPath })
      });
      const data = await resp.json();
      if (resp.ok && (data.success || data.workspace)) {
        fetchData(); // Reload workspaces from updated catalog
      } else {
        setErrorMsg(data.error || 'Failed to register workspace.');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return; // User cancelled
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
        <Typography variant="caption" sx={{ color: ink.secondary, fontWeight: 600, letterSpacing: '0.05em' }}>
          PROJECTS ({workspaces.length})
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" onClick={fetchData} sx={{ color: ink.secondary }} title="Rescan for projects">
            <RefreshIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <IconButton size="small" onClick={handleAddWorkspace} sx={{ color: accent.violet }} title="Add a project">
            <AddIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Stack>
      </Box>

      {/* Workspace List */}
      <Paper variant="outlined" sx={{ flexGrow: 1, background: surface.sunken, borderColor: surface.border, overflowY: 'auto', p: 1, mb: 2 }}>
        {workspaces.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: ink.secondary }}>No projects registered yet.</Typography>
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
                    background: isActive ? accent.violetMuted : 'transparent',
                    border: isActive ? `1px solid ${accent.violetBorder}` : '1px solid transparent',
                    opacity: ws.enabled ? 1 : 0.6,
                    '&:hover': {
                      background: ws.enabled ? (isActive ? accent.violetMuted : surface.overlay) : 'transparent'
                    }
                  }}
                >
                  <FolderIcon sx={{ mr: 1.5, fontSize: 16, color: ws.enabled ? accent.violet : ink.secondary }} />
                  <ListItemText
                    primary={<Typography variant="body2" sx={{ fontWeight: isActive ? 600 : 400, color: ink.primary }}>{ws.name}</Typography>}
                    secondary={<Typography variant="caption" sx={{ color: ink.secondary, fontSize: '0.65rem' }}>{ws.path}</Typography>}
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      size="small"
                      checked={ws.enabled}
                      onChange={(e) => handleToggleWorkspace(ws.id, e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: accent.violet },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: accent.violet }
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
          <Typography variant="caption" sx={{ color: ink.secondary, fontWeight: 600, display: 'block', mb: 1, letterSpacing: '0.05em' }}>
            SUGGESTED PROJECTS ({suggestions.length})
          </Typography>
          <Paper variant="outlined" sx={{ p: 1.5, background: surface.sunken, borderColor: surface.border }}>
            <Stack spacing={1}>
              {suggestions.map((sug) => (
                <Box key={sug.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: ink.primary, fontSize: '0.75rem' }}>{sug.name.replace(' (Suggested)', '')}</Typography>
                    <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', fontSize: '0.6rem' }}>{sug.path}</Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleAddSuggested(sug)}
                    sx={{
                      fontSize: '0.65rem',
                      height: 20,
                      textTransform: 'none',
                      borderColor: accent.violetBorder,
                      color: accent.violet,
                      '&:hover': { borderColor: accent.violet, background: accent.violetMuted }
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
      <Stack spacing={1} sx={{ pt: 2 }}>
        {onTestingCockpitClick && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<ListAltIcon sx={{ fontSize: 13 }} />}
            onClick={onTestingCockpitClick}
            sx={{
              textTransform: 'none',
              fontSize: '0.7rem',
              borderColor: accent.violetBorder,
              color: accent.violet,
              borderRadius: '6px',
              '&:hover': { borderColor: accent.violet, background: accent.violetMuted }
            }}
          >
            User Testing Cockpit
          </Button>
        )}

        {onAuditLogsClick && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<SecurityIcon sx={{ fontSize: 13 }} />}
            onClick={onAuditLogsClick}
            sx={{
              textTransform: 'none',
              fontSize: '0.7rem',
              borderColor: surface.border,
              color: ink.secondary,
              borderRadius: '6px',
              '&:hover': { borderColor: surface.borderStrong, background: surface.overlay }
            }}
          >
            Inspect System Audit Logs
          </Button>
        )}
      </Stack>

    </Box>
  );
};
