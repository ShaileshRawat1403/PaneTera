// src/components/workbench/WorkspaceFileTree.tsx
import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, CircularProgress, Divider, List, ListItem, ListItemText, Stack, Chip, Button } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import FolderIcon from '@mui/icons-material/Folder';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import DnsIcon from '@mui/icons-material/Dns';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

interface Workspace {
  id: string;
  name: string;
  path: string;
  type: string;
}

interface FileTreeProps {
  token: string;
  workspace: Workspace;
}

interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

export const WorkspaceFileTree: React.FC<FileTreeProps> = ({ token, workspace }) => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [gitStatus, setGitStatus] = useState<string>('');
  
  // File viewer state
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [readError, setReadError] = useState<string>('');
  const [reading, setReading] = useState(false);

  const fetchFiles = async () => {
    setLoading(true);
    setFiles([]);
    setSelectedFile(null);
    setFileContent('');
    setReadError('');
    try {
      // 1. Fetch file list
      const resp = await fetch('/api/myai-workspaces/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId: workspace.id,
          toolName: 'workspace.listFiles',
          arguments: { maxDepth: 3 }
        })
      });
      if (resp.ok) {
        const result = await resp.json();
        const parsed = JSON.parse(result.content[0].text);
        if (parsed.files) {
          setFiles(parsed.files);
        }
      }

      // 2. Fetch git status
      const gitResp = await fetch('/api/myai-workspaces/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId: workspace.id,
          toolName: 'workspace.getGitStatus'
        })
      });
      if (gitResp.ok) {
        const gitResult = await gitResp.json();
        setGitStatus(gitResult.content[0].text);
      }
    } catch (err: any) {
      console.error('Failed to query workspace:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [workspace.id, token]);

  const handleReadFile = async (relPath: string) => {
    setSelectedFile(relPath);
    setReading(true);
    setFileContent('');
    setReadError('');
    try {
      const resp = await fetch('/api/myai-workspaces/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId: workspace.id,
          toolName: 'workspace.readFile',
          arguments: { relativePath: relPath }
        })
      });
      const data = await resp.json();
      if (resp.ok) {
        setFileContent(data.content[0].text);
      } else {
        setReadError(data.error || 'Failed to read file.');
      }
    } catch (err: any) {
      setReadError(err.message || 'Error occurred reading file.');
    } finally {
      setReading(false);
    }
  };

  // Render tree structure
  const renderTree = () => {
    if (files.length === 0) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: '#71717a' }}>No files found in workspace root.</Typography>
        </Box>
      );
    }

    // Sort: directories first, then alphabetically
    const sorted = [...files].sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.path.localeCompare(b.path);
    });

    return (
      <List dense disablePadding>
        {sorted.map((file) => {
          const isSelected = selectedFile === file.path;
          if (file.isDirectory) {
            return (
              <ListItem
                key={file.path}
                sx={{
                  py: 0.5,
                  px: 1,
                  opacity: 0.85
                }}
              >
                <FolderIcon sx={{ mr: 1, fontSize: 15, color: '#b794f4' }} />
                <ListItemText
                  primary={<Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 600 }}>{file.path}</Typography>}
                />
              </ListItem>
            );
          } else {
            return (
              <ListItem
                key={file.path}
                onClick={() => handleReadFile(file.path)}
                sx={{
                  py: 0.5,
                  px: 2.5,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(127, 85, 240, 0.05)' : 'transparent',
                  '&:hover': { background: 'rgba(255,255,255,0.02)' }
                }}
              >
                <InsertDriveFileIcon sx={{ mr: 1, fontSize: 13, color: '#a1a1aa' }} />
                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ fontSize: '0.72rem', color: isSelected ? '#b794f4' : '#cbd5e1', fontFamily: 'monospace' }}>
                      {file.name}
                    </Typography>
                  }
                />
              </ListItem>
            );
          }
        })}
      </List>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Title block */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#f4f4f5' }}>
            {workspace.name}
          </Typography>
          <Typography variant="caption" sx={{ color: '#71717a', wordBreak: 'break-all' }}>
            {workspace.path}
          </Typography>
        </Box>
        <Button size="small" variant="outlined" onClick={fetchFiles} startIcon={<RefreshIconView />} sx={{ textTransform: 'none', fontSize: '0.7rem', borderColor: 'rgba(255,255,255,0.05)' }}>
          Refresh
        </Button>
      </Box>

      {/* Main split plane */}
      {loading ? (
        <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={24} sx={{ color: '#7f5af0' }} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexGrow: 1, minHeight: 0, gap: 2 }}>
          {/* File listing column */}
          <Paper variant="outlined" sx={{ width: '35%', background: 'rgba(255, 255, 255, 0.005)', borderColor: 'rgba(255, 255, 255, 0.05)', overflowY: 'auto', p: 1.5, minWidth: 200 }}>
            <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
              FILE EXPLORER
            </Typography>
            {renderTree()}

            {gitStatus && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, letterSpacing: '0.05em', display: 'block', mb: 1 }}>
                  GIT STATUS
                </Typography>
                <Paper variant="outlined" sx={{ p: 1, background: 'rgba(9,9,11,0.2)', borderColor: 'rgba(255,255,255,0.03)' }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.65rem', whiteSpace: 'pre-wrap', color: '#a1a1aa' }}>
                    {gitStatus}
                  </Typography>
                </Paper>
              </Box>
            )}
          </Paper>

          {/* Code Viewer column */}
          <Paper variant="outlined" sx={{ width: '65%', flexGrow: 1, background: 'rgba(9, 9, 11, 0.2)', borderColor: 'rgba(255,255,255,0.05)', p: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {selectedFile ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                {/* Header bar */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, borderBottom: '1px solid rgba(255,255,255,0.06)', mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#f4f4f5', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {selectedFile}
                  </Typography>
                  <Chip label="Read-Only" size="small" sx={{ height: 18, fontSize: '0.6rem', background: 'rgba(255,255,255,0.04)', color: '#a1a1aa' }} />
                </Box>

                {/* Content area */}
                <Box sx={{ flexGrow: 1, overflowY: 'auto', minHeight: 0 }}>
                  {reading ? (
                    <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                      <CircularProgress size={16} sx={{ color: '#7f5af0' }} />
                    </Box>
                  ) : readError ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', p: 3, textAlign: 'center' }}>
                      <LockOutlinedIcon sx={{ fontSize: 32, color: '#ef4444', mb: 1.5 }} />
                      <Typography variant="subtitle2" sx={{ color: '#ef4444', fontWeight: 700, mb: 0.5 }}>
                        ACCESS BLOCKED BY HOST POLICY
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#a1a1aa', maxWidth: 300, display: 'block' }}>
                        {readError}
                      </Typography>
                    </Box>
                  ) : (
                    <pre style={{ margin: 0, padding: 0, fontFamily: 'monospace', fontSize: '0.75rem', color: '#e4e4e7', whiteSpace: 'pre-wrap' }}>
                      <code>{fileContent}</code>
                    </pre>
                  )}
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                <DnsIcon sx={{ fontSize: 40, color: '#71717a', mb: 1.5 }} />
                <Typography variant="body2" sx={{ color: '#a1a1aa' }}>Select a file from the explorer tree to view its content.</Typography>
              </Box>
            )}
          </Paper>
        </Box>
      )}
    </Box>
  );
};

// Local minimal icons
const RefreshIconView = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
  </svg>
);
