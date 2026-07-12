import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Paper, Divider, IconButton, Button, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Grid, Card, CardContent, CardActionArea, Tooltip, LinearProgress, CircularProgress, Tabs, Tab, Chip, Stack, Collapse } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import SearchIcon from '@mui/icons-material/Search';
import TerminalIcon from '@mui/icons-material/Terminal';
import CodeIcon from '@mui/icons-material/Code';
import DnsIcon from '@mui/icons-material/Dns';
import InfoIcon from '@mui/icons-material/Info';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import ViewStreamIcon from '@mui/icons-material/ViewStream';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LaunchIcon from '@mui/icons-material/Launch';
import PushPinIcon from '@mui/icons-material/PushPin';

export type { FeedItem } from '../../shared/uiComponent';
import type { FeedItem } from '../../shared/uiComponent';
import { ProposedActionCard } from './ProposedActionCard';
import { RepoSetupProposalCard } from './RepoSetupProposalCard';
import { LiveAppWorkbenchCard } from './LiveAppWorkbenchCard';
import { ContentWorkflowCard } from './ContentWorkflowCard';
import { InteractiveComponent } from './InteractiveComponent';

interface PreviewProps {
  previewFeed: FeedItem[];
  onClose: () => void;
  onAction: (query: string) => void;
  onRemoveItem: (id: string) => void;
  onClearFeed: () => void;
  onApproveAction: (id: string, workspaceName: string, command: string) => void;
  onContentWorkflowReview?: (itemId: string, runId: string, action: 'approve' | 'reject' | 'request_revision', notes: string) => void;
  token: string;
  onOpenInWorkbench?: (item: any) => void;
  loading?: boolean;
}

// 3D MacBook Screen Simulator with beveled aluminum hinge base
const LaptopBrowserFrame: React.FC<{ url: string; children: React.ReactNode }> = ({ url, children }) => {
  return (
    <Box
      sx={{
        width: '100%',
        perspective: '1200px',
        mt: 2,
        mb: 1.5
      }}
    >
      <Box
        sx={{
          background: 'rgba(24, 24, 27, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px 16px 4px 4px',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 100px rgba(127, 85, 240, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          transform: 'perspective(1200px) rotateX(1deg) rotateY(-0.5deg)',
          transformStyle: 'preserve-3d',
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          '&:hover': {
            transform: 'perspective(1200px) rotateX(3.5deg) rotateY(-1.8deg) translateZ(10px)',
            borderColor: 'rgba(127, 85, 240, 0.35)',
            boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6), 0 0 120px rgba(127, 85, 240, 0.08)'
          }
        }}
      >
        {/* macOS Window Controls Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 2.5,
            py: 1.25,
            background: 'rgba(255, 255, 255, 0.03)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            gap: 2
          }}
        >
          <Box sx={{ display: 'flex', gap: 0.8 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ff5f56', boxShadow: '0 0 4px #ff5f56' }} />
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ffbd2e', boxShadow: '0 0 4px #ffbd2e' }} />
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#27c93f', boxShadow: '0 0 4px #27c93f' }} />
          </Box>

          {/* URL Address bar */}
          <Box
            sx={{
              flexGrow: 1,
              mx: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '6px',
              py: 0.5,
              px: 2,
              transition: 'all 0.3s ease'
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontFamily: 'monospace',
                color: '#8e8e93',
                fontSize: '0.7rem',
                letterSpacing: '0.02em',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                maxWidth: 280
              }}
            >
              {url}
            </Typography>
          </Box>
        </Box>

        {/* Viewport Content */}
        <Box sx={{ p: 2.5, background: '#070709', minHeight: 180 }}>
          {children}
        </Box>
      </Box>

      {/* MacBook Bottom hinge and silver aluminum stand simulation */}
      <Box
        sx={{
          height: '6px',
          width: '98%',
          margin: '0 auto',
          background: 'linear-gradient(90deg, #3f3f46 0%, #71717a 50%, #3f3f46 100%)',
          borderRadius: '0 0 16px 16px',
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.6), 0 1px 2px rgba(255, 255, 255, 0.1) inset',
          borderTop: '1px solid rgba(0,0,0,0.4)',
          position: 'relative',
          zIndex: 5
        }}
      />
    </Box>
  );
};

// Live ecosystem status board. Replaces the old static architecture
// diagram with real data: registered workspaces (portal.yaml) and their
// actual git state, polled on an interval. Anything not wired to a real
// signal yet (dax) is shown honestly as not-connected rather than faked —
// a decision-maker-facing board earns trust by never bluffing.
interface WorkspaceStatus {
  name: string;
  path: string;
  status: 'clean' | 'changes' | 'unknown';
  latestCommit: string;
  loading: boolean;
}

