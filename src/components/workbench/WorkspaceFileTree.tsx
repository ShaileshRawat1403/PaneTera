// src/components/workbench/WorkspaceFileTree.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Paper, CircularProgress, List, ListItemButton, ListItemText, Button, TextField } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import FolderIcon from '@mui/icons-material/Folder';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { accent, ink, radius, surface, typography } from '../../theme/tokens';
import { buildFileTree, filterFileTree, topLevelDirectories, type FileTreeNode } from './fileTreeModel';

interface Workspace {
  id: string;
  name: string;
  path: string;
  type: string;
}

interface FileTreeProps {
  token: string;
  workspace: Workspace;
  selectedFile: string | null;
  onSelectFile: (relPath: string) => void;
  onFilesLoaded?: (files: FileInfo[]) => void;
}

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

export const WorkspaceFileTree: React.FC<FileTreeProps> = ({
  token,
  workspace,
  selectedFile,
  onSelectFile,
  onFilesLoaded
}) => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [gitStatus, setGitStatus] = useState<string>('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tree = useMemo(() => buildFileTree(files), [files]);
  const visibleTree = useMemo(() => filterFileTree(tree, query), [tree, query]);

  const fetchFiles = async () => {
    setLoading(true);
    setFiles([]);
    setError('');
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
          arguments: { maxDepth: 5 }
        })
      });
      const result = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(result?.error || `File listing failed (${resp.status})`);
      const text = result?.content?.[0]?.text;
      if (typeof text !== 'string') throw new Error('The project returned an invalid file listing.');
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed?.files)) throw new Error('The project returned an invalid file listing.');
      setFiles(parsed.files);
      setExpanded(new Set(topLevelDirectories(buildFileTree(parsed.files))));
      onFilesLoaded?.(parsed.files);

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
    } catch (err: unknown) {
      console.error('Failed to query workspace files list:', err);
      setError(err instanceof Error ? err.message : 'PaneTera could not list this project.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [workspace.id, token]);

  const renderTree = () => {
    if (error) {
      return (
        <Box role="alert" sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: ink.secondary, mb: 1.5 }}>{error}</Typography>
          <Button size="small" onClick={fetchFiles}>Try again</Button>
        </Box>
      );
    }

    if (files.length === 0) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: ink.muted }}>No inspectable files found in this project.</Typography>
        </Box>
      );
    }

    const searching = Boolean(query.trim());

    const renderNodes = (nodes: readonly FileTreeNode[], depth = 0): React.ReactNode => nodes.map((file) => {
      const isSelected = selectedFile === file.path;
      const isExpanded = searching || expanded.has(file.path);
      if (file.isDirectory) {
        return (
          <React.Fragment key={file.path}>
            <ListItemButton
              onClick={() => setExpanded((current) => {
                const next = new Set(current);
                if (next.has(file.path)) next.delete(file.path); else next.add(file.path);
                return next;
              })}
              aria-expanded={isExpanded}
              sx={{ py: 0.375, pl: 1 + depth * 1.5, pr: 1, borderRadius: `${radius.sm}px` }}
            >
              {isExpanded ? <ExpandMoreIcon sx={{ mr: 0.5, fontSize: 16, color: ink.muted }} /> : <ChevronRightIcon sx={{ mr: 0.5, fontSize: 16, color: ink.muted }} />}
              <FolderIcon sx={{ mr: 1, fontSize: 15, color: accent.violet }} />
              <ListItemText primary={file.name} primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '0.75rem', color: ink.secondary, fontWeight: 600 } }} />
            </ListItemButton>
            {isExpanded ? renderNodes(file.children, depth + 1) : null}
          </React.Fragment>
        );
      }

      return (
        <ListItemButton
          key={file.path}
          selected={isSelected}
          onClick={() => onSelectFile(file.path)}
          sx={{ py: 0.375, pl: 3.5 + depth * 1.5, pr: 1, borderRadius: `${radius.sm}px`, '&.Mui-selected': { backgroundColor: accent.violetMuted }, '&:hover': { backgroundColor: surface.overlay } }}
        >
          <InsertDriveFileIcon sx={{ mr: 1, fontSize: 13, color: isSelected ? accent.violet : ink.muted }} />
          <ListItemText primary={file.name} primaryTypographyProps={{ variant: 'body2', noWrap: true, sx: { fontSize: '0.72rem', color: isSelected ? accent.violet : ink.secondary, fontFamily: typography.mono } }} />
        </ListItemButton>
      );
    });

    return (
      <List dense disablePadding>
        {renderNodes(visibleTree)}
      </List>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Title block */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 650, color: ink.primary }}>
            {workspace.name}
          </Typography>
          <Typography variant="caption" sx={{ color: ink.muted, wordBreak: 'break-all' }}>
            {workspace.path}
          </Typography>
        </Box>
        <Button size="small" variant="outlined" onClick={fetchFiles} disabled={loading} startIcon={<RefreshIconView />} sx={{ textTransform: 'none', fontSize: '0.7rem', borderColor: surface.border }}>
          Refresh
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, alignItems: 'center', justifyContent: 'center', p: 3, textAlign: 'center', gap: 2 }}>
          <CircularProgress size={24} sx={{ color: accent.violet }} />
          <Typography variant="body2" sx={{ color: ink.secondary, fontWeight: 600 }}>
            Indexing project files…
          </Typography>
          <Typography variant="caption" sx={{ color: ink.muted, maxWidth: '240px', lineHeight: 1.4 }}>
            Large projects may take a few seconds. Hidden, dependency, and generated folders are skipped.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0 }}>
          {/* File listing column */}
          <Paper variant="outlined" sx={{ flexGrow: 1, backgroundColor: surface.sunken, borderColor: surface.border, overflowY: 'auto', p: 1.5, mb: 2 }}>
            <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 650, letterSpacing: '0.05em', display: 'block', mb: 1 }}>
              FILES · {files.filter((file) => !file.isDirectory).length}
            </Typography>
            <TextField value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a file" size="small" fullWidth inputProps={{ 'aria-label': 'Find a file in this project' }} sx={{ mb: 1.25 }} />
            {renderTree()}
          </Paper>

          {gitStatus && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 650, letterSpacing: '0.05em', display: 'block', mb: 1 }}>
                GIT STATUS
              </Typography>
              <Paper variant="outlined" sx={{ p: 1, backgroundColor: surface.sunken, borderColor: surface.border }}>
                <Typography variant="body2" sx={{ fontFamily: typography.mono, fontSize: '0.65rem', whiteSpace: 'pre-wrap', color: ink.muted }}>
                  {gitStatus}
                </Typography>
              </Paper>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

const RefreshIconView = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
  </svg>
);
