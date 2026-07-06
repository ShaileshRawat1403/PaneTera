// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Box, CssBaseline, ThemeProvider, createTheme, Paper, Typography, TextField, Button, CircularProgress, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Grid, Stack, Divider } from '@mui/material';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { PreviewPanel, FeedItem } from './components/PreviewPanel';
import { InteractiveComponent } from './components/InteractiveComponent';
import type { UiComponent } from '../shared/uiComponent';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close';
import EditNoteIcon from '@mui/icons-material/EditNote';
import DnsIcon from '@mui/icons-material/Dns';
import TerminalIcon from '@mui/icons-material/Terminal';
import FolderIcon from '@mui/icons-material/Folder';
import MemoryIcon from '@mui/icons-material/Memory';
import LaptopMacIcon from '@mui/icons-material/LaptopMac';
import SearchIcon from '@mui/icons-material/Search';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';

// Codex developer-cockpit styling presets
const codexTheme = createTheme({
  typography: {
    fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  palette: {
    mode: 'dark',
    background: {
      default: '#08090b',
      paper: 'rgba(255, 255, 255, 0.035)',
    },
    primary: { main: '#7f5af0' },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          background: 'rgba(255, 255, 255, 0.035)',
          backdropFilter: 'blur(16px)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          padding: '6px 16px',
        },
      },
    },
  },
});

interface Message {
  role: 'user' | 'assistant';
  content: string;
  uiComponent?: UiComponent;
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [token, setToken] = useState<string>('');
  const [showTokenPrompt, setShowTokenPrompt] = useState<boolean>(false);
  const [tokenInput, setTokenInput] = useState<string>('');
  const [previewFeed, setPreviewFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isCmdKOpen, setIsCmdKOpen] = useState<boolean>(false);
  const [cmdKQuery, setCmdKQuery] = useState<string>('');
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  // Active workspace state overlays
  const [activeComponent, setActiveComponent] = useState<UiComponent | null>(null);
  const [activeReply, setActiveReply] = useState<string | null>(null);
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [activeLens, setActiveLens] = useState<'engineer' | 'pm' | 'ba' | 'qa' | 'exec'>('engineer');
  const [workspacesList, setWorkspacesList] = useState<any[]>([]);
  const [soothsayerStatus, setSoothsayerStatus] = useState<'online' | 'offline' | 'checking' | 'unconfigured' | 'degraded'>('checking');
  const [backendHealth, setBackendHealth] = useState<{ status: string; mode: string; workspaceCount: number; memoryBridgeReady: boolean } | null>(null);

  // Governed content workflow (flowright) input state
  const [isContentDialogOpen, setIsContentDialogOpen] = useState<boolean>(false);
  const [contentForm, setContentForm] = useState({
    siteGoal: '',
    targetPages: '',
    contentBrief: '',
    sourceMaterial: '',
    seoRequirements: '',
    publishConstraints: 'No autonomous publishing. Operator must approve before CMS or deploy handoff.'
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load token from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('portalToken') || '';
    if (stored) {
      setToken(stored);
    } else {
      setShowTokenPrompt(true);
    }
  }, []);