const EcosystemStatusBoard: React.FC<{ token: string; onAction: (q: string) => void }> = ({ token, onAction }) => {
  const [workspaces, setWorkspaces] = useState<WorkspaceStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const wsResp = await fetch('/api/workspaces', { headers: { Authorization: `Bearer ${token}` } });
      const wsList: { name: string; path: string }[] = await wsResp.json();

      const results = await Promise.all(
        wsList.map(async (ws) => {
          try {
            const gResp = await fetch(`/api/git/history?workspace=${encodeURIComponent(ws.name)}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const g = await gResp.json();
            const statusText: string = g.status || '';
            const logText: string = g.log || '';
            const latestCommit = logText.split('\n').find((l: string) => l.trim().length > 0) || 'No commits found';
            let status: WorkspaceStatus['status'] = 'unknown';
            if (/no git active/i.test(statusText)) status = 'unknown';
            else if (/clean working tree/i.test(statusText) || statusText.trim() === '') status = 'clean';
            else status = 'changes';
            return { name: ws.name, path: ws.path, status, latestCommit, loading: false };
          } catch {
            return { name: ws.name, path: ws.path, status: 'unknown' as const, latestCommit: 'Unable to read', loading: false };
          }
        })
      );
      setWorkspaces(results);
    } catch {
      // /api/workspaces unreachable — leave prior state, try again next tick
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const statusColor = (s: WorkspaceStatus['status']) =>
    s === 'clean' ? '#22c55e' : s === 'changes' ? '#f59e0b' : '#71717a';
  const statusLabel = (s: WorkspaceStatus['status']) =>
    s === 'clean' ? 'Up to date' : s === 'changes' ? 'Uncommitted changes' : 'No signal';

  return (
    <Box sx={{ mb: 2.5, p: 2, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '16px' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="caption" sx={{ color: '#b794f4', fontWeight: 700, letterSpacing: '0.05em' }}>
          ECOSYSTEM STATUS
        </Typography>
        <Typography variant="caption" sx={{ color: '#71717a', fontSize: '0.65rem' }}>
          Refreshes every 15s
        </Typography>
      </Box>

      {loading ? (
        <LinearProgress sx={{ my: 1 }} />
      ) : (
        <Grid container spacing={1.5}>
          {workspaces.map((ws) => (
            <Grid item xs={12} sm={6} key={ws.name}>
              <Card
                onClick={() => onAction(`git status in ${ws.name}`)}
                sx={{
                  background: 'rgba(255,255,255,0.01)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '12px',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  '&:hover': {
                    borderColor: 'rgba(127, 85, 240, 0.35)',
                    boxShadow: '0 4px 20px rgba(127, 85, 240, 0.1)',
                    transform: 'translateY(-1px)'
                  }
                }}
              >
                <CardActionArea>
                  <CardContent sx={{ p: 1.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColor(ws.status), boxShadow: `0 0 6px ${statusColor(ws.status)}` }} />
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#f4f4f5' }}>{ws.name}</Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: statusColor(ws.status), fontSize: '0.65rem', fontWeight: 600 }}>
                        {statusLabel(ws.status)}
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ws.latestCommit}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}

          {/* Honest placeholder — dax has no live signal wired up yet */}
          <Grid item xs={12} sm={6}>
            <Card
              variant="outlined"
              sx={{ background: 'transparent', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '12px', boxShadow: 'none' }}
            >
              <CardContent sx={{ p: 1.75 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid #71717a' }} />
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#a1a1aa' }}>dax</Typography>
                </Box>
                <Typography variant="caption" sx={{ color: '#71717a', fontSize: '0.72rem' }}>
                  Not connected yet — governance events land here in a later phase.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

// Sub-component for individual FileList items with tabs
const FileListFeedCard: React.FC<{ data: any; onAction: (q: string) => void }> = ({ data, onAction }) => {
  const [tabValue, setTabValue] = useState(0);

  const getWorkspaceStats = (name: string) => {
    return {
      stack: [],
      desc: `${name} — registered workspace`,
      nodes: []
    };
  };

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255, 255, 255, 0.06)', mb: 2 }}>
        <Tabs value={tabValue} onChange={(e, val) => setTabValue(val)} sx={{ minHeight: 32, '& .MuiTab-root': { minHeight: 32, py: 0.5, fontSize: '0.75rem', fontWeight: 600 } }}>
          <Tab label="Files" />
          <Tab label="Architecture" />
        </Tabs>
      </Box>

      {tabValue === 0 ? (
        <Box
          sx={{
            maxHeight: 320,
            overflowY: 'auto',
            overflowX: 'hidden',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.04)',
            background: 'rgba(0,0,0,0.1)',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <List dense sx={{ p: 0 }}>
            {data.files.map((file: string, idx: number) => (
              <ListItem key={idx} disablePadding divider={idx < data.files.length - 1} sx={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                <ListItemButton onClick={() => onAction(`Read file ${file} in ${data.workspace}`)} sx={{ py: 1 }}>
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    <InsertDriveFileIcon sx={{ color: '#7f5af0', fontSize: 16 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={file}
                    primaryTypographyProps={{
                      variant: 'body2',
                      sx: { fontFamily: 'monospace', color: '#cbd5e1', fontSize: '0.8rem' }
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      ) : (
        <Box sx={{ py: 0.5 }}>
          <Paper variant="outlined" sx={{ p: 2, mb: 2, background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.04)', borderRadius: '12px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <InfoIcon sx={{ color: '#7f5af0', fontSize: 16 }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#cbd5e1' }}>
                Local Session Record
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, lineHeight: 1.5 }}>
              {getWorkspaceStats(data.workspace).desc}
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {getWorkspaceStats(data.workspace).stack.map((tech, tIdx) => (
                <Chip key={tIdx} label={tech} size="small" sx={{ height: 18, fontSize: '0.65rem', background: 'rgba(127, 85, 240, 0.08)', color: '#b794f4' }} />
              ))}
            </Stack>
          </Paper>

          <Typography variant="caption" sx={{ fontWeight: 600, color: '#cbd5e1', display: 'block', mb: 1 }}>
            Dependency Hierarchy
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            {getWorkspaceStats(data.workspace).nodes.map((node, nIdx) => (
              <React.Fragment key={nIdx}>
                <Paper
                  elevation={0}
                  sx={{
                    px: 1.5,
                    py: 1,
                    width: '100%',
                    background: 'rgba(127, 85, 240, 0.02)',
                    border: '1px solid rgba(127, 85, 240, 0.12)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5
                  }}
                >
                  <DnsIcon sx={{ fontSize: 12, color: '#7f5af0' }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#e2e8f0' }}>
                    {node}
                  </Typography>
                </Paper>
                {nIdx < getWorkspaceStats(data.workspace).nodes.length - 1 && (
                  <Box sx={{ height: 12, width: 1, background: 'rgba(127, 85, 240, 0.3)' }} />
                )}
              </React.Fragment>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

// Sub-component for sequential line-by-line Code Streaming
const CodePreviewFeedCard: React.FC<{ data: any }> = ({ data }) => {
  const [lines, setLines] = useState<string[]>([]);
  const rawLines = data.content.split('\n');

  useEffect(() => {
    setLines([]);
    let index = 0;
    const interval = setInterval(() => {
      if (index < rawLines.length) {
        setLines(prev => [...prev, rawLines[index]]);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 15);

    return () => clearInterval(interval);
  }, [data.content]);

  return (
    <Box
      sx={{
        background: '#040405',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.03)',
        p: 2,
        maxHeight: 350,
        overflow: 'auto'
      }}
    >
      <Typography
        component="pre"
        sx={{
          fontFamily: 'Fira Code, monospace',
          fontSize: '0.75rem',
          color: '#cbd5e1',
          margin: 0,
          lineHeight: 1.5,
          whiteSpace: 'pre'
        }}
      >
        {lines.map((line, i) => (
          <Box key={i} sx={{ display: 'flex', animation: 'fadeIn 0.1s ease-in-out' }}>
            <Box sx={{ width: 30, pr: 2, textAlign: 'right', color: 'rgba(255,255,255,0.15)', userSelect: 'none' }}>
              {i + 1}
            </Box>
            <Box sx={{ flexGrow: 1, whiteSpace: 'pre' }}>{line}</Box>
          </Box>
        ))}
        {lines.length < rawLines.length && (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
            <Box sx={{ width: 30, pr: 2 }} />
            <span className="terminal-cursor" style={{ width: 6, height: 12 }} />
          </Box>
        )}
      </Typography>
    </Box>
  );
};

// Sub-component for sequential search card animations
const SearchResultsFeedCard: React.FC<{ data: any; onAction: (q: string) => void }> = ({ data, onAction }) => {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    let index = 0;
    const interval = setInterval(() => {
      if (index < data.results.length) {
        setVisibleCount(prev => prev + 1);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [data.results]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {data.results.slice(0, visibleCount).map((res: any, idx: number) => (
        <Paper key={idx} sx={{ p: 1.5, background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.04)', borderRadius: '12px', animation: 'cardFadeIn 0.3s ease-in-out forwards' }} variant="outlined">
          <Box
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mb: 1 }}
            onClick={() => onAction(`Read file ${res.file} in ${data.workspace}`)}
          >
            <CodeIcon sx={{ mr: 1, color: '#7f5af0', fontSize: 16 }} />
            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600, textDecoration: 'underline', color: '#cbd5e1' }}>
              {res.file}
            </Typography>
          </Box>
          <Divider sx={{ my: 0.75, borderColor: 'rgba(255,255,255,0.03)' }} />
          {res.matches.map((match: string, matchIdx: number) => (
            <Box
              key={matchIdx}
              sx={{
                fontFamily: 'monospace',
                color: '#94a3b8',
                pl: 1.5,
                py: 0.25,
                borderLeft: '2px solid #7f5af0',
                fontSize: '0.75rem',
                my: 0.5,
                background: 'rgba(127, 85, 240, 0.01)',
                borderRadius: '6px',
                overflowX: 'auto',
                whiteSpace: 'pre'
              }}
            >
              {match}
            </Box>
          ))}
        </Paper>
      ))}
    </Box>
  );
};

// Sub-component for sequential workflows and CI/CD runs
const WorkflowsFeedCard: React.FC<{ data: any }> = ({ data }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="caption" sx={{ color: '#8e8e93', fontFamily: 'monospace' }}>
        Workflow execution history for workspace: {data.workspace}
      </Typography>
      {data.workflows.map((wf: any, idx: number) => (
        <Paper
          key={idx}
          variant="outlined"
          sx={{
            p: 2,
            background: 'rgba(255, 255, 255, 0.01)',
            borderColor: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            animation: 'cardFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: wf.status === 'success' ? '#22c55e' : '#ef4444',
                boxShadow: wf.status === 'success' ? '0 0 8px #22c55e' : '0 0 8px #ef4444'
              }}
            />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#f4f4f5' }}>
                {wf.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#a0aec0', fontSize: '0.65rem' }}>
                  Run {wf.lastRun}
                </Typography>
                <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 0.5 }} />
                <Typography variant="caption" sx={{ color: '#71717a', fontSize: '0.65rem' }}>
                  {wf.date}
                </Typography>
                <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 0.5 }} />
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#7f5af0', fontSize: '0.65rem' }}>
                  {wf.branch} ({wf.commit})
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, color: '#cbd5e1', fontSize: '0.7rem' }}>
              {wf.duration}
            </Typography>
            <Chip
              label={wf.status.toUpperCase()}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.55rem',
                fontWeight: 700,
                background: wf.status === 'success' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                color: wf.status === 'success' ? '#22c55e' : '#ef4444',
                border: wf.status === 'success' ? '1px solid rgba(34, 197, 94, 0.15)' : '1px solid rgba(239, 68, 68, 0.15)',
                mt: 0.5
              }}
            />
          </Box>
        </Paper>
      ))}
    </Box>
  );
};

// Sub-component for task process execution stdout/stderr streams
const ExecutionLogsFeedCard: React.FC<{ data: any; procId: string; token: string }> = ({ data, procId, token }) => {
  const [isRunning, setIsRunning] = useState(true);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [failedToStart, setFailedToStart] = useState(false);
  // Raw stdout/stderr is real and available, but it's not what a non-dev
  // user needs first — status is. Collapsed by default, auto-opened once
  // if something actually needs looking at.
  const [showRawOutput, setShowRawOutput] = useState(false);
  const [autoExpandedOnce, setAutoExpandedOnce] = useState(false);

  const handleStop = async () => {
    try {
      const resp = await fetch('/api/execute/kill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ procId })
      });
      if (resp.ok) {
        setIsRunning(false);
      }
    } catch (err) {
      console.error('Failed to terminate process:', err);
    }
  };

  useEffect(() => {
    // Check exit status logs for completion
    const lastLog = data.logs[data.logs.length - 1] || '';
    if (lastLog.includes('Process completed')) {
      setIsRunning(false);
      // Captured once, at actual completion — not recomputed on every
      // render, so the evidence line reflects when the run really finished.
      setCompletedAt(prev => prev || new Date().toLocaleString());
    } else if (lastLog.includes('Process failed to start')) {
      // It never actually ran, so there's no real pass/fail to confirm —
      // stop the spinner but do not show an evidence card.
      setIsRunning(false);
      setFailedToStart(true);
    }
  }, [data.logs]);

  // Only ever derived from the real "Process completed with exit code: N"
  // line the backend broadcasts. Deliberately not parsing tool-specific
  // output (test counts, coverage, etc.) — every runner formats that
  // differently, and a best-effort guess dressed up as a number is exactly
  // the kind of "looks real but might not be" this build keeps removing.
  const exitCodeMatch = data.logs.join('\n').match(/Process completed with exit code:\s*(-?\d+)/);
  const exitCode = exitCodeMatch ? parseInt(exitCodeMatch[1], 10) : null;
  const passed = exitCode === 0;
  const hasEvidence = exitCode !== null && completedAt !== null;

  const evidenceText = hasEvidence
    ? `${passed ? 'PASSED' : 'FAILED'} — ${data.workspaceName || 'workspace'}: "${data.command}" (exit code ${exitCode}) — confirmed ${completedAt}`
    : '';

  const handleCopyEvidence = () => {
    navigator.clipboard.writeText(evidenceText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-open the technical output once, only when there's actually
  // something worth looking at — a clean pass never needs it.
  useEffect(() => {
    if (!autoExpandedOnce && (failedToStart || (hasEvidence && !passed))) {
      setShowRawOutput(true);
      setAutoExpandedOnce(true);
    }
  }, [failedToStart, hasEvidence, passed, autoExpandedOnce]);

  return (
    <Box
      sx={{
        background: '#040405',
        p: 2,
        borderRadius: '12px',
        border: '1px solid rgba(127, 85, 240, 0.12)'
      }}
    >
      {/* Status-first: this is the thing a non-dev user actually came for */}
      {isRunning && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <CircularProgress size={14} sx={{ color: '#7f5af0' }} />
            <Typography variant="body2" sx={{ color: '#f4f4f5' }}>
              Running{' '}
              <Box component="span" sx={{ fontFamily: 'monospace', color: '#7f5af0', fontWeight: 700 }}>{data.command}</Box>{' '}
              in <Box component="span" sx={{ fontWeight: 700 }}>{data.workspaceName || 'workspace'}</Box>
            </Typography>
          </Box>
          <Button
            size="small"
            onClick={handleStop}
            sx={{
              fontSize: '0.6rem',
              py: 0.25,
              px: 1.5,
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '4px'
            }}
          >
            TERMINATE
          </Button>
        </Box>
      )}

      {!isRunning && failedToStart && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 6px #ef4444' }} />
          <Typography variant="body2" sx={{ color: '#ef4444', fontWeight: 700 }}>
            Couldn't start — see technical output below for why.
          </Typography>
        </Box>
      )}

      {hasEvidence && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: passed ? '#22c55e' : '#ef4444',
                boxShadow: passed ? '0 0 6px #22c55e' : '0 0 6px #ef4444',
                flexShrink: 0
              }}
            />
            <Box>
              <Typography variant="body2" sx={{ color: passed ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                {passed ? 'Passed' : 'Failed'} — {data.workspaceName || 'workspace'}: "{data.command}"
              </Typography>
              <Typography variant="caption" sx={{ color: '#71717a', fontSize: '0.68rem' }}>
                exit code {exitCode} — confirmed {completedAt}
              </Typography>
            </Box>
          </Box>
          <Button
            size="small"
            onClick={handleCopyEvidence}
            sx={{
              fontSize: '0.65rem',
              py: 0.25,
              px: 1.5,
              background: 'rgba(127, 85, 240, 0.1)',
              color: '#b794f4',
              border: '1px solid rgba(127, 85, 240, 0.2)',
              borderRadius: '4px',
              flexShrink: 0
            }}
          >
            {copied ? 'Copied!' : 'Copy evidence'}
          </Button>
        </Box>
      )}

      <Button
        size="small"
        onClick={() => setShowRawOutput(v => !v)}
        endIcon={
          <ExpandMoreIcon
            sx={{
              fontSize: '0.9rem !important',
              transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              transform: showRawOutput ? 'rotate(180deg)' : 'rotate(0deg)'
            }}
          />
        }
        sx={{
          mt: 1.25,
          fontSize: '0.65rem',
          color: '#71717a',
          textTransform: 'none',
          px: 0,
          minWidth: 0,
          transition: 'color 0.2s ease',
          '&:hover': { background: 'transparent', color: '#a1a1aa' }
        }}
      >
        {showRawOutput ? 'Hide technical output' : 'View technical output'}
      </Button>

      {showRawOutput && (
        <Typography
          component="div"
          sx={{
            mt: 1,
            pt: 1,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            color: '#cbd5e1',
            lineHeight: 1.5,
            maxHeight: 220,
            overflowY: 'auto',
            whiteSpace: 'pre-wrap'
          }}
        >
          {data.logs.map((log: string, lIdx: number) => (
            <Box key={lIdx} sx={{ mb: 0.5 }}>
              {log}
            </Box>
          ))}
          {isRunning && (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
              <span className="terminal-cursor" style={{ width: 6, height: 12 }} />
            </Box>
          )}
        </Typography>
      )}
    </Box>
  );
};

// Sub-component for Git tree status and commit histories
const GitHistoryFeedCard: React.FC<{ data: any }> = ({ data }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 2, background: 'rgba(0,0,0,0.15)', borderColor: 'rgba(255,255,255,0.04)', borderRadius: '12px' }}>
        <Typography variant="caption" sx={{ color: '#b794f4', fontWeight: 700, display: 'block', mb: 1, letterSpacing: '0.05em' }}>
          WORKING TREE STATUS
        </Typography>
        <Typography component="pre" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#94a3b8', m: 0, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
          {data.status || 'Clean working tree.'}
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, background: 'rgba(0,0,0,0.15)', borderColor: 'rgba(255,255,255,0.04)', borderRadius: '12px' }}>
        <Typography variant="caption" sx={{ color: '#b794f4', fontWeight: 700, display: 'block', mb: 1, letterSpacing: '0.05em' }}>
          RECENT WORKSPACE COMMITS
        </Typography>
        <Typography component="pre" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#cbd5e1', m: 0, overflowX: 'auto', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
          {data.log || 'No commit logs available.'}
        </Typography>
      </Paper>
    </Box>
  );
};

// Sub-component for active Desktop applications statuses
const DesktopAppsFeedCard: React.FC<{ token: string }> = ({ token }) => {
  const [apps, setApps] = useState<{ name: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/desktop/apps', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setApps(data.apps || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return <LinearProgress sx={{ my: 2 }} />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="caption" sx={{ color: '#8e8e93', fontFamily: 'monospace', mb: 0.5 }}>
        Running developer desktop applications checklist
      </Typography>
      {apps.map((app, idx) => (
        <Paper
          key={idx}
          variant="outlined"
          sx={{
            p: 1.5,
            background: 'rgba(255,255,255,0.01)',
            borderColor: 'rgba(255,255,255,0.04)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            animation: 'cardFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#cbd5e1' }}>
            {app.name}
          </Typography>
          <Chip
            label={app.status.toUpperCase()}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.55rem',
              fontWeight: 700,
              background: app.status === 'Running' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.03)',
              color: app.status === 'Running' ? '#22c55e' : '#71717a',
              border: app.status === 'Running' ? '1px solid rgba(34, 197, 94, 0.15)' : '1px solid rgba(255,255,255,0.06)'
            }}
          />
        </Paper>
      ))}
    </Box>
  );
};

export const PreviewPanel: React.FC<PreviewProps> = ({ previewFeed, onClose, onAction, onRemoveItem, onClearFeed, onApproveAction, onContentWorkflowReview, token, onOpenInWorkbench, loading }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [pinnedCards, setPinnedCards] = useState<Record<string, boolean>>({});
  const feedEndRef = useRef<HTMLDivElement>(null);

  const toggleCard = (id: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleCopy = (text: string, itemId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(itemId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [previewFeed]);

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(9, 9, 11, 0.35)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          py: 1.5,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(9, 9, 11, 0.2)'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ViewStreamIcon sx={{ color: '#7f5af0', fontSize: 16 }} />
          <Typography variant="caption" sx={{ fontWeight: 800, color: '#f4f4f5', letterSpacing: '0.04em' }}>
            INTELLIGENCE FEED
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {previewFeed.length > 0 && (
            <Tooltip title="Clear Feed">
              <IconButton size="small" onClick={onClearFeed} sx={{ color: '#a0aec0' }}>
                <ClearAllIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <IconButton size="small" onClick={onClose} sx={{ color: '#a0aec0' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {loading && (
        <LinearProgress
          sx={{
            height: 2,
            background: 'transparent',
            '& .MuiLinearProgress-bar': { background: '#7f5af0' }
          }}
        />
      )}

      {/* Preview Feed Body */}
      <Box className="scroll-container" sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', p: 2, pb: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {previewFeed.length === 0 ? (
          <Box
            sx={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              p: 3,
              textAlign: 'center',
              minHeight: '100%',
              position: 'relative'
            }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(127, 85, 240, 0.04)',
                border: '1px solid rgba(127, 85, 240, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1.5,
              }}
            >
              {loading ? (
                <CircularProgress size={20} sx={{ color: '#7f5af0' }} />
              ) : (
                <TerminalIcon sx={{ fontSize: 24, color: '#7f5af0' }} />
              )}
            </Box>
            <Typography variant="caption" sx={{ color: '#f4f4f5', fontWeight: 700, display: 'block', mb: 0.5 }}>
              {loading ? 'WAITING FOR INSPECTION TRACE' : 'INTELLIGENCE FEED'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 220, fontSize: '0.75rem', lineHeight: 1.4, display: 'block' }}>
              {loading
                ? "Waiting for backend response logs..."
                : 'Interactive files, inspection statistics, and search components will stream here as you explore.'}
            </Typography>
          </Box>
        ) : (
          previewFeed.map((item) => {
              const isExpanded = expandedCards[item.id] !== undefined
                ? expandedCards[item.id]
                : (previewFeed[previewFeed.length - 1]?.id === item.id);

              const MAIN_WORKBENCH_COMPONENTS = new Set([
                "SoothsayerWorkbench",
                "BrowserObservation",
                "LiveAppWorkbench",
                "ContentOpsStarter",
                "ProposedAction",
                "RepoSetupProposal"
              ]);
              const canOpenInWorkbench = MAIN_WORKBENCH_COMPONENTS.has(item.type);

              return (
                <Paper
                  key={item.id}
                  elevation={0}
                  className="feed-card-animation"
                  sx={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: pinnedCards[item.id]
                      ? '1.5px solid #7f5af0'
                      : '1px solid rgba(255, 255, 255, 0.06)',
                    boxShadow: pinnedCards[item.id] ? '0 0 12px rgba(127, 85, 240, 0.2)' : 'none',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    p: 0
                  }}
                >
                  {/* Card Header (Clickable to collapse/expand) */}
                  <Box
                    onClick={() => toggleCard(item.id)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      px: 2,
                      py: 1,
                      background: 'rgba(255, 255, 255, 0.005)',
                      borderBottom: isExpanded ? '1px solid rgba(255, 255, 255, 0.04)' : 'none',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'background 0.2s',
                      '&:hover': { background: 'rgba(255, 255, 255, 0.02)' }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {isExpanded ? <ExpandLessIcon sx={{ fontSize: 13, color: '#7f5af0' }} /> : <ExpandMoreIcon sx={{ fontSize: 13, color: '#a0aec0' }} />}
                      <Typography variant="caption" sx={{ color: '#b794f4', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                        {item.type === 'WorkspaceList' && 'WORKSPACES'}
                        {item.type === 'FileList' && `FILE INDEX: ${item.data.workspace}`}
                        {item.type === 'CodePreview' && `CODE: ${item.data.workspace}/${item.data.path}`}
                        {item.type === 'SearchResults' && `SEARCH: "${item.data.keyword}"`}
                        {item.type === 'WorkflowsList' && `PIPELINES: ${item.data.workspace}`}
                        {item.type === 'LiveAppWorkbench' && 'LIVE APP WORKBENCH (EXPERIMENTAL)'}
                        {item.type === 'RepoSetupProposal' && 'REPO SETUP PROPOSAL'}
                        {item.type === 'ProposedAction' && 'AWAITING APPROVAL'}
                        {item.type === 'ExecutionLogs' && `TASK CONSOLE`}
                        {item.type === 'GitHistory' && `GIT STATUS: ${item.data.workspace}`}
                        {item.type === 'DesktopApps' && `SYSTEM APP AUDIT LOG`}
                        {item.type === 'TerminalLogs' && 'TERMINAL SCAN'}
                        {item.type === 'MemoryRecall' && 'MEMORY RECALL'}
                        {item.type === 'ContentWorkflow' && 'GOVERNED CONTENT RUN'}
                        {item.type === 'SoothsayerWorkbench' && 'SOOTHSAYER WORKBENCH'}
                        {item.type === 'BrowserObservation' && 'BROWSER OBSERVATION'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} onClick={(e) => e.stopPropagation()}>
                      {canOpenInWorkbench && (
                        <Tooltip title="Open in Workbench">
                          <IconButton
                            size="small"
                            onClick={() => onOpenInWorkbench?.(item)}
                            sx={{ color: '#cbd5e1', p: 0.25 }}
                          >
                            <LaunchIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title={pinnedCards[item.id] ? "Unpin Card" : "Pin Card"}>
                        <IconButton
                          size="small"
                          onClick={() => setPinnedCards(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                          sx={{ color: pinnedCards[item.id] ? '#7f5af0' : '#a0aec0', p: 0.25 }}
                        >
                          <PushPinIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Tooltip>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', fontFamily: 'monospace' }}>
                        {item.timestamp}
                      </Typography>
                      {item.type === 'CodePreview' && (
                        <Tooltip title={copiedId === item.id ? "Copied!" : "Copy code"}>
                          <IconButton size="small" onClick={() => handleCopy(item.data.content, item.id)} sx={{ color: '#a0aec0', p: 0.25 }}>
                            <ContentCopyIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      <IconButton size="small" onClick={() => onRemoveItem(item.id)} sx={{ color: '#a0aec0', p: 0.25 }}>
                        <CloseIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Box>
                  </Box>

                {/* Card Content */}
                <Collapse in={isExpanded}>
                  <Box sx={{ p: 2 }}>
                    {item.type === 'WorkspaceList' && (
                      <Box>
                        {/* Live ecosystem status board */}
                        <EcosystemStatusBoard token={token} onAction={onAction} />
                        
                        <Grid container spacing={1.5}>
                          {item.data.map((ws: any, idx: number) => (
                            <Grid item xs={12} key={idx}>
                              <Card sx={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px' }}>
                                <CardActionArea onClick={() => onAction(`List files in ${ws.name}`)}>
                                  <CardContent sx={{ p: 1.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                      <FolderIcon color="primary" sx={{ mr: 1, fontSize: 18 }} />
                                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#f4f4f5' }}>
                                        {ws.name}
                                      </Typography>
                                    </Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                      {ws.path}
                                    </Typography>
                                  </CardContent>
                                </CardActionArea>
                              </Card>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    )}

                    {item.type === 'FileList' && (
                      <FileListFeedCard data={item.data} onAction={onAction} />
                    )}

                    {item.type === 'CodePreview' && (
                      <CodePreviewFeedCard data={item.data} />
                    )}

                    {item.type === 'SearchResults' && (
                      <LaptopBrowserFrame url={`https://portal.local/search?q=${encodeURIComponent(item.data.keyword)}`}>
                        <SearchResultsFeedCard data={item.data} onAction={onAction} />
                      </LaptopBrowserFrame>
                    )}

                    {item.type === 'WorkflowsList' && (
                      <WorkflowsFeedCard data={item.data} />
                    )}

                    {item.type === 'LiveAppWorkbench' && (
                      <LiveAppWorkbenchCard
                        variant="chat"
                        data={item.data}
                        onCancel={() => onRemoveItem(item.id)}
                      />
                    )}

                    {item.type === 'RepoSetupProposal' && (
                      <RepoSetupProposalCard
                        variant="chat"
                        data={item.data}
                        onCancel={() => onRemoveItem(item.id)}
                      />
                    )}

                    {item.type === 'ProposedAction' && (
                      <ProposedActionCard
                        workspaceName={item.data.workspaceName}
                        command={item.data.command}
                        reason={item.data.reason}
                        riskLevel={item.data.riskLevel}
                        executionMode={item.data.executionMode}
                        isDryRun={item.data.isDryRun}
                        allowed={item.data.allowed}
                        description={item.data.description}
                        onApprove={() => onApproveAction?.(item.id, item.data.workspaceName, item.data.command)}
                        onCancel={() => onRemoveItem(item.id)}
                      />
                    )}

                    {item.type === 'ExecutionLogs' && (
                      <ExecutionLogsFeedCard data={item.data} procId={item.id} token={token} />
                    )}

                    {item.type === 'ContentWorkflow' && (
                      <ContentWorkflowCard
                        run={item.data.run}
                        evidence={item.data.evidence}
                        busy={!!item.data.busy}
                        onReview={(action, notes) => onContentWorkflowReview?.(item.id, item.data.run.runId, action, notes)}
                      />
                    )}

                    {item.type === 'GitHistory' && (
                      <GitHistoryFeedCard data={item.data} />
                    )}

                    {item.type === 'DesktopApps' && (
                      <DesktopAppsFeedCard token={token} />
                    )}

                    {item.type === 'TerminalLogs' && (
                      <Box
                        sx={{
                          background: '#040405',
                          p: 1.5,
                          borderRadius: '12px',
                          border: '1px solid rgba(127, 85, 240, 0.12)',
                          maxHeight: 280,
                          overflowY: 'auto',
                          overflowX: 'hidden',
                          WebkitOverflowScrolling: 'touch'
                        }}
                      >
                        <Typography component="div" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#38bdf8', lineHeight: 1.5 }}>
                          {(item.data.logs as string[]).map((log: string, lIdx: number) => (
                            <Box key={lIdx} sx={{ mb: 0.5, display: 'flex', alignItems: 'flex-start' }}>
                              <Box sx={{ color: '#22c55e', mr: 1, userSelect: 'none' }}>❯</Box>
                              <Box sx={{ flexGrow: 1, whiteSpace: 'pre-wrap' }}>{log}</Box>
                            </Box>
                          ))}
                        </Typography>
                      </Box>
                    )}

                    {item.type === 'MemoryRecall' && (
                      <Box
                        sx={{
                          background: 'linear-gradient(135deg, rgba(109,40,217,0.08) 0%, rgba(15,10,30,0.95) 100%)',
                          p: 1.5,
                          borderRadius: '12px',
                          border: '1px solid rgba(109,40,217,0.25)',
                          maxHeight: 260,
                          overflowY: 'auto',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Box sx={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                            boxShadow: '0 0 8px rgba(124,58,237,0.6)',
                            flexShrink: 0
                          }} />
                          <Typography sx={{ fontSize: '0.7rem', color: '#a78bfa', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                            SESSION MEMORY — workspace context recalled
                          </Typography>
                        </Box>
                        {(item.data.memories as string[]).map((mem: string, mIdx: number) => (
                          <Box key={mIdx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
                            <Box sx={{ color: '#7c3aed', fontSize: '0.7rem', mt: '2px', flexShrink: 0 }}>—</Box>
                            <Typography sx={{ fontSize: '0.78rem', color: '#c4b5fd', lineHeight: 1.5, fontFamily: 'monospace' }}>
                              {mem}
                            </Typography>
                          </Box>
                        ))}
                        {(item.data.memories as string[]).length === 0 && (
                          <Typography sx={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'monospace', fontStyle: 'italic' }}>
                            No prior context found. Memory will populate as you explore workspaces.
                          </Typography>
                        )}
                      </Box>
                    )}

                    {item.type === 'SoothsayerWorkbench' && (
                      <InteractiveComponent
                        uiComponent={{ type: 'SoothsayerWorkbench', data: item.data }}
                        onAction={onAction}
                        onApproveAction={onApproveAction}
                        onCancelAction={onRemoveItem}
                        variant="feed"
                      />
                    )}

                    {item.type === 'BrowserObservation' && (
                      <InteractiveComponent
                        uiComponent={{ type: 'BrowserObservation', data: item.data }}
                        onAction={onAction}
                        onApproveAction={onApproveAction}
                        onCancelAction={onRemoveItem}
                        variant="feed"
                      />
                    )}
                  </Box>
                </Collapse>
              </Paper>
            );
          })
        )}
        <div ref={feedEndRef} />
      </Box>
    </Paper>
  );
};
