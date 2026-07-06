// src/components/InteractiveComponent.tsx
import React, { useState } from 'react';
import { Box, Typography, Card, CardContent, CardActionArea, Grid, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Paper, Divider } from '@mui/material';
import type { UiComponent } from '../../shared/uiComponent';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import SearchIcon from '@mui/icons-material/Search';
import CodeIcon from '@mui/icons-material/Code';
import { ProposedActionCard } from './ProposedActionCard';
import { RepoSetupProposalCard } from './RepoSetupProposalCard';

interface ComponentProps {
  uiComponent: UiComponent;
  onAction: (query: string) => void;
  onApproveAction?: (id: string, workspaceName: string, command: string) => void;
  onCancelAction?: (id: string) => void;
}

export const InteractiveComponent: React.FC<ComponentProps> = ({ uiComponent, onAction, onApproveAction, onCancelAction }) => {
  const { type, data } = uiComponent;
  // Local only — the message log itself stays append-only/immutable, so
  // "did I already act on this" lives here rather than mutating history.
  const [resolution, setResolution] = useState<'pending' | 'approved' | 'cancelled'>('pending');

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

  return null;
};
