import React, { useState } from 'react';
import { Box, Typography, Card, CardContent, CardActionArea, Grid, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Paper, Divider, TextField, Button, Chip, Stack } from '@mui/material';
import type { UiComponent } from '../../shared/uiComponent';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import SearchIcon from '@mui/icons-material/Search';
import CodeIcon from '@mui/icons-material/Code';
import { ProposedActionCard } from './ProposedActionCard';
import { RepoSetupProposalCard } from './RepoSetupProposalCard';
import { LiveAppWorkbenchCard } from './LiveAppWorkbenchCard';

interface ComponentProps {
  uiComponent: UiComponent;
  onAction: (query: string) => void;
  onApproveAction?: (id: string, workspaceName: string, command: string) => void;
  onCancelAction?: (id: string) => void;
  onStartContentWorkflow?: (form: any) => void;
  activeLens?: string;
}

export const InteractiveComponent: React.FC<ComponentProps> = ({ uiComponent, onAction, onApproveAction, onCancelAction, onStartContentWorkflow, activeLens }) => {
  const { type, data } = uiComponent;
  // Local only — the message log itself stays append-only/immutable, so
  // "did I already act on this" lives here rather than mutating history.
  const [resolution, setResolution] = useState<'pending' | 'approved' | 'cancelled'>('pending');

  if (type === 'LiveAppWorkbench' && data) {
    if (resolution === 'cancelled') {
      return (
        <Box sx={{ mt: 2, mb: 1, p: 1.5, borderRadius: 2, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <Typography variant="body2" sx={{ color: '#ef4444', fontWeight: 600 }}>
            Proposal rejected.
          </Typography>
        </Box>
      );
    }
    return (
      <LiveAppWorkbenchCard
        variant="chat"
        data={data}
        onCancel={() => setResolution('cancelled')}
        activeLens={activeLens}
      />
    );
  }

  if (type === 'RepoSetupProposal' && data) {
    if (resolution === 'cancelled') {
      return (
        <Box sx={{ mt: 2, mb: 1, p: 1.5, borderRadius: 2, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <Typography variant="body2" sx={{ color: '#ef4444', fontWeight: 600 }}>
            Proposal rejected.
          </Typography>
        </Box>
      );
    }
    return (
      <RepoSetupProposalCard
        variant="chat"
        data={data}
        onCancel={() => setResolution('cancelled')}
      />
    );
  }

  if (type === 'ProposedAction' && data) {
    const { workspaceName, command, procId, reason } = data;

    if (resolution === 'approved') {
      return (
        <Box sx={{ mt: 2, mb: 1, p: 1.5, borderRadius: 2, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)' }}>
          <Typography variant="body2" sx={{ color: '#22c55e', fontWeight: 600 }}>
            ✓ Approved — running now. Watch the panel on the right for live output and the evidence line when it finishes.
          </Typography>
        </Box>
      );
    }
    if (resolution === 'cancelled') {
      return (
        <Box sx={{ mt: 2, mb: 1, p: 1.5, borderRadius: 2, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <Typography variant="body2" sx={{ color: '#ef4444', fontWeight: 600 }}>
            Cancelled — nothing ran.
          </Typography>
        </Box>
      );
    }
    return (
      <ProposedActionCard
        variant="chat"
        workspaceName={workspaceName}
        command={command}
        reason={reason}
        riskLevel={data.riskLevel}
        executionMode={data.executionMode}
        isDryRun={data.isDryRun}
        allowed={data.allowed}
        description={data.description}
        onApprove={() => {
          if (procId && onApproveAction) {
            onApproveAction(procId, workspaceName, command);
          }
          setResolution('approved');
        }}
        onCancel={() => {
          if (procId && onCancelAction) {
            onCancelAction(procId);
          }
          setResolution('cancelled');
        }}
      />
    );
  }

  if (type === 'WorkspaceList' && Array.isArray(data)) {
    return (
      <Box sx={{ mt: 2, mb: 1 }}>
        <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 'bold' }}>
          Select a workspace to explore:
        </Typography>
        <Grid container spacing={2}>
          {data.map((ws: any, idx: number) => (
            <Grid item xs={12} sm={6} key={idx}>
              <Card sx={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <CardActionArea onClick={() => onAction(`List files in ${ws.name}`)}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <FolderIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: '600' }}>
                        {ws.name}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {ws.path}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (type === 'FileList' && data) {
    const { workspace, files } = data;
    return (
      <Box sx={{ mt: 2, mb: 1 }}>
        <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 'bold' }}>
          Safe Files in {workspace} (Click to read):
        </Typography>
        <Paper variant="outlined" sx={{ maxHeight: 250, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.1)' }}>
          <List dense>
            {files.slice(0, 100).map((file: string, idx: number) => (
              <ListItem key={idx} disablePadding>
                <ListItemButton onClick={() => onAction(`Read file ${file} in ${workspace}`)}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <InsertDriveFileIcon fontSize="small" sx={{ color: '#a0aec0' }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary={file} 
                    primaryTypographyProps={{ variant: 'body2', sx: { fontFamily: 'monospace', color: '#e2e8f0' } }} 
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Paper>
        {files.length > 100 && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Showing first 100 of {files.length} files. Use search to find specific items.
          </Typography>
        )}
      </Box>
    );
  }

  if (type === 'CodePreview' && data) {
    const { workspace, path: filePath, content } = data;
    return (
      <Box sx={{ mt: 2, mb: 1, width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bg: 'rgba(255,255,255,0.03)', p: 1, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CodeIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#e2e8f0' }}>
              {workspace} / {filePath}
            </Typography>
          </Box>
        </Box>
        <Paper 
          variant="outlined" 
          sx={{ 
            p: 1.5, 
            background: '#151515', 
            borderColor: 'rgba(255,255,255,0.1)', 
            borderTopLeftRadius: 0, 
            borderTopRightRadius: 0,
            overflowX: 'auto' 
          }}
        >
          <Typography 
            component="pre" 
            variant="body2" 
            sx={{ 
              fontFamily: 'monospace', 
              fontSize: '0.8rem', 
              color: '#f8fafc',
              whiteSpace: 'pre',
              margin: 0
            }}
          >
            {content}
          </Typography>
        </Paper>
      </Box>
    );
  }

  if (type === 'SearchResults' && data) {
    const { workspace, keyword, results } = data;
    return (
      <Box sx={{ mt: 2, mb: 1 }}>
        <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 'bold' }}>
          Matches for &quot;{keyword}&quot; in {workspace}:
        </Typography>
        <List dense sx={{ width: '100%' }}>
          {results.map((res: any, idx: number) => (
            <Paper key={idx} sx={{ p: 1.5, mb: 1.5, background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }} variant="outlined">
              <Box 
                sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mb: 1 }}
                onClick={() => onAction(`Read file ${res.file} in ${workspace}`)}
              >
                <SearchIcon fontSize="small" sx={{ mr: 1, color: '#7f5af0' }} />
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold', textDecoration: 'underline', color: '#e2e8f0' }}>
                  {res.file}
                </Typography>
              </Box>
              <Divider sx={{ my: 0.5, borderColor: 'rgba(255,255,255,0.05)' }} />
              {res.matches.map((match: string, matchIdx: number) => (
                <Typography 
                  key={matchIdx} 
                  variant="caption" 
                  component="div" 
                  sx={{ 
                    fontFamily: 'monospace', 
                    color: '#94a3b8', 
                    pl: 2, 
                    py: 0.25,
                    borderLeft: '2px solid rgba(255,255,255,0.2)',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {match}
                </Typography>
              ))}
            </Paper>
          ))}
        </List>
      </Box>
    );
  }

  if (type === 'WorkflowsList' && data) {
    const { source, workflows, error } = data;

    return (
      <Box sx={{ mt: 2, mb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 'bold' }}>
            {source === 'flowright' ? 'Flowright Governed Workflows' : 'Soothsayer Live Workflows Preview'}
          </Typography>
          <Chip
            label={source === 'flowright' ? 'Governed Kernel' : 'Preview Only'}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.65rem',
              background: source === 'flowright' ? 'rgba(127, 85, 240, 0.08)' : 'rgba(245, 158, 11, 0.08)',
              color: source === 'flowright' ? '#b794f4' : '#f59e0b',
              border: source === 'flowright' ? '1px solid rgba(127, 85, 240, 0.15)' : '1px solid rgba(245, 158, 11, 0.15)'
            }}
          />
        </Box>

        {error ? (
          <Paper variant="outlined" sx={{ p: 2, background: 'rgba(239, 68, 68, 0.03)', borderColor: 'rgba(239,68,68,0.15)', borderRadius: '8px' }}>
            <Typography variant="body2" sx={{ color: '#ef4444', fontWeight: 600 }}>
              {error}
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {workflows.map((wf: any, idx: number) => (
              <Grid item xs={12} key={idx}>
                <Card sx={{ background: 'rgba(255, 255, 255, 0.015)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: '700', color: '#f4f4f5' }}>
                        {wf.name}
                      </Typography>
                      <Chip
                        label={wf.previewOnly ? 'PREVIEW ONLY' : 'RUNNABLE'}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.55rem',
                          fontWeight: 700,
                          background: wf.previewOnly ? 'rgba(245, 158, 11, 0.08)' : 'rgba(34, 197, 94, 0.08)',
                          color: wf.previewOnly ? '#f59e0b' : '#22c55e',
                          border: wf.previewOnly ? '1px solid rgba(245, 158, 11, 0.15)' : '1px solid rgba(34, 197, 94, 0.15)'
                        }}
                      />
                    </Box>

                    <Typography variant="caption" sx={{ color: '#cbd5e1', display: 'block', mb: 1 }}>
                      {wf.description}
                    </Typography>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 700, display: 'block', mb: 0.5 }}>
                        INPUTS REQUIRED:
                      </Typography>
                      {wf.inputs && wf.inputs.length > 0 ? (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                          {wf.inputs.map((inp: any, iIdx: number) => (
                            <Chip
                              key={iIdx}
                              label={typeof inp === 'string' ? inp : inp.name}
                              size="small"
                              sx={{ height: 16, fontSize: '0.6rem', fontFamily: 'monospace', background: 'rgba(255,255,255,0.03)', color: '#a0aec0' }}
                            />
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="caption" sx={{ color: '#71717a', fontStyle: 'italic' }}>
                          None
                        </Typography>
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      {!wf.previewOnly && wf.id === 'websiteops.website_content_publish.v0' ? (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => onAction('write a blog')}
                          sx={{ background: '#7f5af0', textTransform: 'none', fontWeight: 700, borderRadius: '6px', '&:hover': { background: '#6d47dd' } }}
                        >
                          Open ContentOps starter
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          disabled
                          sx={{ color: '#71717a', borderColor: 'rgba(255,255,255,0.08)', textTransform: 'none', borderRadius: '6px' }}
                        >
                          Preview only
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    );
  }

  if (type === 'ContentOpsStarter' && data) {
    const { schema, siteGoal: initSiteGoal, contentBrief: initContentBrief, targetPages: initTargetPages, publishConstraints, schemaSource } = data;
    
    const [siteGoal, setSiteGoal] = useState(initSiteGoal || '');
    const [targetPages, setTargetPages] = useState(initTargetPages || '');
    const [contentBrief, setContentBrief] = useState(initContentBrief || '');
    const [busy, setBusy] = useState(false);

    const isFormValid = siteGoal.trim() !== '' && targetPages.trim() !== '' && contentBrief.trim() !== '';

    const handleStart = async () => {
      if (!isFormValid || busy) return;
      setBusy(true);
      if (onStartContentWorkflow) {
        await onStartContentWorkflow({
          siteGoal,
          targetPages,
          contentBrief,
          sourceMaterial: '',
          seoRequirements: '',
          publishConstraints
        });
      }
      setBusy(false);
    };

    return (
      <Paper variant="outlined" sx={{ p: 3, background: 'rgba(255, 255, 255, 0.02)', borderColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '12px' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle2" sx={{ color: '#b794f4', fontWeight: 800, letterSpacing: '0.05em' }}>
            CONTENTOPS GOVERNED RUN STARTER
          </Typography>
          <Chip label={`Schema Source: ${schemaSource || 'local template'}`} size="small" sx={{ height: 18, fontSize: '0.6rem', background: 'rgba(127, 85, 240, 0.1)', color: '#b794f4' }} />
        </Box>

        <Typography variant="caption" sx={{ color: '#a0aec0', display: 'block', mb: 3, lineHeight: 1.5 }}>
          Create and dry-run a content generation and validation run using the dynamic schema definition below. Action is approval-gated; publishing requires manual execution outside the loop.
        </Typography>

        <Stack spacing={2.5}>
          {schema.inputs.map((input: any) => {
            let val = '';
            let onChange = (e: any) => {};
            if (input.name === 'siteGoal') {
              val = siteGoal;
              onChange = (e: any) => setSiteGoal(e.target.value);
            } else if (input.name === 'targetPages') {
              val = targetPages;
              onChange = (e: any) => setTargetPages(e.target.value);
            } else if (input.name === 'contentBrief') {
              val = contentBrief;
              onChange = (e: any) => setContentBrief(e.target.value);
            }

            return (
              <TextField
                key={input.name}
                label={input.label}
                value={val}
                onChange={onChange}
                size="small"
                fullWidth
                required={input.required}
                multiline={input.name !== 'targetPages'}
                minRows={input.name === 'contentBrief' ? 3 : 2}
                placeholder={input.description}
                helperText={input.description}
                FormHelperTextProps={{ sx: { color: '#71717a', fontSize: '0.7rem' } }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(0,0,0,0.2)',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' }
                  },
                  '& .MuiInputLabel-root': { color: '#cbd5e1' }
                }}
              />
            );
          })}

          <Box>
            <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 700, display: 'block', mb: 0.5 }}>
              PUBLISHING CONSTRAINTS
            </Typography>
            <Paper variant="outlined" sx={{ p: 1.5, background: 'rgba(0,0,0,0.15)', borderColor: 'rgba(255,255,255,0.04)' }}>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#cbd5e1', display: 'block' }}>
                {publishConstraints}
              </Typography>
            </Paper>
          </Box>

          <Button
            variant="contained"
            disabled={!isFormValid || busy}
            onClick={handleStart}
            sx={{
              background: '#7f5af0',
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: '8px',
              mt: 1,
              '&:hover': { background: '#6d47dd' }
            }}
          >
            {busy ? 'Starting run...' : 'Start governed run'}
          </Button>
        </Stack>
      </Paper>
    );
  }

  return null;
};
