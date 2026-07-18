// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Box, CssBaseline, ThemeProvider, createTheme, Paper, Typography, TextField, Button, CircularProgress, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Grid, Stack, Divider, Tooltip, Snackbar, Alert } from '@mui/material';
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
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import CodeIcon from '@mui/icons-material/Code';
import ForumIcon from '@mui/icons-material/Forum';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { WorkbenchShell } from './components/workbench/WorkbenchShell';
import { WorkbenchModeToggle, WorkbenchMode } from './components/workbench/WorkbenchModeToggle';
import { WorkspaceNavigator, Workspace } from './components/workbench/WorkspaceNavigator';
import { WorkspaceFileTree } from './components/workbench/WorkspaceFileTree';
import { AuditLogsView } from './components/workbench/AuditLogsView';
import { ReadOnlyStatusBanner } from './components/workbench/ReadOnlyStatusBanner';
import { WorkspaceIntelligenceCard } from './components/workbench/WorkspaceIntelligenceCard';
import { QuickActionsDeck } from './components/workbench/QuickActionsDeck';
import { FilePreviewPanel } from './components/workbench/FilePreviewPanel';
import { InspectionTracePanel } from './components/workbench/InspectionTracePanel';
import { TestingCockpit } from './components/workbench/TestingCockpit';
import { StaticStructureCard } from './components/workbench/StaticStructureCard';
import { DependencyMapCard } from './components/workbench/DependencyMapCard';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';

