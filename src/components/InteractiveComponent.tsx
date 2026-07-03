// src/components/InteractiveComponent.tsx
import React from 'react';
import { Box, Typography, Card, CardContent, CardActionArea, Grid, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Paper, Divider } from '@mui/material';
import type { UiComponent } from '../../shared/uiComponent';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import SearchIcon from '@mui/icons-material/Search';
import CodeIcon from '@mui/icons-material/Code';

interface ComponentProps {
  uiComponent: UiComponent;
  onAction: (query: string) => void;
}

export const InteractiveComponent: React.FC<ComponentProps> = ({ uiComponent, onAction }) => {
  const { type, data } = uiComponent;

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