  // Fetch workspaces & health once authenticated
  useEffect(() => {
    if (!token) return;
    fetch('/api/workspaces', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setWorkspacesList(data);
      })
      .catch(() => {});

    fetch('/api/health', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data && data.status) setBackendHealth(data);
      })
      .catch(() => {});
  }, [token]);

  // Client-side direct connection ping to live deployed app
  useEffect(() => {
    setSoothsayerStatus('checking');
    fetch('https://ops-soothsayer-web-production.up.railway.app/api/portal-manifest')
      .then(r => {
        if (r.ok) setSoothsayerStatus('online');
        else setSoothsayerStatus('degraded');
      })
      .catch(() => setSoothsayerStatus('offline'));
  }, []);

  // Real-time EventSource listener for file updates and execution logs
  useEffect(() => {
    if (!token) return;

    const eventSource = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);

    eventSource.onmessage = (e) => {
      try {
        const eventData = JSON.parse(e.data);
        if (eventData.type === 'file_change') {
          const logMsg = `[WATCHER] File ${eventData.event}: ${eventData.workspace}/${eventData.path}`;
          setPreviewFeed(prev => [
            ...prev,
            {
              id: Math.random().toString(36).substr(2, 9),
              type: 'TerminalLogs',
              data: { logs: [logMsg, "Dynamic workspace hot reload active."] },
              timestamp: eventData.timestamp
            }
          ]);
        } else if (eventData.type === 'proc_log') {
          setPreviewFeed(prev => prev.map(item => {
            if (item.id === eventData.procId) {
              return {
                ...item,
                data: {
                  ...item.data,
                  logs: [...(item.data.logs || []), eventData.text]
                }
              };
            }
            return item;
          }));
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [token]);

  // On session start: recall workspace memory if memory bridge is available
  useEffect(() => {
    if (!token) return;
    const now = new Date().toLocaleTimeString();
    fetch('/api/memory/recall?category=workspace', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then((data: { memories: string[]; bridgeReady: boolean }) => {
        if (data.bridgeReady && data.memories && data.memories.length > 0) {
          setPreviewFeed(prev => [
            {
              id: 'memory-recall-session',
              type: 'MemoryRecall',
              data: { memories: data.memories, bridgeReady: true },
              timestamp: now
            },
            ...prev
          ]);
        }
      })
      .catch(() => {});
  }, [token]);

  // Cmd+K palette listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCmdKOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-scroll to bottom of chat when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const addMessage = (msg: Message) => {
    setMessages(prev => [...prev, msg]);
  };

  const handleSend = async (text: string) => {
    addMessage({ role: 'user', content: text });
    setLoading(true);

    const loadingId = Math.random().toString(36).substr(2, 9);
    const currentTimestamp = new Date().toLocaleTimeString();

    const historyPayload = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    const apiPromise = fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: text, history: historyPayload }),
    }).then(async (resp) => {
      if (resp.status === 401) {
        throw new Error('Unauthorized');
      }
      return resp.json();
    });

    try {
      const data = await apiPromise;

      const uiComponentWithId = data.uiComponent
        ? {
            ...data.uiComponent,
            data: data.uiComponent.type === 'ProposedAction'
              ? { ...data.uiComponent.data, procId: loadingId }
              : data.uiComponent.data
          }
        : undefined;

      addMessage({
        role: 'assistant',
        content: data.reply ?? 'No response',
        uiComponent: uiComponentWithId
      });

      // Update active workbench card slot
      if (uiComponentWithId) {
        setActiveComponent(uiComponentWithId);
      }
      setActiveReply(data.reply ?? null);
      setActiveQuery(text);

      if (uiComponentWithId) {
        setPreviewFeed(prev => [
          ...prev,
          {
            id: loadingId,
            type: uiComponentWithId.type,
            data: uiComponentWithId.data,
            timestamp: currentTimestamp
          }
        ]);
      }
    } catch (err: any) {
      if (err.message === 'Unauthorized') {
        addMessage({ role: 'assistant', content: 'Unauthorized. Please check your token settings.' });
        setShowTokenPrompt(true);
      } else {
        addMessage({ role: 'assistant', content: 'Error contacting backend. Please verify that the server is running.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTokenSave = () => {
    const trimmed = tokenInput.trim();
    if (trimmed) {
      localStorage.setItem('portalToken', trimmed);
      setToken(trimmed);
      setShowTokenPrompt(false);
      // Trigger a status refresh on token update
      window.location.reload();
    }
  };

  const handleRemoveItem = (id: string) => {
    setPreviewFeed(prev => prev.filter(item => item.id !== id));
  };

  const handleApproveAction = async (procId: string, workspaceName: string, command: string) => {
    // Also update right feed item
    setPreviewFeed(prev => prev.map(item => item.id === procId ? {
      ...item,
      type: 'ExecutionLogs',
      data: { command, workspaceName, logs: [`[SYSTEM] Approved by operator. Starting: ${command} in ${workspaceName}...`] }
    } : item));

    try {
      const resp = await fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ workspaceName, command, procId })
      });
      const resData = await resp.json();
      if (!resp.ok) {
        setPreviewFeed(prev => prev.map(item => item.id === procId ? {
          ...item,
          data: { ...item.data, logs: [...item.data.logs, `[ERROR] ${resData.error || 'Failed to start'}`] }
        } : item));
      }
    } catch (err: any) {
      setPreviewFeed(prev => prev.map(item => item.id === procId ? {
        ...item,
        data: { ...item.data, logs: [...item.data.logs, `[ERROR] ${err.message}`] }
      } : item));
    }
  };

  const handleClearFeed = () => {
    setPreviewFeed([]);
  };

  const fetchDraftContent = async (runId: string): Promise<string | undefined> => {
    try {
      const resp = await fetch(`/api/flowright/runs/${runId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json();
      if (!resp.ok || !Array.isArray(data.artifacts)) return undefined;
      const drafts = data.artifacts.filter((a: any) => a.type === 'draft_post');
      if (drafts.length === 0) return undefined;
      const latest = drafts.reduce((a: any, b: any) => (b.version ?? 0) >= (a.version ?? 0) ? b : a);
      return typeof latest.content === 'string' ? latest.content : undefined;
    } catch {
      return undefined;
    }
  };

  const handleStartContentWorkflow = async (form: typeof contentForm) => {
    const itemId = Math.random().toString(36).substr(2, 9);
    const timestamp = new Date().toLocaleTimeString();

    setPreviewFeed(prev => [
      ...prev,
      {
        id: itemId,
        type: 'ContentWorkflow',
        data: {
          run: {
            runId: '',
            workflowId: 'websiteops.website_content_publish.v0',
            status: 'draft',
            siteGoal: form.siteGoal,
            targetPages: form.targetPages
          },
          busy: true
        },
        timestamp
      }
    ]);

    try {
      const createResp = await fetch('/api/flowright/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          workflowId: 'websiteops.website_content_publish.v0',
          templatePath: 'templates/websiteops/website-content-publish.workflow.yaml',
          inputs: {
            site_goal: form.siteGoal,
            target_pages: form.targetPages,
            content_brief: form.contentBrief,
            source_material: form.sourceMaterial,
            seo_requirements: form.seoRequirements,
            publish_constraints: form.publishConstraints
          }
        })
      });
      const created = await createResp.json();
      if (!createResp.ok) throw new Error(created.error || 'Failed to create run');

      const driveResp = await fetch(`/api/flowright/runs/${created.runId}/drive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ maxSteps: 10 })
      });
      const driven = await driveResp.json();
      if (!driveResp.ok) throw new Error(driven.error || 'Failed to drive run');

      const draftContent = await fetchDraftContent(driven.run.runId);

      setPreviewFeed(prev => prev.map(item => item.id === itemId ? {
        ...item,
        data: {
          run: {
            runId: driven.run.runId,
            workflowId: driven.run.workflowId,
            status: driven.run.status,
            currentStepId: driven.run.currentStepId,
            siteGoal: form.siteGoal,
            targetPages: form.targetPages,
            draftContent
          },
          busy: false
        }
      } : item));
    } catch (err: any) {
      setPreviewFeed(prev => prev.map(item => item.id === itemId ? {
        ...item,
        data: {
          ...item.data,
          run: { ...item.data.run, status: 'failed' },
          busy: false,
          error: err.message
        }
      } : item));
    }
  };

  const handleContentWorkflowReview = async (
    itemId: string,
    runId: string,
    action: 'approve' | 'reject' | 'request_revision',
    notes: string
  ) => {
    setPreviewFeed(prev => prev.map(item => item.id === itemId ? { ...item, data: { ...item.data, busy: true } } : item));

    try {
      const reviewResp = await fetch(`/api/flowright/runs/${runId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, reviewer: 'portal-operator', notes })
      });
      const reviewed = await reviewResp.json();
      if (!reviewResp.ok) throw new Error(reviewed.error || 'Review submission failed');

      let finalRun = reviewed;
      if (action === 'approve') {
        const driveResp = await fetch(`/api/flowright/runs/${runId}/drive`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ maxSteps: 10 })
        });
        const driven = await driveResp.json();
        if (!driveResp.ok) throw new Error(driven.error || 'Failed to drive run after approval');
        finalRun = driven.run;
      }

      const draftContent = await fetchDraftContent(runId);

      setPreviewFeed(prev => prev.map(item => item.id === itemId ? {
        ...item,
        data: {
          ...item.data,
          run: {
            ...item.data.run,
            status: finalRun.status,
            currentStepId: finalRun.currentStepId,
            draftContent: draftContent ?? item.data.run.draftContent
          },
          busy: false
        }
      } : item));

      if (finalRun.status === 'completed') {
        const evidenceResp = await fetch(`/api/flowright/runs/${runId}/evidence`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const evidence = await evidenceResp.json();
        if (evidenceResp.ok) {
          setPreviewFeed(prev => prev.map(item => item.id === itemId ? {
            ...item,
            data: { ...item.data, evidence }
          } : item));
        }
      }
    } catch (err: any) {
      setPreviewFeed(prev => prev.map(item => item.id === itemId ? {
        ...item,
        data: { ...item.data, busy: false, error: err.message }
      } : item));
    }
  };

  return (
    <ThemeProvider theme={codexTheme}>
      <CssBaseline />

      {/* Cmd+K spotlight search overlay */}
      {isCmdKOpen && (
        <Box
          onClick={() => setIsCmdKOpen(false)}
          sx={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(9, 9, 11, 0.82)',
            backdropFilter: 'blur(12px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            pt: '15vh'
          }}
        >
          <Paper
            onClick={(e) => e.stopPropagation()}
            elevation={24}
            sx={{
              width: '100%',
              maxWidth: '600px',
              mx: 2,
              background: 'rgba(20, 20, 25, 0.8)',
              border: '1px solid rgba(127, 85, 240, 0.3)',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65), 0 0 40px rgba(127, 85, 240, 0.12)',
              animation: 'appleSpringIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}
          >
            <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <TextField
                fullWidth
                autoFocus
                variant="standard"
                placeholder="Type a command or query..."
                value={cmdKQuery}
                onChange={(e) => setCmdKQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && cmdKQuery.trim()) {
                    handleSend(cmdKQuery);
                    setIsCmdKOpen(false);
                    setCmdKQuery('');
                  } else if (e.key === 'Escape') {
                    setIsCmdKOpen(false);
                  }
                }}
                InputProps={{
                  disableUnderline: true,
                  sx: {
                    fontSize: '1.05rem',
                    color: '#f4f4f5',
                    fontFamily: '"Plus Jakarta Sans", sans-serif'
                  }
                }}
              />
            </Box>

            <Box sx={{ p: 1.5, maxHeight: '320px', overflowY: 'auto' }}>
              <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: '#71717a', fontWeight: 700, letterSpacing: '0.05em' }}>
                SUGGESTED COMMANDS
              </Typography>
              {[
                { title: 'Connected systems', cmd: 'List workspaces', desc: 'See everything the portal can currently observe' },
                { title: "What's changed in flowright", cmd: 'git status in flowright', desc: 'Recent activity and working state' },
                { title: 'Summarize flowright', cmd: 'Read README.md in flowright', desc: 'Plain-language overview of the project' },
                { title: 'Inspect Soothsayer', cmd: 'inspect soothsayer', desc: 'Inspect live app manifest and metrics' }
              ]
                .filter(item => item.title.toLowerCase().includes(cmdKQuery.toLowerCase()) || item.cmd.toLowerCase().includes(cmdKQuery.toLowerCase()))
                .map((item, idx) => (
                  <Box
                    key={idx}
                    onClick={() => {
                      handleSend(item.cmd);
                      setIsCmdKOpen(false);
                      setCmdKQuery('');
                    }}
                    sx={{
                      p: 1.5,
                      px: 2.5,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        background: 'rgba(127, 85, 240, 0.08)',
                        '& .cmd-title': { color: '#b794f4' }
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography className="cmd-title" variant="body2" sx={{ fontWeight: 600, color: '#f4f4f5', transition: 'color 0.2s' }}>
                        {item.title}
                      </Typography>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#7f5af0', fontSize: '0.7rem', background: 'rgba(127, 85, 240, 0.1)', px: 1, py: 0.25, borderRadius: '4px' }}>
                        Enter
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                      {item.desc}
                    </Typography>
                  </Box>
                ))}
            </Box>
            
            <Box sx={{ px: 3, py: 1.5, background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255, 255, 255, 0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Select command or press ESC to dismiss
              </Typography>
              <Chip label="ESC" size="small" sx={{ height: 16, fontSize: '0.6rem', color: '#71717a', background: 'rgba(255,255,255,0.05)' }} />
            </Box>
          </Paper>
        </Box>
      )}

      {/* Governed run Dialog */}
      <Dialog
        open={isContentDialogOpen}
        onClose={() => setIsContentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: 'rgba(20, 20, 25, 0.92)',
            border: '1px solid rgba(127, 85, 240, 0.22)',
            backdropFilter: 'blur(16px)'
          }
        }}
      >
        <DialogTitle sx={{ color: '#f4f4f5', fontWeight: 800 }}>
          Draft a real content update
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="caption" sx={{ color: '#94a3b8', lineHeight: 1.6 }}>
            This starts a real, governed flowright run against pruningmypothos.com.
            It drafts and validates a packet and stops at human review — nothing
            publishes automatically.
          </Typography>
          <TextField label="Site goal" required value={contentForm.siteGoal}
            onChange={(e) => setContentForm(f => ({ ...f, siteGoal: e.target.value }))}
            size="small" multiline minRows={2} />
          <TextField label="Target pages" required value={contentForm.targetPages}
            onChange={(e) => setContentForm(f => ({ ...f, targetPages: e.target.value }))}
            size="small" placeholder="e.g. Homepage, blog index" />
          <TextField label="Content brief" required value={contentForm.contentBrief}
            onChange={(e) => setContentForm(f => ({ ...f, contentBrief: e.target.value }))}
            size="small" multiline minRows={2} />
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button onClick={() => setIsContentDialogOpen(false)} sx={{ color: '#a1a1aa' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!contentForm.siteGoal || !contentForm.targetPages || !contentForm.contentBrief}
            onClick={() => {
              setIsContentDialogOpen(false);
              handleStartContentWorkflow(contentForm);
            }}
            sx={{ background: '#7f5af0', fontWeight: 700, '&:hover': { background: '#6d47dd' } }}
          >
            Start governed run
          </Button>
        </DialogActions>
      </Dialog>

      {/* "What can I ask?" Guide popup */}
      {isHelpOpen && (
        <Box
          onClick={() => setIsHelpOpen(false)}
          sx={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(9, 9, 11, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2
          }}
        >
          <Paper
            onClick={(e) => e.stopPropagation()}
            elevation={0}
            sx={{
              width: '100%',
              maxWidth: 460,
              p: 3.5,
              background: 'rgba(20, 20, 25, 0.9)',
              border: '1px solid rgba(127, 85, 240, 0.22)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(127, 85, 240, 0.1)',
              animation: 'appleSpringIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#f4f4f5' }}>
                What can I ask?
              </Typography>
              <IconButton size="small" onClick={() => setIsHelpOpen(false)} sx={{ color: '#a1a1aa' }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <Typography variant="body2" sx={{ color: '#a1a1aa', mb: 2.5, lineHeight: 1.6 }}>
              Everything here is read-only until you approve something. A few places to start:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {[
                { label: "See what's connected", cmd: 'List workspaces' },
                { label: 'Check recent activity', cmd: 'git status in flowright' },
                { label: 'Open a plain-language summary', cmd: 'Read README.md in flowright' },
                { label: 'Propose a check — nothing runs until you approve', cmd: 'run npm run verify in flowright' }
              ].map((item, idx) => (
                <Box
                  key={idx}
                  onClick={() => { setIsHelpOpen(false); handleSend(item.cmd); }}
                  sx={{
                    p: 1.5,
                    px: 2,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': { background: 'rgba(127, 85, 240, 0.08)' }
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#f4f4f5' }}>
                    {item.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#71717a', fontFamily: 'monospace' }}>
                    {item.cmd}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>
      )}

      {/* Main 3-Zone Flex Layout */}
      <Box sx={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative' }}>
        
        {/* Token auth prompt centered over skeleton background if showTokenPrompt is true */}
        {showTokenPrompt && (
          <Box
            sx={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999,
              backgroundColor: 'rgba(8,9,11,0.65)',
              backdropFilter: 'blur(3px)',
            }}
          >
            <Paper
              elevation={24}
              sx={{
                width: '90%',
                maxWidth: '400px',
                p: 3.5,
                background: 'rgba(20, 20, 25, 0.95)',
                border: '1px solid rgba(127, 85, 240, 0.22)',
                borderRadius: '12px',
                boxShadow: '0 24px 50px rgba(0,0,0,0.6)',
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#f4f4f5', mb: 1 }}>
                Access Authentication
              </Typography>
              <Typography variant="body2" sx={{ color: '#a1a1aa', mb: 2.5, lineHeight: 1.5 }}>
                Enter local portal token to unlock the workbench.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  placeholder="Secure token"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.03)',
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }
                    }
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleTokenSave}
                  sx={{
                    borderRadius: '8px',
                    background: '#7f5af0',
                    fontWeight: 700,
                    '&:hover': { background: '#6d47dd' }
                  }}
                >
                  Unlock
                </Button>
              </Box>
            </Paper>
          </Box>
        )}

        {/* Global layout container applying blur filter in pre-auth mode */}
        <Box
          sx={{
            display: 'flex',
            flexGrow: 1,
            height: '100%',
            width: '100%',
            minWidth: 0,
            filter: showTokenPrompt ? 'blur(2px)' : 'none',
            opacity: showTokenPrompt ? 0.45 : 1,
            pointerEvents: showTokenPrompt ? 'none' : 'auto',
            transition: 'filter 0.3s, opacity 0.3s',
          }}
        >
          {/* ZONE 1: Left Context Rail */}
          <Box
            sx={{
              width: 280,
              minWidth: 280,
              borderRight: '1px solid rgba(255,255,255,0.08)',
              display: { xs: 'none', md: 'flex' },
              flexDirection: 'column',
              background: 'rgba(9, 9, 11, 0.4)',
              p: 2.5,
              overflowY: 'auto'
            }}
          >
            {/* Session status info */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
                SESSION STATUS
              </Typography>
              <Paper variant="outlined" sx={{ p: 1.5, background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" sx={{ color: '#a1a1aa', fontWeight: 600 }}>Access Type</Typography>
                  <Chip label="GOVERNED" size="small" sx={{ height: 16, fontSize: '0.55rem', fontWeight: 800, background: 'rgba(34, 197, 94, 0.08)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.15)' }} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption" sx={{ color: '#a1a1aa', fontWeight: 600 }}>Express Gateway</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: token ? '#22c55e' : '#ef4444' }} />
                    <Typography variant="caption" sx={{ color: '#f4f4f5', fontWeight: 700, fontSize: '0.65rem' }}>
                      {token ? 'Connected' : 'Offline'}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Box>

            {/* Connected systems section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
                CONNECTED SYSTEMS
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {/* Redis */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0.75, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DnsIcon sx={{ fontSize: 13, color: '#71717a' }} />
                    <Typography variant="caption" sx={{ color: '#e2e8f0', fontWeight: 600 }}>Redis DB</Typography>
                  </Box>
                  <Chip label="Configured" size="small" sx={{ height: 16, fontSize: '0.55rem', background: 'rgba(255,255,255,0.03)', color: '#a1a1aa' }} />
                </Box>
                {/* Postgres */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0.75, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DnsIcon sx={{ fontSize: 13, color: '#71717a' }} />
                    <Typography variant="caption" sx={{ color: '#e2e8f0', fontWeight: 600 }}>Postgres DB</Typography>
                  </Box>
                  <Chip label="Configured" size="small" sx={{ height: 16, fontSize: '0.55rem', background: 'rgba(255,255,255,0.03)', color: '#a1a1aa' }} />
                </Box>
                {/* DAX */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0.75, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DnsIcon sx={{ fontSize: 13, color: '#71717a' }} />
                    <Typography variant="caption" sx={{ color: '#e2e8f0', fontWeight: 600 }}>DAX Control</Typography>
                  </Box>
                  <Chip label="No signal" size="small" sx={{ height: 16, fontSize: '0.55rem', background: 'rgba(255,255,255,0.03)', color: '#a1a1aa' }} />
                </Box>
                {/* Local Shell */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0.75, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TerminalIcon sx={{ fontSize: 13, color: '#7f5af0' }} />
                    <Typography variant="caption" sx={{ color: '#e2e8f0', fontWeight: 600 }}>Local Adapter</Typography>
                  </Box>
                  <Chip label="Dry Run" size="small" sx={{ height: 16, fontSize: '0.55rem', background: 'rgba(127, 85, 240, 0.1)', color: '#b794f4' }} />
                </Box>
                {/* Rook Memory Bridge */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0.75 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MemoryIcon sx={{ fontSize: 13, color: backendHealth?.memoryBridgeReady ? '#22c55e' : '#71717a' }} />
                    <Typography variant="caption" sx={{ color: '#e2e8f0', fontWeight: 600 }}>Rook Memory</Typography>
                  </Box>
                  <Chip 
                    label={backendHealth?.memoryBridgeReady ? 'Connected' : 'No signal'} 
                    size="small" 
                    sx={{ 
                      height: 16, 
                      fontSize: '0.55rem', 
                      background: backendHealth?.memoryBridgeReady ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)', 
                      color: backendHealth?.memoryBridgeReady ? '#22c55e' : '#a1a1aa' 
                    }} 
                  />
                </Box>
              </Box>
            </Box>

            {/* Workspaces list */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
                WORKSPACES / REPOS
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {workspacesList.map(ws => (
                  <Box
                    key={ws.name}
                    onClick={() => handleSend(`List files in ${ws.name}`)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 1,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      '&:hover': { background: 'rgba(255,255,255,0.03)' }
                    }}
                  >
                    <FolderIcon sx={{ fontSize: 14, color: '#7f5af0' }} />
                    <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 600 }}>
                      {ws.name}
                    </Typography>
                  </Box>
                ))}
                {workspacesList.length === 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', pl: 1 }}>
                    No workspaces configured.
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Live Apps status list */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
                LIVE DEPLOYED APPS
              </Typography>
              <Box
                onClick={() => handleSend('inspect soothsayer')}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 1,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  '&:hover': { background: 'rgba(255,255,255,0.03)' }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LaptopMacIcon sx={{ fontSize: 14, color: soothsayerStatus === 'online' ? '#22c55e' : '#71717a' }} />
                  <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 600 }}>
                    Soothsayer
                  </Typography>
                </Box>
                <Chip 
                  label={soothsayerStatus.toUpperCase()} 
                  size="small" 
                  sx={{ 
                    height: 16, 
                    fontSize: '0.55rem', 
                    fontWeight: 800, 
                    background: soothsayerStatus === 'online' ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)', 
                    color: soothsayerStatus === 'online' ? '#22c55e' : '#a1a1aa' 
                  }} 
                />
              </Box>
            </Box>

            {/* Persona lenses selectors */}
            <Box sx={{ mt: 'auto', pt: 2, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
                PERSONA VIEW LENS
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {(['engineer', 'pm', 'ba', 'qa', 'exec'] as const).map(lens => (
                  <Box
                    key={lens}
                    onClick={() => setActiveLens(lens)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 0.75,
                      px: 1.5,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: activeLens === lens ? 'rgba(127, 85, 240, 0.08)' : 'transparent',
                      border: activeLens === lens ? '1px solid rgba(127, 85, 240, 0.2)' : '1px solid transparent',
                      transition: 'all 0.2s',
                      '&:hover': { background: activeLens === lens ? 'rgba(127, 85, 240, 0.12)' : 'rgba(255,255,255,0.02)' }
                    }}
                  >
                    <PersonOutlineIcon sx={{ fontSize: 13, color: activeLens === lens ? '#b794f4' : '#71717a' }} />
                    <Typography variant="caption" sx={{ color: activeLens === lens ? '#b794f4' : '#cbd5e1', fontWeight: activeLens === lens ? 700 : 500 }}>
                      {lens.toUpperCase()}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>

          {/* ZONE 2 + ZONE 3: Main Dashboard Content Area */}
          <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            
            {/* Top Command Bar */}
            <Box
              sx={{
                height: 60,
                minHeight: 60,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                px: { xs: 2, md: 3 },
                background: 'rgba(9, 9, 11, 0.2)'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#f4f4f5', letterSpacing: '-0.01em' }}>
                  MyAI Portal
                </Typography>
                <Divider orientation="vertical" variant="middle" flexItem sx={{ borderColor: 'rgba(255, 255, 255, 0.12)', height: '12px', my: 'auto' }} />
                <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 600 }}>
                  Governed Workbench
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 }, flexShrink: 0 }}>
                {/* Search box trigger */}
                <Chip 
                  label="Cmd+K for commands" 
                  onClick={() => setIsCmdKOpen(true)}
                  icon={<SearchIcon style={{ fontSize: 12, color: '#b794f4' }} />}
                  size="small" 
                  sx={{ 
                    height: 24, 
                    fontSize: '0.65rem', 
                    background: 'rgba(127, 85, 240, 0.05)', 
                    color: '#b794f4',
                    border: '1px solid rgba(127, 85, 240, 0.15)',
                    cursor: 'pointer',
                    '&:hover': { background: 'rgba(127, 85, 240, 0.1)' }
                  }}
                />

                {/* Workflow run helper */}
                <IconButton size="small" onClick={() => setIsContentDialogOpen(true)} aria-label="Draft content run" sx={{ color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <EditNoteIcon sx={{ fontSize: '0.95rem' }} />
                </IconButton>

                {/* Guide helper */}
                <IconButton size="small" onClick={() => setIsHelpOpen(true)} aria-label="Ask help guide" sx={{ color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <HelpOutlineIcon sx={{ fontSize: '0.95rem' }} />
                </IconButton>
              </Box>
            </Box>

            {/* Split layout containing Main Workbench + Right Inspector Feed */}
            <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', overflow: 'hidden' }}>
              
              {/* ZONE 2: Middle Main Workbench */}
              <Box
                sx={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  borderRight: '1px solid rgba(255,255,255,0.08)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Active workspace card display scroll zone */}
                <Box className="scroll-container" sx={{ flexGrow: 1, overflowY: 'auto', p: 3 }}>
                  
                  {/* Console prompt representing active query & reply text details */}
                  {activeQuery && activeReply && (
                    <Paper 
                      variant="outlined" 
                      sx={{ 
                        p: 2, 
                        mb: 2.5, 
                        background: 'rgba(0, 0, 0, 0.2)', 
                        borderColor: 'rgba(127, 85, 240, 0.15)', 
                        borderRadius: '8px' 
                      }}
                    >
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#b794f4', display: 'block', mb: 1 }}>
                        &gt; {activeQuery}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#cbd5e1', lineHeight: 1.5 }}>
                        {activeReply}
                      </Typography>
                    </Paper>
                  )}

                  {/* Render focused active card component */}
                  {activeComponent ? (
                    <Box sx={{ mb: 2 }}>
                      <InteractiveComponent
                        uiComponent={activeComponent}
                        onAction={handleSend}
                        onApproveAction={handleApproveAction}
                        onCancelAction={handleRemoveItem}
                        activeLens={activeLens}
                      />
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                        <Button 
                          size="small" 
                          variant="outlined" 
                          onClick={() => { setActiveComponent(null); setActiveReply(null); setActiveQuery(null); }}
                          sx={{ borderColor: 'rgba(255,255,255,0.1)', color: '#71717a', borderRadius: '6px' }}
                        >
                          Clear Active Card
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    /* Default state: WorkbenchOverview dashboard */
                    <Box sx={{ animation: 'appleSpringIn 0.3s ease' }}>
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#f4f4f5', mb: 0.5 }}>
                          Workbench Overview
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#71717a' }}>
                          Select an app connection or trigger context commands to populate workspace telemetry cards.
                        </Typography>
                      </Box>

                      {/* Capabilities metric tiles grid */}
                      <Grid container spacing={2} sx={{ mb: 3.5 }}>
                        <Grid item xs={12} sm={4}>
                          <Paper variant="outlined" sx={{ p: 2, background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)' }}>
                            <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 700 }}>WORKSPACES</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 800, color: '#f4f4f5', mt: 0.5 }}>
                              {workspacesList.length} Allowed
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Paper variant="outlined" sx={{ p: 2, background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)' }}>
                            <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 700 }}>SOOTHSAYER CONNECTION</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 800, color: soothsayerStatus === 'online' ? '#22c55e' : '#a1a1aa', mt: 0.5 }}>
                              {soothsayerStatus === 'online' ? 'Verified Live' : 'No Signal'}
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Paper variant="outlined" sx={{ p: 2, background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)' }}>
                            <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 700 }}>EXECUTION ADAPTER</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 800, color: '#b794f4', mt: 0.5 }}>
                              Dry-Run Mode
                            </Typography>
                          </Paper>
                        </Grid>
                      </Grid>

                      {/* Quick-Prompt suggestions */}
                      <Paper variant="outlined" sx={{ p: 2.5, background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)' }}>
                        <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, display: 'block', mb: 1.5 }}>
                          SUGGESTED WORKBENCH PROMPTS
                        </Typography>
                        <Stack direction="column" spacing={1.5}>
                          {[
                            { label: 'inspect soothsayer', desc: 'Inspect live app endpoints and health status configurations' },
                            { label: 'List workspaces', desc: 'Lists registered directory folders configured' },
                            { label: 'git status in flowright', desc: 'Scan repository status for unstaged changes' },
                            { label: 'run npm run verify in flowright', desc: 'Validate flowright repository build logs' }
                          ].map(prompt => (
                            <Box
                              key={prompt.label}
                              onClick={() => handleSend(prompt.label)}
                              sx={{
                                p: 1.5,
                                px: 2,
                                borderRadius: '8px',
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.04)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                '&:hover': {
                                  background: 'rgba(127,85,240,0.05)',
                                  borderColor: 'rgba(127, 85, 240, 0.2)'
                                }
                              }}
                            >
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#f4f4f5' }}>
                                {prompt.label}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {prompt.desc}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      </Paper>
                    </Box>
                  )}

                  {/* Compact chat log indicator display if active messages exist */}
                  {messages.length > 0 && (
                    <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, display: 'block', mb: 2 }}>
                        COMPACT CONVERSATION TRAIL ({messages.length})
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {messages.slice(-4).map((msg, idx) => (
                          <Paper 
                            key={idx} 
                            elevation={0}
                            sx={{ 
                              p: 1.5, 
                              background: msg.role === 'user' ? 'rgba(127,85,240,0.05)' : 'rgba(255,255,255,0.01)', 
                              borderColor: 'rgba(255,255,255,0.04)' 
                            }}
                          >
                            <Typography variant="caption" sx={{ color: msg.role === 'user' ? '#b794f4' : '#71717a', fontWeight: 800, display: 'block', mb: 0.5 }}>
                              {msg.role === 'user' ? 'YOU' : 'PORTAL'}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#cbd5e1', lineHeight: 1.4 }}>
                              {msg.content}
                            </Typography>
                            
                            {/* If card exists, display a compact chip linking to Main Workbench slot */}
                            {msg.uiComponent && (
                              <Box sx={{ mt: 1 }}>
                                <Chip
                                  label={`Open ${msg.uiComponent.type} Workbench Slot`}
                                  onClick={() => {
                                    if (msg.uiComponent) {
                                      setActiveComponent(msg.uiComponent);
                                      setActiveQuery(msg.content);
                                      setActiveReply(msg.content);
                                    }
                                  }}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                  sx={{ cursor: 'pointer', height: 20, fontSize: '0.65rem', borderRadius: '4px' }}
                                />
                              </Box>
                            )}
                          </Paper>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 3 }}>
                      <Paper
                        elevation={0}
                        sx={{
                          py: 1,
                          px: 2,
                          background: 'rgba(255, 255, 255, 0.01)',
                          borderColor: 'rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5
                        }}
                      >
                        <CircularProgress size={12} sx={{ color: '#7f5af0' }} />
                        <Typography variant="caption" sx={{ color: '#a1a1aa', fontWeight: 600 }}>
                          Analyzing workspace...
                        </Typography>
                      </Paper>
                    </Box>
                  )}
                  <div ref={messagesEndRef} />
                </Box>

                {/* Bottom Chat Input Dock with suggestions bar above it */}
                <Box
                  sx={{
                    p: 2.5,
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(9, 9, 11, 0.3)'
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ mb: 1.5, overflowX: 'auto', pb: 0.5 }}>
                    <Chip 
                      label="inspect soothsayer" 
                      onClick={() => handleSend('inspect soothsayer')} 
                      size="small" 
                      sx={{ height: 22, fontSize: '0.65rem', background: 'rgba(255,255,255,0.03)', color: '#cbd5e1', cursor: 'pointer' }} 
                    />
                    <Chip 
                      label="show connected systems" 
                      onClick={() => handleSend('List workspaces')} 
                      size="small" 
                      sx={{ height: 22, fontSize: '0.65rem', background: 'rgba(255,255,255,0.03)', color: '#cbd5e1', cursor: 'pointer' }} 
                    />
                    <Chip 
                      label="track flowright repo" 
                      onClick={() => handleSend('git status in flowright')} 
                      size="small" 
                      sx={{ height: 22, fontSize: '0.65rem', background: 'rgba(255,255,255,0.03)', color: '#cbd5e1', cursor: 'pointer' }} 
                    />
                    <Chip 
                      label="run npm run verify in flowright" 
                      onClick={() => handleSend('run npm run verify in flowright')} 
                      size="small" 
                      sx={{ height: 22, fontSize: '0.65rem', background: 'rgba(255,255,255,0.03)', color: '#cbd5e1', cursor: 'pointer' }} 
                    />
                  </Stack>
                  <ChatInput onSend={handleSend} />
                </Box>
              </Box>

              {/* ZONE 3: Right Inspector / Intelligence Feed */}
              <Box
                sx={{
                  width: 380,
                  minWidth: 380,
                  display: { xs: 'none', lg: 'flex' },
                  flexDirection: 'column',
                  height: '100%',
                  background: 'rgba(9, 9, 11, 0.15)'
                }}
              >
                <PreviewPanel
                  previewFeed={previewFeed}
                  onClose={() => handleClearFeed()}
                  onAction={(query) => {
                    handleSend(query);
                  }}
                  onRemoveItem={handleRemoveItem}
                  onClearFeed={handleClearFeed}
                  onApproveAction={handleApproveAction}
                  onContentWorkflowReview={handleContentWorkflowReview}
                  token={token}
                  loading={loading}
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default App;