import { useWorkbenchPreferences } from './hooks/useWorkbenchPreferences';
import { WorkbenchLayout } from './components/workbench/WorkbenchLayout';
import { WorkbenchEmptyState } from './components/workbench/WorkbenchEmptyState';
import { WorkbenchFailureState } from './components/workbench/WorkbenchFailureState';
import { LiveWorkbenchSurface } from './components/workbench/LiveWorkbenchSurface';
import { LiveWorkbenchToolbar } from './components/workbench/LiveWorkbenchToolbar';


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
  intent?: string;
  toolsUsed?: { tool: string; status: 'success' | 'denied' | 'failed'; reason?: string }[];
  filesInspected?: { path: string; purpose: string }[];
  citations?: { path: string; label: string }[];
  suggestedActions?: { label: string; message: string }[];
  warnings?: string[];
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

  // Collapsible panels state with localStorage persistence
  const [isLeftRailCollapsed, setIsLeftRailCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('portal-left-collapsed') === 'true';
  });
  const [isRightFeedCollapsed, setIsRightFeedCollapsed] = useState<boolean>(() => {
    const stored = localStorage.getItem('portal-right-collapsed');
    if (stored !== null) return stored === 'true';
    return window.innerWidth < 1280;
  });
  const [showAllHistory, setShowAllHistory] = useState<boolean>(false);

  const [leftRailWidth, setLeftRailWidth] = useState<number>(() => {
    const stored = localStorage.getItem('portal-left-width');
    const val = stored ? parseInt(stored, 10) : 280;
    return isNaN(val) ? 280 : val;
  });

  const [rightFeedWidth, setRightFeedWidth] = useState<number>(() => {
    const stored = localStorage.getItem('portal-right-width');
    const val = stored ? parseInt(stored, 10) : 380;
    return isNaN(val) ? 380 : val;
  });

  const [workbenchMode, setWorkbenchMode] = useState<WorkbenchMode>(() => {
    const stored = localStorage.getItem('portal-workbench-mode');
    return (stored as WorkbenchMode) || 'native-focus';
  });

  const { prefs, setAppId, setLeftPanelWidth } = useWorkbenchPreferences();
  const [localAppStatus, setLocalAppStatus] = React.useState<string>('checking');
  const [localAppDef, setLocalAppDef] = React.useState<any>(null);

  React.useEffect(() => {
    if (prefs.activeAppId && workbenchMode === 'local-app') {
      setLocalAppStatus('checking');
      fetch(`/api/workbench/apps/${prefs.activeAppId}/status`)
        .then(res => res.json())
        .then(data => {
          setLocalAppStatus(data.status);
          // Also fetch app definition from apps list
          return fetch('/api/workbench/apps');
        })
        .then(res => res ? res.json() : null)
        .then(data => {
          if (data && data.apps) {
            const def = data.apps.find((a: any) => a.appId === prefs.activeAppId);
            setLocalAppDef(def || null);
          }
        })
        .catch(err => {
          console.error(err);
          setLocalAppStatus('unavailable');
        });
    }
  }, [prefs.activeAppId, workbenchMode]);

  const handleSelectLocalApp = (appId: string) => {
    setAppId(appId);
  };
  
  const handleClearLocalApp = () => {
    setAppId(null);
    setLocalAppDef(null);
  };

  const handleReloadLocalApp = () => {
    // simple toggle to re-trigger effect
    setLocalAppStatus('checking');
    setTimeout(() => setAppId(prefs.activeAppId), 10);
  };


  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [isAuditLogsOpen, setIsAuditLogsOpen] = useState(false);
  const [isTestingCockpitOpen, setIsTestingCockpitOpen] = useState(false);

  const [workspaceFiles, setWorkspaceFiles] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileError, setFileError] = useState<string>('');
  const [readingFile, setReadingFile] = useState<boolean>(false);
  const [traceRecords, setTraceRecords] = useState<any[]>([]);

  // Static Structure Scan + Dependency Map states
  const [structureData, setStructureData] = useState<any>(null);
  const [loadingStructure, setLoadingStructure] = useState<boolean>(false);
  const [dependencyData, setDependencyData] = useState<any>(null);
  const [loadingDependencies, setLoadingDependencies] = useState<boolean>(false);

  // Snackbar states for Option D transient alerts
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'warning' | 'error' | 'info'>('info');

  const handleSelectDependencyNode = async (node: any) => {
    if (node.status === 'resolved') {
      await handleSelectFile(node.path);
      setSnackbarMessage(`Opened dependency: ${node.path}`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } else {
      let desc = '';
      if (node.status === 'external') {
        desc = 'External module package. Static scan mode resolves local files only.';
      } else if (node.status === 'alias') {
        desc = 'Alias import detected. Path mapping is not resolved in static scan mode.';
      } else if (node.status === 'blocked') {
        desc = 'Blocked by security policy rules defined in myai-policy.json.';
      } else if (node.status === 'skipped') {
        desc = `File was skipped: ${node.reason || 'unsupported extension'}.`;
      } else if (node.status === 'missing') {
        desc = 'Unresolved import path. The file could not be located in standard workspace routes.';
      }
      setSnackbarMessage(desc);
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
    }
  };

  const handleMapDependencies = async (filePath: string) => {
    if (!activeWorkspace) return;
    setLoadingDependencies(true);
    setDependencyData(null);
    try {
      const resp = await fetch('/api/myai-workspaces/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          toolName: 'workspace.mapDependencies',
          arguments: { entryPoint: filePath }
        })
      });
      const data = await resp.json();
      if (resp.ok) {
        setDependencyData(data);
      } else {
        console.error('Dependency mapping failed:', data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDependencies(false);
    }
  };

  const handleSelectFile = async (relPath: string) => {
    setSelectedFile(relPath);
    setReadingFile(true);
    setFileContent('');
    setFileError('');
    setStructureData(null); // Reset scan data
    try {
      const resp = await fetch('/api/myai-workspaces/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId: activeWorkspace?.id,
          toolName: 'workspace.readFile',
          arguments: { relativePath: relPath }
        })
      });
      const data = await resp.json();
      const timestamp = new Date().toISOString();
      if (resp.ok) {
        setFileContent(data.content[0].text);
        setTraceRecords(prev => [{
          timestamp,
          relativePath: relPath,
          tool: 'workspace.readFile',
          allowed: true
        }, ...prev]);

        // Trigger Static Structure Scan if supported extension
        const ext = '.' + relPath.split('.').pop()?.toLowerCase();
        if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py'].includes(ext)) {
          setLoadingStructure(true);
          try {
            const structResp = await fetch('/api/myai-workspaces/query', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                workspaceId: activeWorkspace?.id,
                toolName: 'workspace.analyzeStructure',
                arguments: { relativePath: relPath }
              })
            });
            const structData = await structResp.json();
            if (structResp.ok) {
              setStructureData(structData);
            }
          } catch (structErr) {
            console.error('Structure scan failed:', structErr);
          } finally {
            setLoadingStructure(false);
          }
        }
      } else {
        setFileError(data.error || 'Access Denied by Host Policy.');
        setTraceRecords(prev => [{
          timestamp,
          relativePath: relPath,
          tool: 'workspace.readFile',
          allowed: false,
          reason: data.error || 'Access Denied'
        }, ...prev]);
      }
    } catch (err: any) {
      setFileError(err.message || 'Error loading file.');
    } finally {
      setReadingFile(false);
    }
  };

  const handleTriggerAction = async (actionId: string) => {
    if (!activeWorkspace) return;
    setReadingFile(true);
    setSelectedFile(actionId.toUpperCase().replace('-', ' '));
    setFileContent('');
    setFileError('');
    const timestamp = new Date().toISOString();

    try {
      if (actionId === 'explain-repo') {
        const resp = await fetch('/api/myai-workspaces/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            workspaceId: activeWorkspace.id,
            toolName: 'workspace.info'
          })
        });
        const data = await resp.json();
        if (resp.ok) {
          setFileContent(data.content[0].text);
          setTraceRecords(prev => [{
            timestamp,
            relativePath: 'workspace.info',
            tool: 'workspace.info',
            allowed: true
          }, ...prev]);
        } else {
          setFileError(data.error || 'Failed to explain repo.');
        }
      }

      if (actionId === 'show-configs') {
        const resp = await fetch('/api/myai-workspaces/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            workspaceId: activeWorkspace.id,
            toolName: 'workspace.searchFiles',
            arguments: { query: 'config' }
          })
        });
        const data = await resp.json();
        if (resp.ok) {
          setFileContent(data.content[0].text);
          setTraceRecords(prev => [{
            timestamp,
            relativePath: 'search:config',
            tool: 'workspace.searchFiles',
            allowed: true
          }, ...prev]);
        } else {
          setFileError(data.error || 'Failed to find configs.');
        }
      }

      if (actionId === 'find-todos') {
        const resp = await fetch('/api/myai-workspaces/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            workspaceId: activeWorkspace.id,
            toolName: 'workspace.searchFiles',
            arguments: { query: 'TODO' }
          })
        });
        const data = await resp.json();
        if (resp.ok) {
          setFileContent(data.content[0].text);
          setTraceRecords(prev => [{
            timestamp,
            relativePath: 'search:TODO',
            tool: 'workspace.searchFiles',
            allowed: true
          }, ...prev]);
        } else {
          setFileError(data.error || 'Failed to find TODOs.');
        }
      }

      if (actionId === 'git-status') {
        const resp = await fetch('/api/myai-workspaces/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            workspaceId: activeWorkspace.id,
            toolName: 'workspace.getGitStatus'
          })
        });
        const data = await resp.json();
        if (resp.ok) {
          setFileContent(data.content[0].text);
          setTraceRecords(prev => [{
            timestamp,
            relativePath: 'git status',
            tool: 'workspace.getGitStatus',
            allowed: true
          }, ...prev]);
        } else {
          setFileError(data.error || 'Failed to query git status.');
        }
      }

      if (actionId === 'security-demo') {
        const resp = await fetch('/api/myai-workspaces/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            workspaceId: activeWorkspace.id,
            toolName: 'workspace.readFile',
            arguments: { relativePath: 'apps/api/.env' }
          })
        });
        const data = await resp.json();
        if (resp.ok) {
          setFileContent(data.content[0].text);
        } else {
          setFileError(data.error || 'Blocked by host policy.');
          setTraceRecords(prev => [{
            timestamp,
            relativePath: 'apps/api/.env',
            tool: 'workspace.readFile',
            allowed: false,
            reason: data.error || 'Access Denied'
          }, ...prev]);
        }
      }
    } catch (err: any) {
      setFileError(err.message || 'Action execution error.');
    } finally {
      setReadingFile(false);
    }
  };

  const handleLeftResize = (deltaX: number) => {
    setLeftRailWidth(prev => {
      const next = Math.max(240, Math.min(340, prev + deltaX));
      localStorage.setItem('portal-left-width', String(next));
      return next;
    });
  };

  const handleRightResize = (deltaX: number) => {
    setRightFeedWidth(prev => {
      const next = Math.max(320, Math.min(1100, prev + deltaX));
      localStorage.setItem('portal-right-width', String(next));
      return next;
    });
  };

  const handleWorkbenchModeChange = (nextMode: WorkbenchMode) => {
    setWorkbenchMode(nextMode);
    localStorage.setItem('portal-workbench-mode', nextMode);
  };

  const isSoothsayerLivePlaneActive = Boolean(
    activeComponent?.type === 'SoothsayerWorkbench' &&
    (activeComponent.data as any)?.embed?.allowed &&
    (activeComponent.data as any)?.embedUrl
  );

  useEffect(() => {
    if (isSoothsayerLivePlaneActive && isRightFeedCollapsed) {
      setIsRightFeedCollapsed(false);
      localStorage.setItem('portal-right-collapsed', 'false');
    }
    if (isSoothsayerLivePlaneActive && rightFeedWidth < 760) {
      setRightFeedWidth(760);
      localStorage.setItem('portal-right-width', '760');
    }
  }, [isSoothsayerLivePlaneActive, isRightFeedCollapsed, rightFeedWidth]);

  const toggleLeftRail = () => {
    setIsLeftRailCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('portal-left-collapsed', String(next));
      return next;
    });
  };

  const toggleRightFeed = () => {
    setIsRightFeedCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('portal-right-collapsed', String(next));
      return next;
    });
  };

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
    fetch('https://ops-soothsayer-web-production.up.railway.app/', { mode: 'no-cors' })
      .then(() => {
        fetch('https://ops-soothsayer-web-production.up.railway.app/api/portal-manifest')
          .then(r => {
            if (r.ok) setSoothsayerStatus('online');
            else setSoothsayerStatus('degraded');
          })
          .catch(() => {
            setSoothsayerStatus('degraded');
          });
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

  // Poll browser observations periodically to feed the Intelligence Feed
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      try {
        const resp = await fetch('/api/browser/observations', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (resp.ok) {
          const responseData = await resp.json();
          // Backward compatibility for when it was just an array, or the new object format
          const obsData = Array.isArray(responseData) ? responseData : (responseData.observations || []);
          const extData = responseData.extractions || [];

          setPreviewFeed(prev => {
            const newItems = obsData.filter((obs: any) => !prev.some(item => item.id === obs.captureId));
            const newExtractions = extData.filter((ext: any) => !prev.some(item => item.id === ext.extractionId || item.id === ext.parentCaptureId));
            
            if (newItems.length === 0 && newExtractions.length === 0) return prev;
            
            const convertedObs = newItems.map((obs: any) => ({
              id: obs.captureId,
              type: 'BrowserObservation' as const,
              data: obs,
              timestamp: obs.capturedAt
            }));

            const convertedExt = newExtractions.map((ext: any) => ({
              id: ext.extractionId || ext.parentCaptureId,
              type: 'BrowserExtraction' as const,
              data: ext,
              timestamp: ext.source.capturedAt
            }));

            return [...prev, ...convertedObs, ...convertedExt];
          });
        }
      } catch (e) {
        console.warn('Failed to poll browser observations:', e);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [token]);

  const addMessage = (msg: Message) => {
    setMessages(prev => [...prev, msg]);
  };

  const handleSend = async (text: string) => {
    addMessage({ role: 'user', content: text });
    setLoading(true);

    const loadingId = Math.random().toString(36).substr(2, 9);
    const currentTimestamp = new Date().toLocaleTimeString();

    const apiPromise = fetch('/api/orchestrator/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: text,
        workspaceId: activeWorkspace ? activeWorkspace.id : null,
        selectedFile: selectedFile,
        persona: activeLens,
        captureId: activeComponent?.type === 'BrowserObservation' ? activeComponent.data.captureId : undefined
      }),
    }).then(async (resp) => {
      if (resp.status === 401) {
        throw new Error('Unauthorized');
      }
      return resp.json();
    });

    try {
      const data = await apiPromise;

      addMessage({
        role: 'assistant',
        content: data.answer ?? 'No response',
        intent: data.intent,
        toolsUsed: data.toolsUsed,
        filesInspected: data.filesInspected,
        citations: data.citations,
        suggestedActions: data.suggestedActions,
        warnings: data.warnings
      });

      setActiveReply(data.answer ?? null);
      setActiveQuery(text);
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

  const renderChatTranscript = () => {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {/* Orchestrator Header Banner */}
        <Box sx={{ p: 1.5, background: 'rgba(127, 85, 240, 0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 700, letterSpacing: '0.05em' }}>
            ORCHESTRATOR MODE: <span style={{ color: '#a78bfa' }}>READ-ONLY</span>
          </Typography>
          <Chip label="Grounded Inspection Trace" size="small" sx={{ height: 16, fontSize: '0.55rem', background: 'rgba(255,255,255,0.04)', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.05)' }} />
        </Box>

        {/* Scrollable messages container */}
        <Box 
          sx={{ 
            flexGrow: 1, 
            overflowY: 'auto', 
            p: 3, 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 2.5,
            minHeight: 0
          }}
        >
          {messages.length === 0 ? (
            !activeWorkspace ? (
              <Box sx={{ m: 'auto', textAlign: 'center', opacity: 0.8, py: 4, maxWidth: '280px' }}>
                <FolderOpenIcon sx={{ fontSize: 44, color: '#fbbf24', mb: 1.5, opacity: 0.8 }} />
                <Typography variant="subtitle2" sx={{ color: '#e4e4e7', fontWeight: 700, mb: 0.5, fontSize: '0.85rem' }}>
                  Select a Workspace
                </Typography>
                <Typography variant="caption" sx={{ color: '#71717a', display: 'block', lineHeight: 1.4, fontSize: '0.72rem' }}>
                  Select a workspace folder from the catalog in the left rail to let the orchestrator inspect files safely.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ m: 'auto', textAlign: 'center', opacity: 0.35, py: 4 }}>
                <ForumIcon sx={{ fontSize: 48, color: '#7f5af0', mb: 1 }} />
                <Typography variant="body2" sx={{ color: '#cbd5e1', fontSize: '0.8rem' }}>
                  Start a governed conversation with Tessera Workbench.
                </Typography>
              </Box>
            )
          ) : (
            messages.map((msg, idx) => (
              <Box 
                key={idx} 
                sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 2, 
                    background: msg.role === 'user' ? 'rgba(127, 85, 240, 0.1)' : 'rgba(255, 255, 255, 0.02)', 
                    border: msg.role === 'user' ? '1px solid rgba(127, 85, 240, 0.25)' : '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  }}
                >
                  <Typography variant="caption" sx={{ color: msg.role === 'user' ? '#b794f4' : '#71717a', fontWeight: 800, display: 'block', mb: 0.5 }}>
                    {msg.role === 'user' ? 'YOU' : `PORTAL ORCHESTRATOR${msg.intent ? ` (${msg.intent.toUpperCase()})` : ''}`}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#f4f4f5', lineHeight: 1.5, whiteSpace: 'pre-wrap', fontSize: '0.78rem' }}>
                    {msg.content}
                  </Typography>

                  {/* Collapsible inspected files log */}
                  {msg.filesInspected && msg.filesInspected.length > 0 && (
                    <Box sx={{ mt: 1.5 }}>
                      <details style={{ cursor: 'pointer', outline: 'none' }}>
                        <summary style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 600, userSelect: 'none' }}>
                          What I inspected ({msg.filesInspected.length} files)
                        </summary>
                        <Box sx={{ pl: 1.5, mt: 0.5, borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
                          {msg.filesInspected.map((f, fi) => (
                            <Typography key={fi} variant="caption" sx={{ color: '#cbd5e1', display: 'block', fontFamily: 'monospace', fontSize: '10px' }}>
                              🔍 {f.path} ({f.purpose})
                            </Typography>
                          ))}
                        </Box>
                      </details>
                    </Box>
                  )}

                  {/* Collapsible tool execution trace */}
                  {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <details style={{ cursor: 'pointer', outline: 'none' }}>
                        <summary style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 600, userSelect: 'none' }}>
                          Tool execution trace ({msg.toolsUsed.length} calls)
                        </summary>
                        <Box sx={{ pl: 1.5, mt: 0.5, borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
                          {msg.toolsUsed.map((t, ti) => (
                            <Typography key={ti} variant="caption" sx={{ color: t.status === 'success' ? '#22c55e' : t.status === 'denied' ? '#ef4444' : '#fbbf24', display: 'block', fontFamily: 'monospace', fontSize: '10px' }}>
                              🛠️ {t.tool} : {t.status.toUpperCase()} {t.reason ? `(${t.reason})` : ''}
                            </Typography>
                          ))}
                        </Box>
                      </details>
                    </Box>
                  )}

                  {/* Citations list */}
                  {msg.citations && msg.citations.length > 0 && (
                    <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 700, display: 'block', mb: 0.5 }}>
                        CITATIONS:
                      </Typography>
                      <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                        {msg.citations.map((c, ci) => (
                          <Chip
                            key={ci}
                            label={c.label}
                            onClick={() => handleSelectFile(c.path)}
                            size="small"
                            sx={{ height: 16, fontSize: '9px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#cbd5e1', cursor: 'pointer' }}
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {/* Policy Warnings list */}
                  {msg.warnings && msg.warnings.length > 0 && (
                    <Box sx={{ mt: 1.5, p: 1, background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '6px' }}>
                      {msg.warnings.map((w, wi) => (
                        <Typography key={wi} variant="caption" sx={{ color: '#f87171', display: 'block', fontSize: '10px' }}>
                          ⚠️ {w}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Paper>

                {/* Suggested actions list */}
                {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                  <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.8, alignSelf: 'flex-start' }}>
                    {msg.suggestedActions.map((act, ai) => (
                      <Chip
                        key={ai}
                        label={act.label}
                        onClick={() => handleSend(act.message)}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '10px',
                          background: 'rgba(127, 85, 240, 0.08)',
                          color: '#b794f4',
                          border: '1px solid rgba(127, 85, 240, 0.25)',
                          cursor: 'pointer',
                          '&:hover': { background: 'rgba(127, 85, 240, 0.15)' }
                        }}
                      />
                    ))}
                  </Stack>
                )}
              </Box>
            ))
          )}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', p: 1 }}>
              <CircularProgress size={12} sx={{ color: '#7f5af0', mr: 1.5 }} />
              <Typography variant="caption" sx={{ color: '#71717a' }}>Inspecting and summarizing...</Typography>
            </Box>
          )}
          <div ref={messagesEndRef} />
        </Box>
      </Box>
    );
  };

  const renderActiveWorkspaceWorkbench = () => {
    if (!activeWorkspace) return null;

    return (
      <Box sx={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Grid container spacing={3} sx={{ flexGrow: 1, minHeight: 0, height: '100%', p: 3, overflow: 'hidden' }}>
          {/* Left panel: FileTree navigation only */}
          <Grid item xs={12} md={4} sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: { md: '1px solid rgba(255,255,255,0.06)' }, pr: { md: 2 } }}>
            <WorkspaceFileTree
              token={token}
              workspace={activeWorkspace}
              selectedFile={selectedFile}
              onSelectFile={handleSelectFile}
              onFilesLoaded={(files) => setWorkspaceFiles(files)}
            />
          </Grid>

          {/* Right panel: dashboard cards, actions, preview panel, citations trace */}
          <Grid item xs={12} md={8} sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2.5, minHeight: 0, overflowY: 'auto', pl: { md: 2 } }}>
            {/* Workspace Intelligence Stack card */}
            <WorkspaceIntelligenceCard
              files={workspaceFiles}
              workspaceName={activeWorkspace.name}
            />

            {/* Guided Actions Deck */}
            <QuickActionsDeck onTriggerAction={handleTriggerAction} />

            {/* Safe Code File Viewer */}
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                background: 'rgba(9, 9, 11, 0.25)',
                borderColor: 'rgba(255,255,255,0.06)',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                minHeight: '280px'
              }}
            >
              <FilePreviewPanel
                filePath={selectedFile}
                content={fileContent}
                error={fileError}
                reading={readingFile}
                onExplainCode={(fileName) => handleSend(`Explain the file: ${fileName}`)}
              />
            </Paper>

            {/* Static Structure Analysis & Dependency Map Section */}
            {selectedFile && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <StaticStructureCard
                  data={structureData}
                  loading={loadingStructure}
                  onNavigateToLine={(line) => {
                    console.log(`Navigate to line: ${line}`);
                    // Trigger scroll or action
                  }}
                />
                
                {structureData && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<DeviceHubIcon />}
                      onClick={() => handleMapDependencies(selectedFile)}
                      disabled={loadingDependencies}
                      sx={{
                        background: 'rgba(127, 85, 240, 0.8)',
                        '&:hover': { background: '#7f5af0' },
                        borderRadius: '6px',
                        textTransform: 'none',
                        fontWeight: 600
                      }}
                    >
                      {loadingDependencies ? 'Mapping dependencies...' : 'Map Dependency Routes'}
                    </Button>
                  </Box>
                )}

                {(dependencyData || loadingDependencies) && (
                  <DependencyMapCard
                    data={dependencyData}
                    loading={loadingDependencies}
                    onSelectNode={handleSelectDependencyNode}
                  />
                )}
              </Box>
            )}

            {/* Citations Log Trace */}
            <InspectionTracePanel
              records={traceRecords}
              onSelectFile={handleSelectFile}
            />
          </Grid>
        </Grid>
      </Box>
    );
  };

  const renderEmptyState = () => {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%', 
          p: 4, 
          textAlign: 'center',
          background: 'rgba(9, 9, 11, 0.2)',
          borderRadius: '12px',
          border: '1px dashed rgba(255, 255, 255, 0.08)',
          m: 3
        }}
      >
        <FolderOpenIcon sx={{ fontSize: 48, color: '#7f5af0', mb: 2, opacity: 0.8 }} />
        <Typography variant="h6" sx={{ color: '#e4e4e7', fontWeight: 700, mb: 1, fontSize: '1rem' }}>
          Select a workspace to begin
        </Typography>
        <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 800, mb: 3.5, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.62rem' }}>
          Read-only mode is active. No files will be changed.
        </Typography>

        <Box sx={{ maxWidth: '380px', textAlign: 'left' }}>
          <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, display: 'block', mb: 1.5, letterSpacing: '0.05em' }}>
            GETTING STARTED:
          </Typography>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Chip label="1" size="small" sx={{ background: 'rgba(127, 85, 240, 0.1)', color: '#b794f4', fontWeight: 700, height: 20, width: 20, minWidth: 20 }} />
              <Typography variant="body2" sx={{ color: '#cbd5e1', fontSize: '0.78rem', lineHeight: 1.4 }}>
                Choose or enable a workspace folder from the catalog in the left rail.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Chip label="2" size="small" sx={{ background: 'rgba(127, 85, 240, 0.1)', color: '#b794f4', fontWeight: 700, height: 20, width: 20, minWidth: 20 }} />
              <Typography variant="body2" sx={{ color: '#cbd5e1', fontSize: '0.78rem', lineHeight: 1.4 }}>
                Inspect directories and safe code files recursively inside the sandbox canvas.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Chip label="3" size="small" sx={{ background: 'rgba(127, 85, 240, 0.1)', color: '#b794f4', fontWeight: 700, height: 20, width: 20, minWidth: 20 }} />
              <Typography variant="body2" sx={{ color: '#cbd5e1', fontSize: '0.78rem', lineHeight: 1.4 }}>
                Run Static Structure Scans or Map Dependency Routes to explore the code context.
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Box>
    );
  };

  const renderActiveCard = () => {
    if (!activeComponent) return null;
    return (
      <Box sx={{ height: '100%', overflowY: 'auto', p: 3 }}>
        <InteractiveComponent
          uiComponent={activeComponent}
          onAction={handleSend}
          onApproveAction={handleApproveAction}
          onCancelAction={handleRemoveItem}
          onStartContentWorkflow={handleStartContentWorkflow}
          activeLens={activeLens}
          variant={isSoothsayerLivePlaneActive ? 'native-plane' : 'main'}
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
    );
  };

  const mainWorkbenchContent = (
    <>
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
            <WorkbenchShell
            leftRailWidth={leftRailWidth}
            rightFeedWidth={rightFeedWidth}
            isLeftRailCollapsed={isLeftRailCollapsed}
            isRightFeedCollapsed={isRightFeedCollapsed}
            onLeftResize={handleLeftResize}
            onRightResize={handleRightResize}
            leftRailContent={
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
                {isLeftRailCollapsed ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3.5, height: '100%' }}>
                    {/* 1. Gateway Indicator */}
                    <Tooltip title={`Express Gateway: ${token ? 'Connected' : 'Offline'}`} placement="right">
                      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: token ? '#22c55e' : '#ef4444',
                            boxShadow: token ? '0 0 8px #22c55e' : '0 0 8px #ef4444'
                          }}
                        />
                      </Box>
                    </Tooltip>

                    {/* 2. Connected Systems Stack */}
                    <Stack spacing={1.8} alignItems="center">
                      <Tooltip title="Postgres DB: Configured" placement="right">
                        <DnsIcon sx={{ fontSize: 16, color: '#71717a' }} />
                      </Tooltip>
                      <Tooltip title="Redis DB: Configured" placement="right">
                        <DnsIcon sx={{ fontSize: 16, color: '#71717a' }} />
                      </Tooltip>
                      <Tooltip title="DAX Control: No signal" placement="right">
                        <DnsIcon sx={{ fontSize: 16, color: '#71717a', opacity: 0.3 }} />
                      </Tooltip>
                      <Tooltip title="Local Adapter: Sandboxed" placement="right">
                        <TerminalIcon sx={{ fontSize: 16, color: '#7f5af0' }} />
                      </Tooltip>
                      <Tooltip title={`Rook Memory: ${backendHealth?.memoryBridgeReady ? 'Connected' : 'No signal'}`} placement="right">
                        <MemoryIcon sx={{ fontSize: 16, color: backendHealth?.memoryBridgeReady ? '#22c55e' : '#71717a' }} />
                      </Tooltip>
                    </Stack>

                    <Divider sx={{ width: '60%', borderColor: 'rgba(255,255,255,0.06)' }} />

                    {/* 3. Workspaces shortcut */}
                    <Tooltip title={`Workspaces (${workspacesList.length} registered)`} placement="right">
                      <IconButton onClick={() => handleSend('List workspaces')} size="small" sx={{ color: '#7f5af0', p: 0.5 }}>
                        <FolderIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>

                    {/* 4. Live Deployed Apps */}
                    <Tooltip title={`Soothsayer Live: ${soothsayerStatus.toUpperCase()}`} placement="right">
                      <IconButton onClick={() => handleSend('inspect soothsayer')} size="small" sx={{ color: soothsayerStatus === 'online' ? '#22c55e' : '#71717a', p: 0.5 }}>
                        <LaptopMacIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>

                    <Divider sx={{ width: '60%', borderColor: 'rgba(255,255,255,0.06)' }} />

                    {/* 5. Persona Lenses */}
                    <Stack spacing={1.5} alignItems="center" sx={{ mt: 'auto', pb: 2 }}>
                      {(['engineer', 'pm', 'ba', 'qa', 'exec'] as const).map(lens => (
                        <Tooltip key={lens} title={`Lens: ${lens.toUpperCase()}`} placement="right">
                          <Box
                            onClick={() => setActiveLens(lens)}
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              background: activeLens === lens ? 'rgba(127, 85, 240, 0.15)' : 'transparent',
                              border: activeLens === lens ? '1px solid rgba(127, 85, 240, 0.3)' : '1px solid transparent',
                              color: activeLens === lens ? '#b794f4' : '#71717a',
                              fontSize: '0.65rem',
                              fontWeight: 'bold',
                              transition: 'all 0.2s',
                              '&:hover': { background: 'rgba(255,255,255,0.02)' }
                            }}
                          >
                            {lens[0].toUpperCase()}
                          </Box>
                        </Tooltip>
                      ))}
                    </Stack>
                  </Box>
                ) : (
                  <>
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
                        <Box sx={{ display: 'flex', alignItems: 'center', p: 0.75, borderBottom: '1px solid rgba(255,255,255,0.03)', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <DnsIcon sx={{ fontSize: 13, color: '#71717a' }} />
                            <Typography variant="caption" sx={{ color: '#e2e8f0', fontWeight: 600 }}>Redis DB</Typography>
                          </Box>
                          <Chip label="Configured" size="small" sx={{ height: 16, fontSize: '0.55rem', background: 'rgba(255,255,255,0.03)', color: '#a1a1aa' }} />
                        </Box>
                        {/* Postgres */}
                        <Box sx={{ display: 'flex', alignItems: 'center', p: 0.75, borderBottom: '1px solid rgba(255,255,255,0.03)', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <DnsIcon sx={{ fontSize: 13, color: '#71717a' }} />
                            <Typography variant="caption" sx={{ color: '#e2e8f0', fontWeight: 600 }}>Postgres DB</Typography>
                          </Box>
                          <Chip label="Configured" size="small" sx={{ height: 16, fontSize: '0.55rem', background: 'rgba(255,255,255,0.03)', color: '#a1a1aa' }} />
                        </Box>
                        {/* DAX */}
                        <Box sx={{ display: 'flex', alignItems: 'center', p: 0.75, borderBottom: '1px solid rgba(255,255,255,0.03)', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <DnsIcon sx={{ fontSize: 13, color: '#71717a' }} />
                            <Typography variant="caption" sx={{ color: '#e2e8f0', fontWeight: 600 }}>DAX Control</Typography>
                          </Box>
                          <Chip label="No signal" size="small" sx={{ height: 16, fontSize: '0.55rem', background: 'rgba(255,255,255,0.03)', color: '#a1a1aa' }} />
                        </Box>
                        {/* Local Shell */}
                        <Box sx={{ display: 'flex', alignItems: 'center', p: 0.75, borderBottom: '1px solid rgba(255,255,255,0.03)', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TerminalIcon sx={{ fontSize: 13, color: '#7f5af0' }} />
                            <Typography variant="caption" sx={{ color: '#e2e8f0', fontWeight: 600 }}>Local Adapter</Typography>
                          </Box>
                          <Chip label="Sandboxed" size="small" sx={{ height: 16, fontSize: '0.55rem', background: 'rgba(127, 85, 240, 0.1)', color: '#b794f4' }} />
                        </Box>
                        {/* Rook Memory Bridge */}
                        <Box sx={{ display: 'flex', alignItems: 'center', p: 0.75, justifyContent: 'space-between' }}>
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
                    {/* Workspace Navigator */}
                    <Box sx={{ mb: 3 }}>
                      <WorkspaceNavigator
                        token={token}
                        activeWorkspace={activeWorkspace}
                        onSelectWorkspace={(ws) => {
                          setActiveWorkspace(ws);
                          if (ws) {
                            handleWorkbenchModeChange('native-focus');
                          }
                        }}
                        onAuditLogsClick={() => setIsAuditLogsOpen(true)}
                        onTestingCockpitClick={() => setIsTestingCockpitOpen(true)}
                      />
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
                          <LaptopMacIcon sx={{ fontSize: 14, color: soothsayerStatus === 'online' ? '#22c55e' : soothsayerStatus === 'degraded' ? '#fbbf24' : '#71717a' }} />
                          <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 600 }}>
                            Soothsayer
                          </Typography>
                        </Box>
                        <Chip 
                          label={soothsayerStatus === 'degraded' ? 'NO MANIFEST' : soothsayerStatus.toUpperCase()} 
                          size="small" 
                          sx={{ 
                            height: 16, 
                            fontSize: '0.55rem', 
                            fontWeight: 800, 
                            background: soothsayerStatus === 'online' ? 'rgba(34,197,94,0.08)' : soothsayerStatus === 'degraded' ? 'rgba(251, 191, 36, 0.08)' : 'rgba(255,255,255,0.03)', 
                            color: soothsayerStatus === 'online' ? '#22c55e' : soothsayerStatus === 'degraded' ? '#fbbf24' : '#a1a1aa' 
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
                  </>
                )}
              </Box>
            }
            rightFeedContent={
              isSoothsayerLivePlaneActive && activeComponent ? (
                <InteractiveComponent
                  uiComponent={activeComponent}
                  onAction={handleSend}
                  onApproveAction={handleApproveAction}
                  onCancelAction={handleRemoveItem}
                  onStartContentWorkflow={handleStartContentWorkflow}
                  activeLens={activeLens}
                  variant="live-plane"
                />
              ) : isRightFeedCollapsed ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 2, gap: 2, height: '100%', overflowY: 'auto' }}>
                  <IconButton
                    onClick={toggleRightFeed}
                    size="small"
                    sx={{
                      color: '#cbd5e1',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      background: 'rgba(255, 255, 255, 0.02)',
                    }}
                  >
                    <ViewSidebarIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  
                  <Divider sx={{ width: '65%', borderColor: 'rgba(255,255,255,0.06)' }} />

                  <Stack spacing={1.5} alignItems="center" sx={{ overflowY: 'auto', width: '100%', pb: 2 }}>
                    {previewFeed.map((item) => (
                      <Tooltip key={item.id} title={`${item.type.replace(/([A-Z])/g, ' $1').trim()} (${item.timestamp})`} placement="left">
                        <IconButton
                          onClick={toggleRightFeed}
                          size="small"
                          sx={{
                            color: '#b794f4',
                            background: 'rgba(127, 85, 240, 0.04)',
                            '&:hover': { background: 'rgba(127, 85, 240, 0.1)' }
                          }}
                        >
                          {item.type === 'WorkspaceList' && <FolderIcon sx={{ fontSize: 16 }} />}
                          {item.type === 'FileList' && <FolderIcon sx={{ fontSize: 16 }} />}
                          {item.type === 'CodePreview' && <CodeIcon sx={{ fontSize: 16 }} />}
                          {item.type === 'SearchResults' && <SearchIcon sx={{ fontSize: 16 }} />}
                          {item.type === 'WorkflowsList' && <FolderIcon sx={{ fontSize: 16 }} />}
                          {item.type === 'ProposedAction' && <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />}
                          {item.type === 'ExecutionLogs' && <TerminalIcon sx={{ fontSize: 16 }} />}
                          {item.type === 'TerminalLogs' && <TerminalIcon sx={{ fontSize: 16 }} />}
                          {item.type === 'MemoryRecall' && <MemoryIcon sx={{ fontSize: 16 }} />}
                          {item.type === 'ContentWorkflow' && <EditNoteIcon sx={{ fontSize: 16 }} />}
                          {item.type === 'SoothsayerWorkbench' && <LaptopMacIcon sx={{ fontSize: 16 }} />}
                          {item.type === 'BrowserObservation' && <LaptopMacIcon sx={{ fontSize: 16 }} />}
                        </IconButton>
                      </Tooltip>
                    ))}
                  </Stack>
                </Box>
              ) : (
                <PreviewPanel
                  previewFeed={previewFeed}
                  onClose={toggleRightFeed}
                  onAction={handleSend}
                  onRemoveItem={handleRemoveItem}
                  onClearFeed={handleClearFeed}
                  onApproveAction={handleApproveAction}
                  onContentWorkflowReview={handleContentWorkflowReview}
                  onOpenInWorkbench={(item) => {
                    setActiveComponent({ type: item.type as any, data: item.data });
                    setActiveReply(null);
                    setActiveQuery(null);
                    handleWorkbenchModeChange('native-focus');
                  }}
                  token={token}
                  loading={loading}
                />
              )
            }
          >
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
                <IconButton onClick={toggleLeftRail} size="small" sx={{ color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {isLeftRailCollapsed ? <ChevronRightIcon sx={{ fontSize: 16 }} /> : <ChevronLeftIcon sx={{ fontSize: 16 }} />}
                </IconButton>
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

                {/* Right feed toggle */}
                <IconButton onClick={toggleRightFeed} size="small" sx={{ color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <ViewSidebarIcon sx={{ fontSize: 16 }} />
                </IconButton>

                {/* Guide helper */}
                <IconButton size="small" onClick={() => setIsHelpOpen(true)} aria-label="Ask help guide" sx={{ color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <HelpOutlineIcon sx={{ fontSize: '0.95rem' }} />
                </IconButton>
              </Box>
            </Box>

            {/* Workbench Mode Select Toggle Bar */}
            <WorkbenchModeToggle
              mode={workbenchMode}
              onModeChange={handleWorkbenchModeChange}
              hasActiveWorkspace={!!activeWorkspace}
              hasFeedItems={previewFeed.length > 0}
              hasActiveComponent={!!activeComponent}
            />

            {/* Middle Main Content Dispatcher */}
            <Box sx={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {(workbenchMode === 'native-focus' || workbenchMode === 'split') && (
                <ReadOnlyStatusBanner
                  gatewayConnected={backendHealth?.status === 'ok'}
                  activeWorkspaceName={activeWorkspace?.name || null}
                  policyActive={true}
                  onOpenAuditLogs={() => setIsAuditLogsOpen(true)}
                  portalAuthValid={!!token}
                  workspaceCatalogCount={workspacesList.length}
                  localAdapterActive={backendHealth?.status === 'ok'}
                  liveAppUrlReachable={soothsayerStatus === 'online' || soothsayerStatus === 'degraded'}
                  liveAppManifestAvailable={soothsayerStatus === 'online'}
                />
              )}
              {activeWorkspace ? (
                workbenchMode === 'native-focus' ? (
                  renderActiveWorkspaceWorkbench()
                ) : workbenchMode === 'split' ? (
                  <Grid container sx={{ flexGrow: 1, minHeight: 0, height: '100%' }}>
                    <Grid item xs={6} sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.08)', minHeight: 0, overflow: 'hidden' }}>
                      {renderChatTranscript()}
                    </Grid>
                    <Grid item xs={6} sx={{ height: '100%', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      {renderActiveWorkspaceWorkbench()}
                    </Grid>
                  </Grid>
                ) : (
                  <Box sx={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {renderChatTranscript()}
                  </Box>
                )
              ) : workbenchMode === 'native-focus' ? (
                activeComponent ? renderActiveCard() : renderEmptyState()
              ) : workbenchMode === 'split' && activeComponent ? (
                <Grid container sx={{ flexGrow: 1, minHeight: 0, height: '100%' }}>
                  <Grid item xs={6} sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.08)', minHeight: 0, overflow: 'hidden' }}>
                    {renderChatTranscript()}
                  </Grid>
                  <Grid item xs={6} sx={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
                    {renderActiveCard()}
                  </Grid>
                </Grid>
              ) : (
                <Box sx={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {messages.length === 0 ? (
                    <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 3 }}>
                      {activeComponent && (
                        <Paper variant="outlined" sx={{ p: 1.5, mb: 3, background: 'rgba(127, 85, 240, 0.04)', borderColor: 'rgba(127, 85, 240, 0.25)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
                            An active UI component is loaded in the background: <strong>{activeComponent.type}</strong>
                          </Typography>
                          <Button size="small" variant="contained" onClick={() => handleWorkbenchModeChange('native-focus')} sx={{ background: '#7f5af0', textTransform: 'none', borderRadius: '6px', fontSize: '0.7rem' }}>
                            Open Canvas
                          </Button>
                        </Paper>
                      )}
                      
                      <Box sx={{ animation: 'appleSpringIn 0.3s ease' }}>
                        <Box sx={{ mb: 3 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#f4f4f5', mb: 0.5 }}>
                            Workbench Overview
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#71717a' }}>
                            Select an app connection or trigger context commands to populate workspace inspection trace cards.
                          </Typography>
                        </Box>

                        <Grid container spacing={2.5} sx={{ mb: 4 }}>
                          <Grid item xs={12} sm={4}>
                            <Paper variant="outlined" sx={{ p: 2, background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                              <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, display: 'block', mb: 1 }}>SYSTEM STATUS</Typography>
                              <Typography variant="h5" sx={{ fontWeight: 800, color: '#22c55e' }}>ONLINE</Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <Paper variant="outlined" sx={{ p: 2, background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                              <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, display: 'block', mb: 1 }}>WORKSPACES</Typography>
                              <Typography variant="h5" sx={{ fontWeight: 800, color: '#b794f4' }}>{workspacesList.length}</Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <Paper variant="outlined" sx={{ p: 2, background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                              <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, display: 'block', mb: 1 }}>ACTIVE TASKS</Typography>
                              <Typography variant="h5" sx={{ fontWeight: 800, color: '#38bdf8' }}>{previewFeed.filter(f => f.type === 'ExecutionLogs').length}</Typography>
                            </Paper>
                          </Grid>
                        </Grid>

                        <Box sx={{ mb: 4 }}>
                          <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, display: 'block', mb: 2 }}>QUICK ACTION PROMPTS</Typography>
                          <Stack spacing={1}>
                            <Paper 
                              onClick={() => handleSend('List workspaces')}
                              variant="outlined" 
                              sx={{ 
                                p: 1.5, 
                                background: 'rgba(255,255,255,0.01)', 
                                borderColor: 'rgba(255,255,255,0.05)', 
                                borderRadius: '8px', 
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                '&:hover': { background: 'rgba(127, 85, 240, 0.04)', borderColor: 'rgba(127, 85, 240, 0.2)' }
                              }}
                            >
                              <Typography variant="body2" sx={{ color: '#cbd5e1' }}>🔍 Check available workspaces and Git state</Typography>
                            </Paper>
                            <Paper 
                              onClick={() => handleSend('inspect soothsayer')}
                              variant="outlined" 
                              sx={{ 
                                p: 1.5, 
                                background: 'rgba(255,255,255,0.01)', 
                                borderColor: 'rgba(255,255,255,0.05)', 
                                borderRadius: '8px', 
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                '&:hover': { background: 'rgba(127, 85, 240, 0.04)', borderColor: 'rgba(127, 85, 240, 0.2)' }
                              }}
                            >
                              <Typography variant="body2" sx={{ color: '#cbd5e1' }}>🚀 Inspect live Soothsayer deployed app workbench</Typography>
                            </Paper>
                          </Stack>
                        </Box>
                      </Box>
                    </Box>
                  ) : (
                    renderChatTranscript()
                  )}
                </Box>
              )}
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
                  label="Explain this repo" 
                  onClick={() => handleSend('Explain this repo')} 
                  size="small" 
                  sx={{ height: 22, fontSize: '0.65rem', background: 'rgba(255,255,255,0.03)', color: '#cbd5e1', cursor: 'pointer' }} 
                />
                <Chip 
                  label="Show important files" 
                  onClick={() => handleSend('Show important files')} 
                  size="small" 
                  sx={{ height: 22, fontSize: '0.65rem', background: 'rgba(255,255,255,0.03)', color: '#cbd5e1', cursor: 'pointer' }} 
                />
                <Chip 
                  label="Find entry points" 
                  onClick={() => handleSend('Find entry points')} 
                  size="small" 
                  sx={{ height: 22, fontSize: '0.65rem', background: 'rgba(255,255,255,0.03)', color: '#cbd5e1', cursor: 'pointer' }} 
                />
                <Chip 
                  label="Find TODOs" 
                  onClick={() => handleSend('Find TODOs')} 
                  size="small" 
                  sx={{ height: 22, fontSize: '0.65rem', background: 'rgba(255,255,255,0.03)', color: '#cbd5e1', cursor: 'pointer' }} 
                />
                <Chip 
                  label="Show git status" 
                  onClick={() => handleSend('Show git status')} 
                  size="small" 
                  sx={{ height: 22, fontSize: '0.65rem', background: 'rgba(255,255,255,0.03)', color: '#cbd5e1', cursor: 'pointer' }} 
                />
                {selectedFile && (
                  <>
                    <Chip 
                      label={`Map dependencies from ${selectedFile.split('/').pop()}`} 
                      onClick={() => handleSend(`Map dependencies from ${selectedFile}`)} 
                      size="small" 
                      sx={{ height: 22, fontSize: '0.65rem', background: 'rgba(127, 85, 240, 0.06)', border: '1px solid rgba(127, 85, 240, 0.15)', color: '#b794f4', cursor: 'pointer' }} 
                    />
                    <Chip 
                      label={`Explain ${selectedFile.split('/').pop()}`} 
                      onClick={() => handleSend(`Explain ${selectedFile}`)} 
                      size="small" 
                      sx={{ height: 22, fontSize: '0.65rem', background: 'rgba(127, 85, 240, 0.06)', border: '1px solid rgba(127, 85, 240, 0.15)', color: '#b794f4', cursor: 'pointer' }} 
                    />
                  </>
                )}
                <Chip 
                  label="Why was access blocked?" 
                  onClick={() => handleSend('Why was access blocked?')} 
                  size="small" 
                  sx={{ height: 22, fontSize: '0.65rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', color: '#f87171', cursor: 'pointer' }} 
                />
              </Stack>
              <ChatInput onSend={handleSend} />
            </Box>
          </WorkbenchShell>
        </Box>
      </Box>
      {/* System Access Audit Logs Viewer Dialog */}
      <AuditLogsView
        token={token}
        open={isAuditLogsOpen}
        onClose={() => setIsAuditLogsOpen(false)}
      />

      {/* User Testing Cockpit Drawer Dialog */}
      <Dialog
        open={isTestingCockpitOpen}
        onClose={() => setIsTestingCockpitOpen(false)}
        PaperProps={{
          sx: {
            background: '#0e0f12',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            maxWidth: '520px',
            width: '100%'
          }
        }}
      >
        <Box sx={{ p: 1, position: 'relative' }}>
          <IconButton
            onClick={() => setIsTestingCockpitOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8, color: '#71717a' }}
            size="small"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
          <TestingCockpit
            gatewayConnected={backendHealth?.status === 'ok'}
            activeWorkspaceId={activeWorkspace?.id || null}
            token={token}
          />
        </Box>
      </Dialog>
      {/* Transient Alert Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity} 
          variant="filled"
          sx={{ 
            width: '100%', 
            fontSize: '0.75rem', 
            background: snackbarSeverity === 'success' ? '#7f5af0' : '#f59e0b',
            color: '#fff',
            fontFamily: 'monospace'
          }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );

  return (
    <ThemeProvider theme={codexTheme}>
      {workbenchMode === 'local-app' ? (
        <WorkbenchLayout
          leftPanelWidth={prefs.leftPanelWidth}
          onWidthChange={setLeftPanelWidth}
          renderLeft={mainWorkbenchContent}
          renderRight={
            !prefs.activeAppId ? (
              <WorkbenchEmptyState onSelectApp={handleSelectLocalApp} />
            ) : localAppStatus !== 'reachable' ? (
              <WorkbenchFailureState status={localAppStatus} onRetry={handleReloadLocalApp} onClear={handleClearLocalApp} />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <LiveWorkbenchToolbar app={localAppDef} status={localAppStatus} onReload={handleReloadLocalApp} onClose={handleClearLocalApp} />
                <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                  {localAppDef && <LiveWorkbenchSurface app={localAppDef} status={localAppStatus} />}
                </Box>
              </Box>
            )
          }
        />
      ) : (
        mainWorkbenchContent
      )}
    </ThemeProvider>
  );
};

export default App;
