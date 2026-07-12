// src/components/workbench/QuickActionsDeck.tsx
import React, { useState } from 'react';
import { Box, Typography, Button, Paper, Stack, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import SecurityIcon from '@mui/icons-material/Security';
import GitHubIcon from '@mui/icons-material/GitHub';

export interface ActionItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  requiresConfirm?: boolean;
}

interface DeckProps {
  onTriggerAction: (actionId: string) => void;
}

export const QuickActionsDeck: React.FC<DeckProps> = ({ onTriggerAction }) => {
  const [isDemoConfirmOpen, setIsDemoConfirmOpen] = useState(false);

  const actions: ActionItem[] = [
    {
      id: 'explain-repo',
      label: 'Explain this repo',
      description: 'Summarize name, branch, and metadata.',
      icon: <HelpOutlineIcon sx={{ fontSize: 14 }} />
    },
    {
      id: 'show-configs',
      label: 'Show config files',
      description: 'Find workspace configuration scripts.',
      icon: <SettingsIcon sx={{ fontSize: 14 }} />
    },
    {
      id: 'find-todos',
      label: 'Find TODOs',
      description: 'Locate TODO comments in code.',
      icon: <SearchIcon sx={{ fontSize: 14 }} />
    },
    {
      id: 'git-status',
      label: 'Show git status',
      description: 'List active modified or untracked changes.',
      icon: <GitHubIcon sx={{ fontSize: 14 }} />
    },
    {
      id: 'security-demo',
      label: 'Security boundary demo',
      description: 'Test host policy intercept blocks.',
      icon: <SecurityIcon sx={{ fontSize: 14, color: '#ef4444' }} />,
      requiresConfirm: true
    }
  ];

  const handleActionClick = (action: ActionItem) => {
    if (action.requiresConfirm) {
      setIsDemoConfirmOpen(true);
    } else {
      onTriggerAction(action.id);
    }
  };

  const handleConfirmDemo = () => {
    setIsDemoConfirmOpen(false);
    onTriggerAction('security-demo');
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, display: 'block', mb: 1.5, letterSpacing: '0.05em' }}>
        GUIDED WORKSPACE ACTIONS (READ-ONLY)
      </Typography>
      <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1 }}>
        {actions.map((act) => (
          <Button
            key={act.id}
            variant="outlined"
            onClick={() => handleActionClick(act)}
            startIcon={act.icon}
            sx={{
              textTransform: 'none',
              fontSize: '0.72rem',
              borderRadius: '6px',
              px: 1.5,
              py: 0.75,
              background: 'rgba(255,255,255,0.01)',
              borderColor: act.id === 'security-demo' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)',
              color: act.id === 'security-demo' ? '#fca5a5' : '#cbd5e1',
              '&:hover': {
                borderColor: act.id === 'security-demo' ? '#ef4444' : '#7f5af0',
                background: act.id === 'security-demo' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(127, 85, 240, 0.05)'
              }
            }}
          >
            {act.label}
          </Button>
        ))}
      </Stack>

      {/* Security Demo Confirmation Dialog */}
      <Dialog
        open={isDemoConfirmOpen}
        onClose={() => setIsDemoConfirmOpen(false)}
        PaperProps={{
          sx: {
            background: '#0e0f12',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            maxWidth: '400px'
          }
        }}
      >
        <DialogTitle sx={{ color: '#ef4444', fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon sx={{ fontSize: 18 }} />
          Simulated Safety Check
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#a1a1aa', fontSize: '0.78rem', lineHeight: 1.5 }}>
            This is a simulated safety check. The portal will request a forbidden file to verify that the Host Policy Engine blocks unauthorized reads. No file contents will be exposed. A denied event will be added to the audit log.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button size="small" onClick={() => setIsDemoConfirmOpen(false)} sx={{ color: '#a1a1aa', textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            size="small"
            onClick={handleConfirmDemo}
            variant="contained"
            sx={{
              background: '#ef4444',
              color: '#fff',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': { background: '#dc2626' }
            }}
          >
            Run safety check
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
