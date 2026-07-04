// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Box, Container, CssBaseline, ThemeProvider, createTheme, Paper, Typography, TextField, Button, CircularProgress, Grid, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { PreviewPanel, FeedItem } from './components/PreviewPanel';
import type { UiComponent } from '../shared/uiComponent';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close';
import EditNoteIcon from '@mui/icons-material/EditNote';

// Premium Apple-like dark theme with refined typography and soft border outlines
const appleTheme = createTheme({
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
      default: '#09090b',
      paper: 'rgba(20, 20, 25, 0.4)',
    },
    primary: { main: '#7f5af0' },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          background: 'rgba(20, 20, 25, 0.45)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '999px',
          padding: '8px 20px',
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
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [journeyStep, setJourneyStep] = useState<number>(1);
  const [isCmdKOpen, setIsCmdKOpen] = useState<boolean>(false);
  const [cmdKQuery, setCmdKQuery] = useState<string>('');
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  // Governed content workflow (flowright) — a structurally different flow
  // from the shell-command ProposedAction above. This drives a real
  // flowright run through create -> drive -> awaiting_review, then the
  // review click resolves the human_review gate flowright itself enforces.
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

  // On session start: recall workspace memory from rook MCP and show in feed
  useEffect(() => {
    if (!token) return;
    const now = new Date().toLocaleTimeString();
    fetch('/api/memory/recall?category=workspace', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then((data: { memories: string[]; bridgeReady: boolean }) => {
        setPreviewFeed(prev => [
          {
            id: 'memory-recall-session',
            type: 'MemoryRecall',
            data: { memories: data.memories || [], bridgeReady: data.bridgeReady },
            timestamp: now
          },
          ...prev
        ]);
      })
      .catch(() => { /* bridge unavailable — silently skip */ });
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
    const normalizedQuery = text.toLowerCase();
    
    // Command execution interceptor — proposes only. Nothing runs until the
    // user clicks Approve on the resulting card; see handleApproveAction.
    const execRegex = /(?:run|execute|exec)\s+(npm run \w+|npm test|cargo \w+|git diff|git status)\s+in\s+([\w-]+)/i;
    const execMatch = text.match(execRegex);
    if (execMatch) {
      const command = execMatch[1].trim();
      const workspace = execMatch[2].trim();
      const procId = Math.random().toString(36).substr(2, 9);

      addMessage({ role: 'user', content: text });
      addMessage({
        role: 'assistant',
        content: `I can run "${command}" in ${workspace}. Nothing runs until you approve it.`,
        uiComponent: { type: 'ProposedAction', data: { workspaceName: workspace, command, procId } }
      });

      setPreviewFeed(prev => [
        ...prev,
        {
          id: procId,
          type: 'ProposedAction',
          data: { workspaceName: workspace, command },
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
      return;
    }
    if (normalizedQuery.includes('workspace')) {
      setJourneyStep(prev => Math.max(prev, 2));
    } else if (normalizedQuery.includes('git status') || normalizedQuery.includes('activity')) {
      setJourneyStep(prev => Math.max(prev, 3));
    } else if (normalizedQuery.includes('read')) {
      setJourneyStep(prev => Math.max(prev, 4));
    } else if (journeyStep >= 4) {
      setJourneyStep(prev => Math.max(prev, 5));
    }

    addMessage({ role: 'user', content: text });
    setLoading(true);

    // Real id for stitching the eventual real feed item (if any) back to
    // this request — nothing fake gets pushed to previewFeed until there's
    // an actual response to show.
    const loadingId = Math.random().toString(36).substr(2, 9);
    const currentTimestamp = new Date().toLocaleTimeString();

    const historyPayload = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    // Trigger api request in the background
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

    // Wait for the real response — no fabricated step narration. The chat
    // pane shows one honest "Thinking..." indicator (via `loading`); the
    // right panel stays as-is until there's an actual uiComponent to show.
    const awaitResponse = async () => {
      try {
        const data = await apiPromise;

        // ProposedAction cards need to reference an id the chat bubble's
        // own Approve button can use, so the chat and (if a feed item gets
        // created) the panel act on the exact same run — the backend has
        // no notion of this id, so it's stitched in here.
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

        // Only real, structured results get a feed card — no placeholder
        // ever occupied this slot, so this is a straight append.
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

    awaitResponse();
  };

  const handleTokenSave = () => {
    const trimmed = tokenInput.trim();
    if (trimmed) {
      localStorage.setItem('portalToken', trimmed);
      setToken(trimmed);
      setShowTokenPrompt(false);
    }
  };

  const handleRemoveItem = (id: string) => {
    setPreviewFeed(prev => prev.filter(item => item.id !== id));
  };

  // The one place a proposed command actually becomes a running process.
  // Called only from the ProposedAction card's Approve button — never
  // automatically. /api/execute still re-validates against its own
  // allowlist server-side regardless of what was proposed.
  const handleApproveAction = async (procId: string, workspaceName: string, command: string) => {
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

  // Starts a real flowright governed run (websiteops.website_content_publish.v0)
  // and drives it to its first stop — normally awaiting_review. This never
  // approves anything itself; it only gets the run to the point where a
  // human decision is possible.
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

      setPreviewFeed(prev => prev.map(item => item.id === itemId ? {
        ...item,
        data: {
          run: {
            runId: driven.run.runId,
            workflowId: driven.run.workflowId,
            status: driven.run.status,
            currentStepId: driven.run.currentStepId,
            siteGoal: form.siteGoal,
            targetPages: form.targetPages
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

  // The one place a flowright human_review gate actually resolves — only
  // ever called from an explicit Approve/Reject/Request-revision click.
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
      // Approval resumes the run — drive it the rest of the way (export +
      // feedback-capture steps) so the card lands on a real terminal state.
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

      setPreviewFeed(prev => prev.map(item => item.id === itemId ? {
        ...item,
        data: {
          ...item.data,
          run: { ...item.data.run, status: finalRun.status, currentStepId: finalRun.currentStepId },
          busy: false
        }
      } : item));

      // Completed runs get their real evidence bundle fetched once, not
      // fabricated from the drive response.
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

  const hasPreview = previewFeed.length > 0 || loading;

  const getStepIcon = (step: number) => {
    if (journeyStep >= step + 1) {
      return <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />;
    }
    if (journeyStep < step) {
      return <LockOutlinedIcon sx={{ fontSize: 16 }} />;
    }
    return <PlayCircleOutlineIcon sx={{ fontSize: 16 }} />;
  };

  return (
    <ThemeProvider theme={appleTheme}>
      <CssBaseline />
      
      {/* Cmd+K spotlight search overlay */}
      {isCmdKOpen && (
        <Box
          onClick={() => setIsCmdKOpen(false)}
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
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
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65), 0 0 40px rgba(127, 85, 240, 0.12)',
              animation: 'appleSpringIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}
          >
            {/* Spotlight input */}
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

            {/* command list */}
            <Box sx={{ p: 1.5, maxHeight: '320px', overflowY: 'auto' }}>
              <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: '#71717a', fontWeight: 700, letterSpacing: '0.05em' }}>
                SUGGESTED COMMANDS
              </Typography>
              
              {[
                { title: 'Connected systems', cmd: 'List workspaces', desc: 'See everything the portal can currently observe' },
                { title: "What's changed in flowright", cmd: 'git status in flowright', desc: 'Recent activity and working state' },
                { title: 'Summarize rook', cmd: 'Read README.md in rook', desc: 'Plain-language overview of the project' },
                { title: 'Summarize flowright', cmd: 'Read README.md in flowright', desc: 'Plain-language overview of the project' },
                { title: 'Build flowright', cmd: 'run npm run build in flowright', desc: 'Propose a build — nothing runs until you approve it' },
                { title: 'Verify flowright', cmd: 'run npm run verify in flowright', desc: 'Propose flowright’s own verify check — nothing runs until you approve it' }
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
                      borderRadius: '12px',
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

      <Container 
        maxWidth={hasPreview ? (isFullscreen ? false : "lg") : "md"} 
        sx={{ 
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column', 
          py: 3,
          position: 'relative',
          zIndex: 10,
          transition: 'max-width 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {showTokenPrompt && (
          <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, color: '#f4f4f5' }}>Access Authentication</Typography>
            <Typography variant="body2" sx={{ mb: 2, color: '#a1a1aa' }}>
              To sync securely with your local Express server, enter the token configured in your .env file.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                variant="filled"
                placeholder="Secure access token"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                sx={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', '& .MuiFilledInput-root': { borderRadius: '12px' } }}
              />
              <Button variant="contained" onClick={handleTokenSave} sx={{ px: 4 }}>Save</Button>
            </Box>
          </Paper>
        )}

        {/* Minimalist Apple Header with High-Fidelity Telemetry Stats */}
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            mb: 2.5,
            px: 1,
            py: 1
          }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: '#f4f4f5' }}>
              MyAI Portal
            </Typography>
            <Typography variant="caption" sx={{ color: '#a1a1aa', fontWeight: 500 }}>
              AI Systems Observability
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
            {/* Command Palette trigger chip */}
            <Chip 
              label="Cmd+K for commands" 
              onClick={() => setIsCmdKOpen(true)}
              size="small" 
              sx={{ 
                height: 20, 
                fontSize: '0.65rem', 
                background: 'rgba(127, 85, 240, 0.06)', 
                color: '#b794f4',
                border: '1px solid rgba(127, 85, 240, 0.18)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  background: 'rgba(127, 85, 240, 0.12)',
                  borderColor: 'rgba(127, 85, 240, 0.3)'
                }
              }}
            />

            {/* Reopen the "what can I ask" guide anytime — the inline
                journey tracker below only shows before the first message */}
            <IconButton
              size="small"
              onClick={() => setIsHelpOpen(true)}
              aria-label="What can I ask?"
              sx={{
                width: 26,
                height: 26,
                color: '#a1a1aa',
                border: '1px solid rgba(255,255,255,0.08)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  color: '#b794f4',
                  borderColor: 'rgba(127, 85, 240, 0.3)',
                  background: 'rgba(127, 85, 240, 0.08)'
                }
              }}
            >
              <HelpOutlineIcon sx={{ fontSize: '1rem' }} />
            </IconButton>

            {/* Start a real, governed flowright content run — distinct from
                the shell-command control plane. Flowright owns the review
                gate; this only opens the intake form for it. */}
            <IconButton
              size="small"
              onClick={() => setIsContentDialogOpen(true)}
              aria-label="Draft a content update"
              sx={{
                width: 26,
                height: 26,
                color: '#a1a1aa',
                border: '1px solid rgba(255,255,255,0.08)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  color: '#b794f4',
                  borderColor: 'rgba(127, 85, 240, 0.3)',
                  background: 'rgba(127, 85, 240, 0.08)'
                }
              }}
            >
              <EditNoteIcon sx={{ fontSize: '1rem' }} />
            </IconButton>

            {/* Access mode */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Chip label="GOVERNED" size="small" sx={{ height: 16, fontSize: '0.55rem', background: 'rgba(34, 197, 94, 0.08)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.15)' }} />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22c55e' }} />
              <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 600, fontSize: '0.7rem' }}>
                Connected
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* "What can I ask?" quick reference — reachable anytime via the
            help icon, since the full guided journey below only shows once,
            before the first message is sent. */}
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
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#f4f4f5', letterSpacing: '-0.01em' }}>
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
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
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
              <Typography variant="caption" sx={{ display: 'block', mt: 2.5, color: '#71717a', textAlign: 'center' }}>
                Or press Cmd+K anytime, or just type a question below.
              </Typography>
            </Paper>
          </Box>
        )}

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
              publishes automatically, and nothing here publishes it either.
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
            <TextField label="Source material" value={contentForm.sourceMaterial}
              onChange={(e) => setContentForm(f => ({ ...f, sourceMaterial: e.target.value }))}
              size="small" multiline minRows={2} />
            <TextField label="SEO requirements" value={contentForm.seoRequirements}
              onChange={(e) => setContentForm(f => ({ ...f, seoRequirements: e.target.value }))}
              size="small" />
            <TextField label="Publish constraints" value={contentForm.publishConstraints}
              onChange={(e) => setContentForm(f => ({ ...f, publishConstraints: e.target.value }))}
              size="small" />
          </DialogContent>
          <DialogActions sx={{ p: 2.5, pt: 1 }}>
            <Button onClick={() => setIsContentDialogOpen(false)} sx={{ color: '#a1a1aa', textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={!contentForm.siteGoal || !contentForm.targetPages || !contentForm.contentBrief}
              onClick={() => {
                setIsContentDialogOpen(false);
                handleStartContentWorkflow(contentForm);
              }}
              sx={{ background: '#7f5af0', textTransform: 'none', fontWeight: 700, '&:hover': { background: '#6d47dd' } }}
            >
              Start governed run
            </Button>
          </DialogActions>
        </Dialog>

        <Grid container spacing={3} sx={{ flexGrow: 1, height: 'calc(100% - 70px)', overflow: 'hidden' }}>
          {/* Left Chat Pane */}
          <Grid item xs={12} md={hasPreview ? (isFullscreen ? 4 : 5) : 12} sx={{ display: 'flex', flexDirection: 'column', height: '100%', transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <Box className="scroll-container" sx={{ flexGrow: 1, overflowY: 'auto', mb: 2, pr: 1 }}>
              <Paper elevation={0} sx={{ p: 3.5, minHeight: '100%', display: 'flex', flexDirection: 'column', background: 'rgba(255, 255, 255, 0.015)' }}>
                <Box sx={{ flexGrow: 1 }}>
                  {messages.length === 0 && (
                    <Box sx={{ p: 1, mt: 1 }}>
                      <Typography variant="h5" gutterBottom sx={{ color: '#f4f4f5', fontWeight: 800, mb: 1, letterSpacing: '-0.03em', textAlign: 'center' }}>
                        AI Systems Observability
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 4, color: '#a1a1aa', textAlign: 'center', maxWidth: 450, mx: 'auto', lineHeight: 1.6 }}>
                        See what's happening across your AI systems and ask questions in plain English. You can also ask it to build, test, or check a workspace — nothing runs until you approve it.
                      </Typography>

                      {/* Guided Interactive Journey Tracker */}
                      <Paper variant="outlined" sx={{ p: 3, mb: 2, background: 'rgba(255, 255, 255, 0.01)', borderColor: 'rgba(255, 255, 255, 0.06)' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#f4f4f5' }}>
                            Getting Oriented
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#a1a1aa', fontWeight: 600 }}>
                            {Math.min(100, Math.floor(((journeyStep - 1) / 4) * 100))}% completed
                          </Typography>
                        </Box>

                        <Grid container spacing={2}>
                          {/* Step 1 */}
                          <Grid item xs={12}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                              <Box sx={{ color: journeyStep >= 2 ? '#22c55e' : '#7f5af0', pt: 0.5 }}>
                                {getStepIcon(1)}
                              </Box>
                              <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#f4f4f5', fontSize: '0.85rem' }}>
                                  1. See what's connected
                                </Typography>
                                {journeyStep === 1 && (
                                  <Button size="small" variant="contained" onClick={() => handleSend('List workspaces')} sx={{ mt: 1, fontSize: '0.75rem' }}>
                                    Show connected systems
                                  </Button>
                                )}
                              </Box>
                            </Box>
                          </Grid>

                          {/* Step 2 */}
                          <Grid item xs={12}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, opacity: journeyStep < 2 ? 0.4 : 1 }}>
                              <Box sx={{ color: journeyStep >= 3 ? '#22c55e' : (journeyStep === 2 ? '#7f5af0' : '#71717a'), pt: 0.5 }}>
                                {getStepIcon(2)}
                              </Box>
                              <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#f4f4f5', fontSize: '0.85rem' }}>
                                  2. Check recent activity
                                </Typography>
                                {journeyStep === 2 && (
                                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                    <Button size="small" variant="contained" onClick={() => handleSend('git status in rook')} sx={{ fontSize: '0.75rem' }}>
                                      Check rook
                                    </Button>
                                    <Button size="small" variant="outlined" onClick={() => handleSend('git status in flowright')} sx={{ fontSize: '0.75rem' }}>
                                      Check flowright
                                    </Button>
                                  </Box>
                                )}
                              </Box>
                            </Box>
                          </Grid>

                          {/* Step 3 */}
                          <Grid item xs={12}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, opacity: journeyStep < 3 ? 0.4 : 1 }}>
                              <Box sx={{ color: journeyStep >= 4 ? '#22c55e' : (journeyStep === 3 ? '#7f5af0' : '#71717a'), pt: 0.5 }}>
                                {getStepIcon(3)}
                              </Box>
                              <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#f4f4f5', fontSize: '0.85rem' }}>
                                  3. Open a plain-language summary
                                </Typography>
                                {journeyStep === 3 && (
                                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                    <Button size="small" variant="contained" onClick={() => handleSend('Read README.md in flowright')} sx={{ fontSize: '0.75rem' }}>
                                      Summarize flowright
                                    </Button>
                                    <Button size="small" variant="outlined" onClick={() => handleSend('Read README.md in rook')} sx={{ fontSize: '0.75rem' }}>
                                      Summarize rook
                                    </Button>
                                  </Box>
                                )}
                              </Box>
                            </Box>
                          </Grid>

                          {/* Step 4 */}
                          <Grid item xs={12}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, opacity: journeyStep < 4 ? 0.4 : 1 }}>
                              <Box sx={{ color: journeyStep >= 5 ? '#22c55e' : (journeyStep === 4 ? '#7f5af0' : '#71717a'), pt: 0.5 }}>
                                {getStepIcon(4)}
                              </Box>
                              <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#f4f4f5', fontSize: '0.85rem' }}>
                                  4. Ask anything, in your own words
                                </Typography>
                                {journeyStep === 4 && (
                                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#a1a1aa' }}>
                                    Type a question below — no special syntax needed.
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Box>
                  )}
                  {messages.map((msg, idx) => (
                    <ChatMessage
                      key={idx}
                      role={msg.role}
                      content={msg.content}
                      uiComponent={msg.uiComponent}
                      onAction={(query) => {
                        handleSend(query);
                      }}
                      onApproveAction={handleApproveAction}
                      onCancelAction={handleRemoveItem}
                    />
                  ))}
                  {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2, width: '100%' }}>
                      {/* Honest, minimal "working on it" state — no
                          fabricated step narration. Real progress (when
                          there is any to show) lives in the feed panel as
                          actual structured results, not scripted text. */}
                      <Paper
                        elevation={0}
                        className="feed-card-animation"
                        sx={{
                          py: 1.5,
                          px: 2.5,
                          background: 'rgba(255, 255, 255, 0.015)',
                          borderRadius: '16px',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5
                        }}
                      >
                        <CircularProgress size={14} sx={{ color: '#7f5af0' }} />
                        <Typography variant="body2" sx={{ color: '#a1a1aa', fontWeight: 500 }}>
                          Thinking...
                        </Typography>
                      </Paper>
                    </Box>
                  )}
                  <div ref={messagesEndRef} />
                </Box>
              </Paper>
            </Box>
            <ChatInput onSend={handleSend} />
          </Grid>

          {/* Right Live Preview Pane (Live Feed timeline) */}
          {hasPreview && (
            <Grid item xs={12} md={isFullscreen ? 8 : 7} sx={{ height: '100%', transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
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
            </Grid>
          )}
        </Grid>
      </Container>
    </ThemeProvider>
  );
};

export default App;
