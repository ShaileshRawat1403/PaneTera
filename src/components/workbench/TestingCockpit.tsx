// src/components/workbench/TestingCockpit.tsx
import React, { useState } from 'react';
import { Box, Typography, Paper, TextField, Checkbox, FormControlLabel, Radio, RadioGroup, Button, Stack, Divider } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import AssignmentIcon from '@mui/icons-material/Assignment';

interface CockpitProps {
  gatewayConnected: boolean;
  activeWorkspaceId: string | null;
  token: string;
}

export const TestingCockpit: React.FC<CockpitProps> = ({ gatewayConnected, activeWorkspaceId, token }) => {
  const [testerName, setTesterName] = useState('');
  const [notes, setNotes] = useState('');
  const [frictionScore, setFrictionScore] = useState('3');
  
  // Pairing Code states
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingCodeLoading, setPairingCodeLoading] = useState(false);

  // Checklist tasks
  const [tasks, setTasks] = useState({
    viewCatalog: false,
    enableWorkspace: false,
    scanTechStack: false,
    runQuickAction: false,
    readSafeFile: false,
    testBlockedEnv: false,
    verifyAuditLogs: false
  });

  const handleTaskChange = (taskKey: keyof typeof tasks, checked: boolean) => {
    setTasks(prev => ({ ...prev, [taskKey]: checked }));
  };

  const generatePairingCode = async () => {
    setPairingCodeLoading(true);
    setPairingCode(null);
    try {
      const resp = await fetch('/api/browser/pairing/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        setPairingCode(data.code);
      } else {
        alert('Failed to generate pairing code. Make sure server is reachable.');
      }
    } catch (e) {
      console.error(e);
      alert('Error connecting to local browser pairing endpoint.');
    } finally {
      setPairingCodeLoading(false);
    }
  };

  const handleExport = () => {
    const summary = {
      version: '0.2.0-alpha',
      timestamp: new Date().toISOString(),
      tester: testerName || 'Anonymous Tester',
      gatewayConnected,
      activeWorkspaceId,
      frictionScore: parseInt(frictionScore, 10),
      notes,
      taskChecklist: tasks
    };

    const fileContent = JSON.stringify(summary, null, 2);
    const blob = new Blob([fileContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Trigger download in browser
    const link = document.createElement('a');
    link.href = url;
    link.download = `panetera-session-${testerName.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'alpha'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        background: 'rgba(20, 20, 25, 0.7)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '10px',
        height: '100%',
        overflowY: 'auto'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AssignmentIcon sx={{ color: '#7f5af0', fontSize: 16 }} />
        <Typography variant="body2" sx={{ fontWeight: 800, color: '#f4f4f5', letterSpacing: '-0.01em' }}>
          Local Alpha User Testing Cockpit
        </Typography>
      </Box>

      {/* Browser Extension Pairing Area */}
      <Box sx={{ mb: 2, p: 1.5, background: 'rgba(127, 85, 240, 0.05)', border: '1px solid rgba(127, 85, 240, 0.15)', borderRadius: '8px' }}>
        <Typography variant="caption" sx={{ color: '#a78bfa', fontWeight: 800, display: 'block', mb: 0.5 }}>
          BROWSER OPERATOR CONNECTION
        </Typography>
        <Typography variant="caption" sx={{ color: '#71717a', display: 'block', mb: 1.5, lineHeight: 1.3 }}>
          Pair your local Chrome Extension. No master token is exposed. Generates an 8-character single-session code.
        </Typography>
        
        {pairingCode ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 1.5, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', mb: 1.5 }}>
            <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 600, mb: 0.5 }}>
              Pairing Code (Expires in 2 mins)
            </Typography>
            <Typography variant="h5" sx={{ fontFamily: 'monospace', fontWeight: 800, color: '#f4f4f5', letterSpacing: '2px' }}>
              {pairingCode}
            </Typography>
          </Box>
        ) : null}

        <Button
          size="small"
          variant="outlined"
          fullWidth
          disabled={pairingCodeLoading}
          onClick={generatePairingCode}
          sx={{
            borderColor: 'rgba(127, 85, 240, 0.3)',
            color: '#b794f4',
            fontSize: '0.68rem',
            textTransform: 'none',
            '&:hover': {
              borderColor: 'rgba(127, 85, 240, 0.6)',
              background: 'rgba(127, 85, 240, 0.02)'
            }
          }}
        >
          {pairingCodeLoading ? 'Generating Code...' : pairingCode ? 'Regenerate Pairing Code' : 'Generate Pairing Code'}
        </Button>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)', my: 2 }} />

      {/* Tester info */}
      <Stack spacing={2} sx={{ mb: 2.5 }}>
        <TextField
          label="Tester/Session Name"
          size="small"
          value={testerName}
          onChange={(e) => setTesterName(e.target.value)}
          placeholder="e.g. Alpha Tester A"
          variant="outlined"
          fullWidth
          InputLabelProps={{ style: { color: '#71717a', fontSize: '0.75rem' } }}
          inputProps={{ style: { color: '#cbd5e1', fontSize: '0.75rem' } }}
        />
      </Stack>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)', my: 2 }} />

      {/* Test checklist */}
      <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, display: 'block', mb: 1, letterSpacing: '0.05em' }}>
        TASKS CHECKLIST
      </Typography>
      <Stack spacing={0.5}>
        <FormControlLabel
          control={<Checkbox size="small" checked={tasks.viewCatalog} onChange={(e) => handleTaskChange('viewCatalog', e.target.checked)} sx={{ color: '#71717a', '&.Mui-checked': { color: '#7f5af0' } }} />}
          label={<Typography variant="caption" sx={{ color: '#cbd5e1' }}>1. Open workspaces catalog</Typography>}
        />
        <FormControlLabel
          control={<Checkbox size="small" checked={tasks.enableWorkspace} onChange={(e) => handleTaskChange('enableWorkspace', e.target.checked)} sx={{ color: '#71717a', '&.Mui-checked': { color: '#7f5af0' } }} />}
          label={<Typography variant="caption" sx={{ color: '#cbd5e1' }}>2. Enable Soothsayer workspace</Typography>}
        />
        <FormControlLabel
          control={<Checkbox size="small" checked={tasks.scanTechStack} onChange={(e) => handleTaskChange('scanTechStack', e.target.checked)} sx={{ color: '#71717a', '&.Mui-checked': { color: '#7f5af0' } }} />}
          label={<Typography variant="caption" sx={{ color: '#cbd5e1' }}>3. Verify tech stack detection</Typography>}
        />
        <FormControlLabel
          control={<Checkbox size="small" checked={tasks.runQuickAction} onChange={(e) => handleTaskChange('runQuickAction', e.target.checked)} sx={{ color: '#71717a', '&.Mui-checked': { color: '#7f5af0' } }} />}
          label={<Typography variant="caption" sx={{ color: '#cbd5e1' }}>4. Run guided workspace actions</Typography>}
        />
        <FormControlLabel
          control={<Checkbox size="small" checked={tasks.readSafeFile} onChange={(e) => handleTaskChange('readSafeFile', e.target.checked)} sx={{ color: '#71717a', '&.Mui-checked': { color: '#7f5af0' } }} />}
          label={<Typography variant="caption" sx={{ color: '#cbd5e1' }}>5. Open and inspect safe file</Typography>}
        />
        <FormControlLabel
          control={<Checkbox size="small" checked={tasks.testBlockedEnv} onChange={(e) => handleTaskChange('testBlockedEnv', e.target.checked)} sx={{ color: '#71717a', '&.Mui-checked': { color: '#7f5af0' } }} />}
          label={<Typography variant="caption" sx={{ color: '#cbd5e1' }}>6. Attempt blocked .env read</Typography>}
        />
        <FormControlLabel
          control={<Checkbox size="small" checked={tasks.verifyAuditLogs} onChange={(e) => handleTaskChange('verifyAuditLogs', e.target.checked)} sx={{ color: '#71717a', '&.Mui-checked': { color: '#7f5af0' } }} />}
          label={<Typography variant="caption" sx={{ color: '#cbd5e1' }}>7. Inspect append-only audit logs</Typography>}
        />
      </Stack>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)', my: 2 }} />

      {/* Friction Score */}
      <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, display: 'block', mb: 1, letterSpacing: '0.05em' }}>
        UX FRICTION RATING
      </Typography>
      <RadioGroup row value={frictionScore} onChange={(e) => setFrictionScore(e.target.value)} sx={{ mb: 2 }}>
        {['1', '2', '3', '4', '5'].map((val) => (
          <FormControlLabel
            key={val}
            value={val}
            control={<Radio size="small" sx={{ color: '#71717a', '&.Mui-checked': { color: '#7f5af0' } }} />}
            label={<Typography variant="caption" sx={{ color: '#cbd5e1' }}>{val}</Typography>}
            sx={{ mr: 1.5 }}
          />
        ))}
      </RadioGroup>

      {/* Feedback notes */}
      <TextField
        label="Friction Notes & Comments"
        multiline
        rows={4}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Enter friction notes, comments, bugs, or UX layout observations..."
        variant="outlined"
        fullWidth
        sx={{ mb: 2.5 }}
        InputLabelProps={{ style: { color: '#71717a', fontSize: '0.75rem' } }}
        inputProps={{ style: { color: '#cbd5e1', fontSize: '0.75rem', lineHeight: 1.4 } }}
      />

      <Button
        variant="contained"
        fullWidth
        startIcon={<FileDownloadIcon />}
        onClick={handleExport}
        sx={{
          background: '#7f5af0',
          textTransform: 'none',
          fontSize: '0.72rem',
          fontWeight: 700,
          '&:hover': { background: '#6d47dd' }
        }}
      >
        Export Local Session Summary
      </Button>
    </Paper>
  );
};
