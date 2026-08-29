// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Box, Paper, Typography, TextField, Button, CircularProgress, Chip, IconButton, Dialog, Stack, Tooltip, Snackbar, Alert, Menu, MenuItem } from '@mui/material';
import TranscriptTurn from './components/transcript/TranscriptTurn';
import type { TranscriptMessage } from './components/transcript/TranscriptTurn';
import { Composer } from './components/composer/Composer';
import { AttachmentPicker } from './components/composer/AttachmentPicker';
import { McpResourcePicker } from './components/composer/McpResourcePicker';
import type { AttachRequest } from './composer/contextTray';
import { PickerCoordinator } from './composer/pickerCoordinator';
import type { AttachableWorkspace, ContextKind } from './composer/contextTypes';
import type { RigResourceChoice } from './rig/types';
import type { ComposerSubmission } from './components/composer/Composer';
import { resolveIntent } from './composer/intentResolver';
import { scrollBehavior } from './theme/motion';
import { accent, elevation, ink, radius, status, surface } from './theme/cssTokens';
import { materializedContextValue, planSubmission } from './composer/submissionPlan';
import { capabilitiesFrom, executePlan } from './composer/capabilities';
import type { PlanExecutors } from './composer/capabilities';
import { describeResolution, resolveAppName } from './composer/appRegistry';
import { PreviewPanel, FeedItem } from './components/PreviewPanel';
import { countApprovalsWaiting, isRunAwaitingApproval } from './components/workstation/approvalsWaiting';
import { InteractiveComponent } from './components/InteractiveComponent';
import { WorkstationShell } from './components/workstation/WorkstationShell';
import type { CockpitSummary } from './components/workstation/CockpitStatusBar';
import { CanvasStart } from './components/workstation/CanvasStart';
import { ContextBriefPanel } from './components/workstation/ContextBriefPanel';
import { BrowserEvidenceCanvas } from './components/workbench/BrowserEvidenceCanvas';
import { PaneDivider } from './components/workstation/PaneDivider';
import {
  maxConversationWidth,
  maxNestedPaneWidth,
  usePersistentPaneWidth,
} from './components/workstation/paneSizing';
import { workstationGuidance } from './components/workstation/guidance';
import { buildContextBrief } from '../src/context/contextBrief';
import type { ProjectSnapshot, NextAction, SuggestedWorkflow } from '../src/context/contextBrief';
import type { HeadroomCapsuleView } from './components/headroom/HeadroomPanel';
import type { UiComponent } from '../shared/uiComponent';
import SearchIcon from '@mui/icons-material/Search';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SouthIcon from '@mui/icons-material/South';
import type { WorkbenchMode } from './components/workbench/WorkbenchModeToggle';
import { WorkspaceNavigator, Workspace } from './components/workbench/WorkspaceNavigator';
import { WorkspaceFileTree } from './components/workbench/WorkspaceFileTree';
import { AuditLogsView } from './components/workbench/AuditLogsView';
import { ReadOnlyStatusBanner } from './components/workbench/ReadOnlyStatusBanner';
import { WorkspaceIntelligenceCard } from './components/workbench/WorkspaceIntelligenceCard';
import { QuickActionsDeck } from './components/workbench/QuickActionsDeck';
import { FilePreviewPanel } from './components/workbench/FilePreviewPanel';
import { InspectionTracePanel } from './components/workbench/InspectionTracePanel';
import { StaticStructureCard } from './components/workbench/StaticStructureCard';
import { DependencyMapCard } from './components/workbench/DependencyMapCard';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';

import { useWorkbenchPreferences } from './hooks/useWorkbenchPreferences';
import { useModelSelection } from './hooks/useModelSelection';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { exportAsMarkdown, exportAsJson, downloadFile, copyToClipboard } from './utils/exportConversation';
import { WorkbenchEmptyState } from './components/workbench/WorkbenchEmptyState';
import { WorkbenchFailureState } from './components/workbench/WorkbenchFailureState';
import { LiveWorkbenchSurface } from './components/workbench/LiveWorkbenchSurface';
import { LiveWorkbenchToolbar } from './components/workbench/LiveWorkbenchToolbar';
import { WebPreviewSurface } from './components/workbench/WebPreviewSurface';
import { SurfaceHost } from './components/surfaces/SurfaceHost';
import { projectBrowserSurface } from './surfaces/projectSurface';
import { browserSourceState } from './surfaces/browserSource';
import type { BrowserEvidenceRecord } from './components/workbench/browserEvidenceSurfaceModel';
import {
  describeOutcome,
  failedToDisplay,
  summariseOutcome,
} from './components/workbench/webPreviewOutcome';
// Web-preview and workspace-route matching now happen inside the single
// resolver. App consumes resolved envelopes and does not classify.
import type { WebPreviewRequest } from './utils/webPreviewIntent';
import {
  type BrowserLiveFrame,
  requestBrowserLiveCommand,
  requestBrowserLiveView,
  requestBrowserOperatorStatus,
  requestWebObservation,
} from './utils/browserOperatorBridge';
import { buildBrowserEvidenceBlock, firstAttachedWebContext, shouldInspectActiveWebPreview } from './utils/browserEvidenceContext';

const RigPanel = React.lazy(async () => {
  const module = await import('./components/rig/RigPanel');
  return { default: module.RigPanel };
});

const HeadroomPanel = React.lazy(async () => {
  const module = await import('./components/headroom/HeadroomPanel');
  return { default: module.HeadroomPanel };
});


// Canonical PaneTera workstation theme.
// The canonical theme lives in src/theme/paneteraTheme.ts and is mounted once
// in main.tsx. A second createTheme here previously overrode it, so the app
// rendered the old cool palette while the contract's warm tokens sat unused.
// test/themeCanonical.test.ts prevents that from returning.

/**
 * A turn in the transcript.
 *
 * Aliased to the component's own type rather than restated, so the two cannot
 * drift. It carries no `uiComponent`: the canvas is authoritative, so a
 * returned component goes to `setActiveComponent` and renders there. Storing a
 * copy on the message made it dead data that nothing read.
 */
type Message = TranscriptMessage;

type WebPreviewInspectionState =
  | { kind: 'idle' }
  | { kind: 'requesting' }
  | { kind: 'live'; frame: BrowserLiveFrame }
  | { kind: 'evidence'; record: BrowserEvidenceRecord }
  | { kind: 'error'; detail: string };

const App: React.FC = () => {

  const [messages, setMessages] = useState<Message[]>([]);
  const [token, setToken] = useState<string>('');
  const [showTokenPrompt, setShowTokenPrompt] = useState<boolean>(false);
  const [tokenInput, setTokenInput] = useState<string>('');
  const [tokenError, setTokenError] = useState<string>('');
  const [previewFeed, setPreviewFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [headroomObjective, setHeadroomObjective] = useState<string>('');
  const [activeHeadroomCapsule, setActiveHeadroomCapsule] = useState<HeadroomCapsuleView | null>(null);
  // H3d: streaming mode preference (event vs token), persisted across sessions.
  const [tokenStream, setTokenStream] = useState<boolean>(() => {
    try { return localStorage.getItem('panetera-token-stream') === '1'; } catch { return false; }
  });
  const [rigRequestKey, setRigRequestKey] = useState(0);
  const [headroomRequestKey, setHeadroomRequestKey] = useState(0);
  const [showEvidenceCanvas, setShowEvidenceCanvas] = useState(false);
  const [modelSelectorKey, setModelSelectorKey] = useState(0);
  const [projectPickerRequestKey, setProjectPickerRequestKey] = useState(0);
  // Bumped to ask the composer to take focus (e.g. from the canvas "Describe your
  // goal" start). It moves focus only; it inserts and submits nothing.
  const [composerFocusKey, setComposerFocusKey] = useState(0);
  // Paired with the focus request: on the stacked layout the composer lives on the
  // conversation plane, so the canvas "Describe your goal" start reveals that plane
  // before the focus lands.
  const [revealConversationKey, setRevealConversationKey] = useState(0);
  const [headroomSessionId] = useState(() => {
    const existing = sessionStorage.getItem('panetera-headroom-session');
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem('panetera-headroom-session', created);
    return created;
  });

  // Active workspace state overlays
  const [activeComponent, setActiveComponent] = useState<UiComponent | null>(null);
  const [activeReply, setActiveReply] = useState<string | null>(null);
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [activeLens, setActiveLens] = useState<'engineer' | 'pm' | 'ba' | 'qa' | 'exec'>('engineer');
  const [workspacesList, setWorkspacesList] = useState<any[]>([]);
  const [workflowSuggestions, setWorkflowSuggestions] = useState<SuggestedWorkflow[]>([]);
  const [soothsayerStatus, setSoothsayerStatus] = useState<'online' | 'offline' | 'checking' | 'unconfigured' | 'degraded'>('checking');
  const [backendHealth, setBackendHealth] = useState<{ status: string; mode: string; workspaceCount: number; memoryBridgeReady: boolean } | null>(null);

  const [workbenchMode, setWorkbenchMode] = useState<WorkbenchMode>(() => {
    const stored = localStorage.getItem('panetera-workbench-mode')
      || localStorage.getItem('portal-workbench-mode');
    return (stored as WorkbenchMode) || 'native-focus';
  });

  const { prefs, setAppId } = useWorkbenchPreferences();
  const { models: modelList, activeModel, selectModel } = useModelSelection();

  // Keyboard shortcuts
  const handleCopy = React.useCallback(async () => {
    const md = exportAsMarkdown(messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })));
    const ok = await copyToClipboard(md);
    if (ok) addMessage({ role: 'assistant', content: 'Conversation copied to clipboard.' });
  }, [messages]);

  const handleExport = React.useCallback(() => {
    const chatMessages = messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadFile(exportAsMarkdown(chatMessages), `panetera-conversation-${timestamp}.md`, 'text/markdown');
    downloadFile(exportAsJson(chatMessages), `panetera-conversation-${timestamp}.json`, 'application/json');
  }, [messages]);

  useKeyboardShortcuts({
    onModelSelector: React.useCallback(() => {
      setModelSelectorKey(k => k + 1);
    }, []),
    onCopy: handleCopy,
    onExport: handleExport,
  });
  const [localAppStatus, setLocalAppStatus] = React.useState<string>('checking');
  const [localAppDef, setLocalAppDef] = React.useState<any>(null);
  const [webPreview, setWebPreview] = useState<WebPreviewRequest | null>(null);
  const [webPreviewRevision, setWebPreviewRevision] = useState(0);
  const [webPreviewInspection, setWebPreviewInspection] = useState<WebPreviewInspectionState>({ kind: 'idle' });
  const webPreviewInspectionAttempt = useRef(0);
  /**
   * Whether Browser Operator has a live session.
   *
   * Held here because the web preview needs it to decide which remedy to offer
   * when a site refuses framing: inspecting through the operator, or connecting
   * it first. Defaulting to not-connected is the safe direction, since offering
   * to connect something already connected is a small annoyance while offering
   * to inspect with something absent is another false promise.
   */
  const [browserOperatorConnected, setBrowserOperatorConnected] = useState(false);
  // The projection needs both halves of the pairing state: an unavailable
  // extension and an available-but-unpaired one are different surfaces, and
  // collapsing them would make a missing extension look like a refusal.
  const [browserExtensionAvailable, setBrowserExtensionAvailable] = useState(false);

  /**
   * Guards against announcing the same preview attempt twice.
   *
   * The surface owns the probe and reports its result up. React may deliver
   * that callback more than once for a given attempt, and a transcript that
   * says the same thing twice reads as two separate attempts.
   */
  const announcedPreview = useRef<string | null>(null);

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
  // Budgeted against the canvas, not the viewport. The explorer sits inside the
  // canvas, so a viewport-relative cap let the two limits compose: at 1280px a
  // 640px conversation plus a 614px explorer left the authoritative surface
  // 19px of usable width.
  const workspaceExplorerMax = React.useCallback(() => {
    if (typeof window === 'undefined') return 560;
    const conversation = maxConversationWidth(window.innerWidth, {
      min: 280,
      absoluteMax: 640,
      dividerWidth: 7,
    });
    const canvas = window.innerWidth - conversation - 7;
    return maxNestedPaneWidth(canvas, { min: 260, absoluteMax: 680, nestedMaxShare: 0.5 });
  }, []);
  const [workspaceExplorerWidth, setWorkspaceExplorerWidth] = usePersistentPaneWidth(
    'panetera-project-explorer-width',
    380,
    260,
    workspaceExplorerMax,
  );
  const [isAuditLogsOpen, setIsAuditLogsOpen] = useState(false);

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

  const handleWorkbenchModeChange = (nextMode: WorkbenchMode) => {
    setWorkbenchMode(nextMode);
    localStorage.setItem('panetera-workbench-mode', nextMode);
    localStorage.removeItem('portal-workbench-mode');
  };

  const isSoothsayerLivePlaneActive = Boolean(
    activeComponent?.type === 'SoothsayerWorkbench' &&
    (activeComponent.data as { embed?: { allowed?: boolean }; embedUrl?: string })?.embed?.allowed &&
    (activeComponent.data as { embed?: { allowed?: boolean }; embedUrl?: string })?.embedUrl
  );

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
    const stored = localStorage.getItem('panetera-token')
      || localStorage.getItem('portalToken')
      || '';
    if (stored) {
      localStorage.setItem('panetera-token', stored);
      localStorage.removeItem('portalToken');
      setToken(stored);
    } else {
      setShowTokenPrompt(true);
    }
  }, []);

  /**
   * Track whether Browser Operator has a live, extension-confirmed session.
   *
   * Only used to choose which remedy the web preview offers when a site refuses
   * framing. A failed lookup leaves this false, which offers "connect" rather
   * than promising an inspection that might not be possible.
   */
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const read = () => {
      requestBrowserOperatorStatus()
        .then((value) => {
          if (cancelled) return;
          setBrowserOperatorConnected(value.paired);
          setBrowserExtensionAvailable(value.extensionAvailable);
        })
        .catch(() => {
          if (cancelled) return;
          setBrowserOperatorConnected(false);
          setBrowserExtensionAvailable(false);
        });
    };
    read();
    const timer = setInterval(read, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token]);

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

  // Fetch workflow suggestions when workspaces or active workspace changes
  useEffect(() => {
    if (!token) return;
    const active = activeWorkspace;
    const params = new URLSearchParams();
    if (active?.id) params.set('projectId', active.id);
    if (active?.name) params.set('projectName', active.name);
    fetch(`/api/workflow-suggestions?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data && Array.isArray(data.suggestions)) {
          const mapped: SuggestedWorkflow[] = data.suggestions.map((s: any) => ({
            label: s.label,
            description: s.description,
            confidence: s.confidence as 1 | 2 | 3 | 4 | 5,
            source: s.source,
            action: s.action as SuggestedWorkflow['action'],
          }));
          setWorkflowSuggestions(mapped);
        }
      })
      .catch(() => {});
  }, [token, activeWorkspace, workspacesList]);

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

  // Real-time EventSource listener for file updates and execution logs.
  //
  // The stream authenticates with a single-use ticket rather than the master
  // token, which must never appear in a URL. Because the ticket is spent when
  // the stream opens, EventSource's own reconnect can never succeed -- it would
  // retry the same spent URL forever. So reconnection is handled here: on error
  // the source is closed and a fresh ticket is fetched, with backoff.
  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    let eventSource: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let backoffMs = 1000;
    const MAX_BACKOFF_MS = 30000;

    const scheduleRetry = () => {
      if (cancelled) return;
      retryTimer = setTimeout(connect, backoffMs);
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    };

    const handleMessage = (e: MessageEvent) => {
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

    async function connect() {
      if (cancelled) return;
      try {
        const resp = await fetch('/api/events/ticket', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) throw new Error(`ticket request failed (${resp.status})`);
        const { ticket } = await resp.json() as { ticket: string };
        if (cancelled) return;

        const source = new EventSource(`/api/events?ticket=${encodeURIComponent(ticket)}`);
        eventSource = source;
        source.onmessage = handleMessage;
        // A stream that opened is a working credential path; reset the backoff
        // so a later transient drop reconnects promptly.
        source.onopen = () => { backoffMs = 1000; };
        source.onerror = () => {
          source.close();
          if (eventSource === source) eventSource = null;
          scheduleRetry();
        };
      } catch {
        scheduleRetry();
      }
    }

    void connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      eventSource?.close();
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

  // Auto-scroll to bottom of chat when new messages arrive
  useEffect(() => {
    // Auto-scroll fires on every reply, so it is the most repeated motion in
    // the product. Under reduced motion it jumps rather than glides.
    messagesEndRef.current?.scrollIntoView({ behavior: scrollBehavior() });
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

  const clearWebPreviewInspection = () => {
    webPreviewInspectionAttempt.current += 1;
    if (webPreviewInspection.kind === 'live') {
      void requestBrowserLiveCommand(webPreviewInspection.frame.sessionId, 'close').catch(() => {});
    }
    setWebPreviewInspection({ kind: 'idle' });
  };

  /** Open an explicit, extension-owned real Chrome view in the canvas. */
  const inspectWebPreview = async () => {
    if (!webPreview || !browserOperatorConnected) return;
    const requested = webPreview;
    const attempt = webPreviewInspectionAttempt.current + 1;
    webPreviewInspectionAttempt.current = attempt;
    setWebPreviewInspection({ kind: 'requesting' });
    setActiveReply('Waiting for Browser Operator approval…');

    try {
      const frame = await requestBrowserLiveView(requested.url);
      if (webPreviewInspectionAttempt.current !== attempt) {
        void requestBrowserLiveCommand(frame.sessionId, 'close').catch(() => {});
        return;
      }

      setWebPreviewInspection({ kind: 'live', frame });
      addMessage({
        role: 'assistant',
        content:
          `Browser Operator opened an approval-gated real Chrome view of ${frame.url}. ` +
          'The page remains untrusted and its live pixels are now mirrored in the canvas.',
        intent: 'web_preview',
      });
      setActiveReply(`Showing the managed Chrome view of ${requested.name}.`);
    } catch (error: unknown) {
      if (webPreviewInspectionAttempt.current !== attempt) return;
      const detail = error instanceof Error ? error.message : String(error);
      setWebPreviewInspection({ kind: 'error', detail });
      addMessage({
        role: 'assistant',
        content: `I did not inspect ${requested.url}: ${detail}`,
        intent: 'needs_capability',
      });
      setActiveReply('No webpage evidence was added.');
    }
  };

  const handleAddWorkspace = async () => {
    try {
      const dirHandle = await (window as Window & { showDirectoryPicker?: () => Promise<{ name: string }> }).showDirectoryPicker!();
      const folderName = dirHandle.name;
      const response = await fetch('/api/workspaces/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: folderName, folder: folderName }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to add workspace');
      }

      fetch('/api/workspaces')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setWorkspacesList(data);
        });

      setSnackbarMessage(`Added workspace: ${folderName}`);
      setSnackbarOpen(true);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setSnackbarMessage(`Error: ${err.message}`);
      setSnackbarOpen(true);
    }
  };


  // --- Governed attachment picker -----------------------------------------
  //
  // The composer never reads the filesystem. It asks for an attachment; this
  // host opens the picker, confines selection to the registered project
  // allowlist, and resolves an AttachRequest or null.
  //
  // Every pending promise is settled: on choose, on cancel, when a second
  // request replaces the first, and on unmount. A composer left awaiting
  // forever would silently stop responding to the `+` menu.
  const [pickerKind, setPickerKind] = useState<'project' | null>(null);
  const [mcpResourcePickerOpen, setMcpResourcePickerOpen] = useState(false);
  const [mcpResources, setMcpResources] = useState<RigResourceChoice[]>([]);
  const [mcpResourcesLoading, setMcpResourcesLoading] = useState(false);
  const [mcpResourcesError, setMcpResourcesError] = useState<string | null>(null);
  const picker = useRef(new PickerCoordinator<AttachRequest>());
  const pendingPickerResult = useRef<AttachRequest | null | undefined>(undefined);

  const settlePicker = (request: AttachRequest | null) => picker.current.settle(request);

  useEffect(() => {
    const coordinator = picker.current;
    return () => coordinator.dispose();
  }, []);

  /**
   * The registered project allowlist.
   *
   * `/api/workspaces` returns no `id`, so the name is the identity. Deriving it
   * here rather than inventing one keeps the tray's workspaceId meaningful, and
   * this list is the only source a selection may come from.
   */
  const attachableProjects: AttachableWorkspace[] = React.useMemo(
    () =>
      workspacesList
        .filter((entry: any) => typeof entry?.name === 'string' && typeof entry?.path === 'string')
        .map((entry: any) => ({ id: entry.name, name: entry.name, path: entry.path })),
    [workspacesList],
  );

  const requestLocalSelection = React.useCallback(
    async (kind: 'file' | 'folder'): Promise<AttachRequest | null> => {
      const response = await fetch('/api/local-selection', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ kind, sessionId: headroomSessionId, recursive: false }),
      });
      if (!response.ok) throw new Error(`Local selection failed (${response.status})`);

      const payload = await response.json();
      if (payload?.canceled) return null;
      if (
        payload?.kind !== kind
        || typeof payload?.path !== 'string'
        || typeof payload?.label !== 'string'
        || typeof payload?.grantId !== 'string'
        || typeof payload?.selectedAt !== 'string'
        || typeof payload?.expiresAt !== 'string'
        || typeof payload?.observedMtimeMs !== 'number'
      ) {
        throw new Error('PaneTera received an invalid local selection record.');
      }

      return {
        kind,
        label: payload.label,
        locator: payload.path,
        selectionGrant: {
          id: payload.grantId,
          kind,
          selectedAt: payload.selectedAt,
          expiresAt: payload.expiresAt,
          recursive: payload.recursive === true,
          observedMtimeMs: payload.observedMtimeMs,
        },
      };
    },
    [headroomSessionId, token],
  );

  const refreshMcpResources = React.useCallback(async (): Promise<RigResourceChoice[]> => {
    if (!token) {
      setMcpResources([]);
      return [];
    }
    const response = await fetch('/api/rig/resources', { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Rig resource discovery failed (${response.status})`);
    const payload = await response.json();
    const resources = Array.isArray(payload?.resources)
      ? payload.resources.flatMap((item: any) => {
          const uri = item?.rawDeclaration?.uri;
          if (
            typeof item?.connectionId !== 'string'
            || typeof item?.connectionName !== 'string'
            || typeof item?.capabilityId !== 'string'
            || typeof uri !== 'string'
          ) return [];
          return [{
            connectionId: item.connectionId,
            connectionName: item.connectionName,
            capabilityId: item.capabilityId,
            label: typeof item.label === 'string' ? item.label : uri,
            uri,
          } satisfies RigResourceChoice];
        })
      : [];
    setMcpResources(resources);
    return resources;
  }, [token]);

  useEffect(() => {
    refreshMcpResources().catch(() => setMcpResources([]));
  }, [refreshMcpResources]);

  const requestAttachment = React.useCallback(
    (kind: ContextKind): Promise<AttachRequest | null> => {
      if (kind === 'file' || kind === 'folder') return requestLocalSelection(kind);
      if (kind === 'mcp-resource') {
        setMcpResourcesLoading(true);
        setMcpResourcesError(null);
        refreshMcpResources()
          .catch((error: Error) => setMcpResourcesError(error.message))
          .finally(() => setMcpResourcesLoading(false));
        setMcpResourcePickerOpen(true);
        return picker.current.request();
      }
      if (kind !== 'project') return Promise.resolve(null);

      // Project selection is durable and comes from PaneTera's registered
      // project catalog. It intentionally remains separate from the native
      // one-off file/folder grants above.
      setPickerKind('project');
      return picker.current.request();
    },
    [refreshMcpResources, requestLocalSelection],
  );

  const chooseMcpResource = React.useCallback(async (resource: RigResourceChoice) => {
    setMcpResourcesLoading(true);
    setMcpResourcesError(null);
    try {
      const response = await fetch('/api/rig/resources/read', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: resource.connectionId, capabilityId: resource.capabilityId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `MCP resource read failed (${response.status})`);
      if (typeof payload?.provenance?.recordId !== 'string') throw new Error('Rig returned an invalid provenance record.');
      pendingPickerResult.current = {
        kind: 'mcp-resource',
        label: resource.label,
        locator: resource.uri,
        connectionId: resource.connectionId,
        provenanceRecordId: payload.provenance.recordId,
        capturedAt: payload.provenance.createdAt,
        retrievedMaterial: JSON.stringify(payload.result),
      };
      setMcpResourcePickerOpen(false);
    } catch (error: unknown) {
      setMcpResourcesError(error instanceof Error ? error.message : String(error));
    } finally {
      setMcpResourcesLoading(false);
    }
  }, [token]);

  /**
   * Handlers for every plan this app can carry out.
   *
   * Capabilities are derived from this object rather than listed separately, so
   * a capability cannot be claimed without the function that performs it. That
   * is what previously allowed `live-app` to be declared while its handler was
   * being passed an application name where an application id was required.
   */
  const planExecutors: PlanExecutors = {
    openRig: () => setRigRequestKey((value) => value + 1),
    openHeadroom: () => setHeadroomRequestKey((value) => value + 1),
    openEvidence: () => { setShowEvidenceCanvas(true); setActiveComponent(null); },
    webOpen: (plan) => {
      clearWebPreviewInspection();
      setWebPreview({ url: plan.url, name: plan.label });
      setActiveComponent(null);
      setActiveReply(`Opening ${plan.label}…`);
      // Nothing is claimed here. The surface probes, and `handlePreviewOutcome`
      // composes the message from what it found.
      //
      // This previously asserted "I opened <url> in the canvas" the instant the
      // plan ran, before anything had been attempted, which produced a blank
      // canvas underneath a success message against hpanel.hostinger.com.
      announcedPreview.current = null;
    },
    webClose: () => {
      clearWebPreviewInspection();
      setWebPreview(null);
      addMessage({ role: 'assistant', content: 'I closed the web preview.', intent: 'web_preview' });
    },
    webReload: () => {
      clearWebPreviewInspection();
      setWebPreviewRevision(current => current + 1);
      addMessage({ role: 'assistant', content: 'I reloaded the web preview.', intent: 'web_preview' });
    },
    selectProject: (plan) => {
      // `/api/workspaces` returns no id, so the name is the identity. Mapping
      // `appId: workspace.id` produced empty strings and made every project
      // unresolvable by name.
      const resolution = resolveAppName(
        plan.target,
        attachableProjects.map((project) => ({ appId: project.name, name: project.name })),
      );
      if (resolution.kind !== 'resolved') {
        addMessage({
          role: 'assistant',
          content: describeResolution(resolution).replace(/application/g, 'project'),
          intent: 'needs_clarification',
        });
        return;
      }
      const match = workspacesList.find((workspace: any) => workspace?.name === resolution.appId);
      if (!match) return;
      setActiveWorkspace(match);
      addMessage({ role: 'assistant', content: `Switched to ${match.name}.`, intent: 'project' });
    },
    openLiveApp: async (plan) => {
      // The registry keys on appId; the composer produced whatever the person
      // typed. Resolving here, and refusing honestly when it does not resolve,
      // is what keeps a naming mistake from surfacing as an unavailable app.
      let apps: any[] = [];
      try {
        const response = await fetch('/api/workbench/apps');
        const data = await response.json();
        apps = Array.isArray(data?.apps) ? data.apps : [];
      } catch {
        addMessage({
          role: 'assistant',
          content: 'I could not reach the application registry, so nothing was opened.',
          intent: 'needs_capability',
        });
        return;
      }

      const resolution = resolveAppName(plan.target, apps);
      if (resolution.kind !== 'resolved') {
        addMessage({
          role: 'assistant',
          content: describeResolution(resolution),
          intent: 'needs_clarification',
        });
        return;
      }

      handleSelectLocalApp(resolution.appId);
      handleWorkbenchModeChange('local-app');
      addMessage({
        role: 'assistant',
        content: describeResolution(resolution),
        intent: 'live_app',
      });
    },
    // `clearContext` is deliberately absent. The composer owns the tray and
    // performs that effect itself, so declaring a no-op here would be exactly
    // the placeholder the derivation is meant to prevent. The composer
    // declares that capability for itself.
    agentRun: async (plan) => {
      setLoading(true);
      addMessage({ role: 'user', content: plan.objective });
      setActiveReply(null);

      try {
        const resp = await fetch('/api/agent/run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            objective: plan.objective,
            context: plan.context,
          }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error?.message || `Agent run failed (${resp.status})`);
        }

        const result = await resp.json();
        setActiveComponent({
          type: 'AgentRun',
          data: result,
        });
        addMessage({
          role: 'assistant',
          content: result.reply || 'Agent run completed.',
          intent: 'run',
          toolsUsed: result.events
            ?.filter((e: any) => e.type === 'tool.completed')
            .map((e: any) => ({ tool: e.data?.capability || 'unknown', status: 'success' as const })),
        });
        setActiveReply(result.reply || null);
      } catch (err: any) {
        addMessage({
          role: 'assistant',
          content: `Agent run failed: ${err.message}`,
          intent: 'needs_capability',
        });
      } finally {
        setLoading(false);
      }
    },
    chat: async (plan) => {
      setLoading(true);

      const useWorkspaceOrchestrator = plan.endpoint === 'orchestrator';
      // H3b: the standard chat path runs as a streaming governed run. The
      // endpoint returns a runId (or a gateway card); the run renders on the
      // canvas and streams its governed steps. The orchestrator path is unchanged.
      const endpoint = useWorkspaceOrchestrator ? '/api/orchestrator/chat' : '/api/chat/stream';
      // plan.message carries the attached material and references. Sending
      // `text` here instead would drop everything the user attached, which is
      // what the chips promise to include.
      const capsuleBlock = activeHeadroomCapsule
        ? `<headroom-capsule trust="user-authored" authority="none">\n${materializedContextValue(JSON.stringify({
            objective: activeHeadroomCapsule.objective,
            decisions: activeHeadroomCapsule.decisions,
            assumptions: activeHeadroomCapsule.assumptions,
            unresolvedQuestions: activeHeadroomCapsule.unresolvedQuestions,
            changedUnderstanding: activeHeadroomCapsule.changedUnderstanding,
          }))}\n</headroom-capsule>`
        : null;
      let effectiveMessage = capsuleBlock ? `${plan.message}\n\n${capsuleBlock}` : plan.message;

      // A web reference is only an address until the Browser Operator produces
      // evidence. Open the canvas immediately, then pause for explicit per-site
      // approval and attach the resulting server-sanitised extraction.
      const attachedWebContext = firstAttachedWebContext(plan.context);
      const webContext = attachedWebContext ?? (
        webPreview && shouldInspectActiveWebPreview(plan.rawInput)
          ? { kind: 'web', locator: webPreview.url, label: webPreview.name }
          : null
      );
      if (webContext) {
        clearWebPreviewInspection();
        setWebPreview({ url: webContext.locator, name: webContext.label });
        setActiveComponent(null);
        setActiveReply('Waiting for Browser Operator approval to inspect this page…');
        try {
          const { captureId } = await requestWebObservation(webContext.locator);
          const evidenceResponse = await fetch(`/api/browser/observations/${encodeURIComponent(captureId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const evidence = await evidenceResponse.json().catch(() => ({}));
          if (!evidenceResponse.ok) {
            throw new Error(evidence?.error || `Browser evidence lookup failed (${evidenceResponse.status})`);
          }
          effectiveMessage = `${effectiveMessage}\n\nThe PaneTera Browser Operator inspected the page successfully. Answer from the browser extraction below; do not claim that the page or browser extension is unavailable.\n\n${buildBrowserEvidenceBlock(evidence)}`;
          setActiveReply(`Inspected ${webContext.label}. Preparing the answer…`);
        } catch (error: unknown) {
          const reason = error instanceof Error ? error.message : String(error);
          addMessage({
            role: 'assistant',
            // "I opened X in the preview" was asserted here too, on a path
            // where the preview may never have rendered. The inspection is what
            // this branch actually knows about, so it is all it claims.
            content: `I did not inspect ${webContext.locator}: ${reason}`,
            intent: 'needs_capability',
          });
          setActiveReply('No webpage evidence was added.');
          setActiveQuery(plan.rawInput);
          setLoading(false);
          return;
        }
      }
      const requestBody = useWorkspaceOrchestrator
        ? {
            message: effectiveMessage,
            workspaceId: activeWorkspace ? activeWorkspace.id : null,
            selectedFile,
            persona: activeLens,
            captureId: activeComponent?.type === 'BrowserObservation' ? activeComponent.data.captureId : undefined,
            attachedContext: plan.context,
            modelId: activeModel?.id,
          }
        : {
            query: effectiveMessage,
            history: messages.slice(-12).map(message => ({
              role: message.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: message.content }],
            })),
            attachedContext: plan.context,
            modelId: activeModel?.id,
            tokenStream,
          };

      const apiPromise = fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      }).then(async (resp) => {
        if (resp.status === 401) {
          throw new Error('Unauthorized');
        }
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.error || `Request failed (${resp.status})`);
        }
        return data;
      });

      try {
        const data = await apiPromise;

        // H3b: a streaming run answered with a runId. Show it on the canvas,
        // where it streams the governed steps live (planning, tool use, approval),
        // then land the final reply in the transcript once it reaches a terminal
        // state. A no-tool turn simply ends as a clean reply (the A collapse).
        if (!useWorkspaceOrchestrator && data.runId) {
          // Left: one live streaming assistant turn that pulls its text from the
          // run (token deltas while active, the final reply when done). Right: the
          // run's events panel. The answer lives in exactly one place, so there is
          // no left/right duplication. The turn streams itself via the run's SSE,
          // so no polling here.
          setActiveComponent({
            type: 'AgentRun',
            data: {
              runId: data.runId, status: 'running', reply: '', events: [], provider: 'openai', model: activeModel?.id || '',
              // The run readout: what the operator was working from this turn. The
              // client knows this at send time; the card shows it as the receipt.
              readout: {
                project: activeWorkspace?.name || null,
                headroom: Boolean(activeHeadroomCapsule),
                attachments: Array.isArray(plan.context) ? plan.context.length : 0,
              },
            },
          });
          setWebPreview(null);
          setActiveQuery(plan.rawInput);
          addMessage({
            role: 'assistant',
            content: '',
            intent: 'run',
            model: activeModel?.name || activeModel?.id || undefined,
            streamingRunId: data.runId,
          });
          return;
        }

        const answer = useWorkspaceOrchestrator ? data.answer : data.reply;
        if (data.uiComponent) {
          setActiveComponent(data.uiComponent);
          setWebPreview(null);
        }

        addMessage({
          role: 'assistant',
          content: answer ?? 'I could not produce a response.',
          intent: data.intent || plan.intentFamily,
          model: activeModel?.name || activeModel?.id || undefined,
          // data.uiComponent is routed to the canvas above, not stored here.
          toolsUsed: data.toolsUsed,
          filesInspected: data.filesInspected,
          citations: data.citations,
          suggestedActions: data.suggestedActions,
          warnings: data.warnings
        });

        setActiveReply(answer ?? null);
        setActiveQuery(plan.rawInput);
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
    },
  };

  // Context supplied to the one resolver. Every entry point uses this, so a
  // suggestion chip and a typed message are classified identically.
  const composerResolverContext = {
    hasWorkspace: Boolean(activeWorkspace),
    hasSelectedFile: Boolean(selectedFile),
    hasOpenWebPreview: Boolean(webPreview),
    supportedCapabilities: capabilitiesFrom(planExecutors),
  };

  /**
   * Consume an already-resolved intent.
   *
   * This must not reclassify. The composer resolved the envelope; re-running a
   * matcher here would recreate the parallel routing the composer contract
   * exists to remove.
   */
  const handleSubmission = async (submission: ComposerSubmission) => {
    const { intent } = submission;

    addMessage({ role: 'user', content: intent.rawInput });

    // Persist the audited context view before any action leaves the workstation.
    // If this fails, proceeding would create work with no truthful record of
    // what PaneTera knew, so the submission stops rather than degrading silently.
    try {
      const response = await fetch('/api/headroom/envelopes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: headroomSessionId,
          projectId: activeWorkspace?.name ?? activeWorkspace?.id ?? null,
          projectRoot: activeWorkspace?.path ?? null,
          objective: headroomObjective.trim() || null,
          intent,
          context: submission.allContext,
          material: submission.material,
          materialized: Object.fromEntries(
            Object.entries(submission.material).map(([itemId, value]) => [itemId, materializedContextValue(value)]),
          ),
          model: null,
          // MCP tools remain manually proposed through Rig in this release;
          // none are silently offered to the conversation model.
          capabilitiesOffered: [],
          activeCapsule: activeHeadroomCapsule
            ? { capsuleId: activeHeadroomCapsule.capsuleId, snapshot: activeHeadroomCapsule }
            : null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || `Headroom persistence failed (${response.status})`);
      }
    } catch (error: unknown) {
      addMessage({
        role: 'assistant',
        content: `I did not continue because Headroom could not record this turn: ${error instanceof Error ? error.message : String(error)}`,
        intent: 'needs_capability',
      });
      return;
    }

    // The plan is the execution boundary. App never inspects readiness or
    // family itself, so a non-ready envelope cannot reach a backend by
    // omission here.
    //
    // When the deterministic resolver falls through to 'converse', the
    // model-classifier can re-route ambiguous prompts to the right surface.
    let effectiveSubmission = submission;
    if (submission.intent.family === 'converse' && submission.intent.readiness === 'ready') {
      try {
        const classifyResp = await fetch('/api/classify-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ query: submission.intent.rawInput }),
        });
        if (classifyResp.ok) {
          const { family, confidence } = await classifyResp.json();
          if (family && family !== 'converse' && confidence >= 0.7) {
            effectiveSubmission = {
              ...submission,
              intent: { ...submission.intent, family, confidence },
            };
          }
        }
      } catch {
        // Classifier unavailable — proceed with original intent
      }
    }

    const plan = planSubmission(effectiveSubmission);

    if (plan.kind === 'blocked') {
      addMessage({
        role: 'assistant',
        content: plan.reason,
        intent: plan.readiness === 'needs-approval' ? 'needs_approval' : 'needs_clarification',
      });
      return;
    }

    const outcome = await executePlan(plan, planExecutors);
    if (outcome.kind === 'unhandled') {
      addMessage({
        role: 'assistant',
        content: 'That action has no handler connected, so nothing was done.',
        intent: 'needs_capability',
      });
    }
  };

  /**
   * Text entry points other than the composer: suggestion chips, card actions,
   * "explain this file". They resolve through the same resolver rather than
   * carrying their own routing, so there is one classification path in the app.
   */
  const handleSend = (text: string) =>
    handleSubmission({
      intent: resolveIntent(text, { ...composerResolverContext, includedContextCount: 0 }),
      allContext: [],
      context: [],
      material: {},
    });

  const handleTokenSave = async () => {
    const trimmed = tokenInput.trim();
    if (trimmed) {
      setTokenError('');
      try {
        const res = await fetch('/api/health', {
          headers: { Authorization: `Bearer ${trimmed}` }
        });
        if (!res.ok) {
          setTokenError('Invalid token. Please try again.');
          return;
        }
        localStorage.setItem('panetera-token', trimmed);
        localStorage.removeItem('portalToken');
        setToken(trimmed);
        setShowTokenPrompt(false);
      } catch (e) {
        setTokenError('Failed to verify token.');
      }
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

  const handleApproveBrowserAction = async (runId: string) => {
    try {
      const resp = await fetch(`/api/agent/run/${runId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const data = await resp.json();
        addMessage({ role: 'assistant', content: `Approval failed: ${data.error?.message || 'Unknown error'}` });
      }
    } catch {
      addMessage({ role: 'assistant', content: 'Failed to communicate with server for action approval.' });
    }
  };

  const handleRejectBrowserAction = async (runId: string) => {
    try {
      const resp = await fetch(`/api/agent/run/${runId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const data = await resp.json();
        addMessage({ role: 'assistant', content: `Rejection failed: ${data.error?.message || 'Unknown error'}` });
      }
    } catch {
      addMessage({ role: 'assistant', content: 'Failed to communicate with server for action rejection.' });
    }
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
        <Box sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${surface.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <Typography variant="caption" sx={{ color: ink.primary, fontWeight: 650, fontSize: '0.8rem' }}>
            Conversation
          </Typography>
          <Chip label="Safe inspection" size="small" sx={{ height: 22, fontSize: '0.62rem', backgroundColor: surface.sunken, color: status.neutral, border: `1px solid ${surface.border}` }} />
        </Box>

        {/* Scrollable messages container */}
        <Box
          sx={{
            flexGrow: 1,
            overflowY: 'auto',
            p: 2.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
            minHeight: 0
          }}
        >
          {messages.length === 0 ? (
            // One empty state, not two near-identical ones. The heading is the
            // same question either way; only the hint changes with whether a
            // project is open, which is the part that actually differs.
            //
            // Anchored to the bottom of the transcript with `mt: auto` so it sits
            // just above the composer rather than floating in the middle of a
            // dead region. A quiet downward cue ties the guidance to the input it
            // is asking the person to use.
            <Box sx={{ mt: 'auto', textAlign: 'left', pt: 4, maxWidth: 320 }}>
              <Typography
                variant="subtitle2"
                sx={{ color: ink.primary, fontWeight: 600, mb: 0.75, fontSize: '0.9375rem' }}
              >
                No conversation yet
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: ink.secondary, display: 'block', lineHeight: 1.6, fontSize: '0.78rem' }}
              >
                {activeWorkspace
                  ? 'Ask about this project or describe the result you want below.'
                  : 'Your requests and PaneTera’s findings will stay here.'}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.25, color: ink.muted }}>
                <SouthIcon aria-hidden sx={{ fontSize: 14 }} />
                <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 600 }}>
                  Start in the composer
                </Typography>
              </Box>
            </Box>
          ) : (
            // Turns are list items, so they need a list. Only the turns belong
            // inside it: the loading indicator and the scroll sentinel are not
            // transcript entries and sit outside.
            <Box
              component="ol"
              aria-label="Conversation transcript"
              sx={{
                listStyle: 'none',
                m: 0,
                p: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 2.5,
              }}
            >
              {messages.map((msg, idx) => (
                <TranscriptTurn
                  key={idx}
                  message={msg}
                  onSelectFile={handleSelectFile}
                  onSuggestedAction={handleSend}
                  token={token}
                />
              ))}
            </Box>
          )}
          {loading && (
            <Box
              role="status"
              aria-live="polite"
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', p: 1 }}
            >
              <CircularProgress size={12} sx={{ color: accent.violet, mr: 1.5 }} />
              <Typography variant="caption" sx={{ color: ink.secondary }}>
                Inspecting and summarising
              </Typography>
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
        <Box sx={{ flexGrow: 1, minHeight: 0, height: '100%', p: 3, overflow: 'hidden', display: 'grid', gridTemplateColumns: `${workspaceExplorerWidth}px 7px minmax(0, 1fr)`, gap: 0 }}>
          {/* Left panel: FileTree navigation only */}
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, pr: 2, overflow: 'hidden' }}>
            <WorkspaceFileTree
              token={token}
              workspace={activeWorkspace}
              selectedFile={selectedFile}
              onSelectFile={handleSelectFile}
              onFilesLoaded={(files) => setWorkspaceFiles(files)}
            />
          </Box>

          <PaneDivider
            label="Resize project explorer and inspector"
            value={workspaceExplorerWidth}
            min={260}
            max={workspaceExplorerMax()}
            onChange={setWorkspaceExplorerWidth}
            onReset={() => setWorkspaceExplorerWidth(380)}
          />

          {/* Right panel: dashboard cards, actions, preview panel, citations trace */}
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2.5, minHeight: 0, overflowY: 'auto', pl: 2 }}>
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
                backgroundColor: surface.raised,
                borderColor: surface.border,
                borderRadius: `${radius.md}px`,
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
                        backgroundColor: accent.violet,
                        color: ink.onAccent,
                        '&:hover': { backgroundColor: accent.violetHover },
                        borderRadius: `${radius.sm}px`,
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
          </Box>
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
          onApproveBrowserAction={handleApproveBrowserAction}
          onRejectBrowserAction={handleRejectBrowserAction}
          onStartContentWorkflow={handleStartContentWorkflow}
          onRunArtifact={(artifact) => {
            // A run fetched a page: open it on the canvas. The web preview takes
            // canvas precedence over the run card, so the page shows and the
            // readout stays reachable once the preview is cleared.
            const url = (artifact.data as { url?: string } | undefined)?.url;
            const name = (artifact.data as { name?: string } | undefined)?.name;
            if (artifact.type === 'WebPreview' && url) {
              clearWebPreviewInspection();
              setWebPreview({ url, name: name || url });
            }
          }}
          activeLens={activeLens}
          variant={isSoothsayerLivePlaneActive ? 'native-plane' : 'main'}
          token={token}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => { setActiveComponent(null); setActiveReply(null); setActiveQuery(null); }}
            sx={{ borderColor: surface.border, color: ink.secondary, borderRadius: `${radius.sm}px` }}
          >
            Clear Active Card
          </Button>
        </Box>
      </Box>
    );
  };

  const [suggestionsAnchorEl, setSuggestionsAnchorEl] = useState<null | HTMLElement>(null);
  const handleOpenSuggestions = (event: React.MouseEvent<HTMLElement>) => setSuggestionsAnchorEl(event.currentTarget);
  const handleCloseSuggestions = () => setSuggestionsAnchorEl(null);
  const suggestionItems = [
    { label: 'Explain this repo', message: 'Explain this repo' },
    { label: 'Show important files', message: 'Show important files' },
    { label: 'Find entry points', message: 'Find entry points' },
    { label: 'Find TODOs', message: 'Find TODOs' },
    { label: 'Show git status', message: 'Show git status' },
    ...(selectedFile ? [
      { label: `Map dependencies from ${selectedFile.split('/').pop()}`, message: `Map dependencies from ${selectedFile}` },
      { label: `Explain ${selectedFile.split('/').pop()}`, message: `Explain ${selectedFile}` }
    ] : []),
    { label: 'Why was access blocked?', message: 'Why was access blocked?' }
  ];


  // A real modal, not a positioned overlay.
  //
  // The previous version was a fixed Box with a scrim: focus could tab out to
  // the blurred workstation behind it, Escape did nothing, and focus was not
  // restored on close. Dialog provides the focus trap, the Escape handler, the
  // aria wiring, and focus restoration, none of which is worth reimplementing.
  //
  // It is deliberately not dismissible by backdrop click or Escape while the
  // app is locked: there is nothing usable behind it, so closing it would only
  // strand the person on a dead surface.
  const tokenPromptNode = (
    <Dialog
      open={showTokenPrompt}
      disableEscapeKeyDown
      aria-labelledby="unlock-title"
      aria-describedby="unlock-description"
      slotProps={{
        backdrop: { sx: { backgroundColor: surface.backdrop } },
      }}
      PaperProps={{
        sx: {
          width: '90%',
          maxWidth: 420,
          p: 3.5,
          backgroundColor: surface.raised,
          border: `1px solid ${surface.border}`,
          borderRadius: `${radius.lg}px`,
          boxShadow: elevation.overlay,
        },
      }}
    >
      <Typography
        id="unlock-title"
        component="h2"
        variant="subtitle1"
        sx={{ fontWeight: 650, color: ink.primary, mb: 0.75 }}
      >
        Unlock PaneTera
      </Typography>
      <Typography
        id="unlock-description"
        variant="body2"
        sx={{ color: ink.secondary, mb: 2.5, lineHeight: 1.55 }}
      >
        Enter your local token. It stays on this machine and is never sent anywhere
        but your own PaneTera server.
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <TextField
          fullWidth
          size="small"
          type="password"
          variant="outlined"
          placeholder="Local token"
          value={tokenInput}
          autoFocus
          error={Boolean(tokenError)}
          inputProps={{ 'aria-label': 'Local token' }}
          onChange={e => setTokenInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleTokenSave();
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: `${radius.sm}px`,
              backgroundColor: surface.sunken,
              color: ink.primary,
              '& fieldset': { borderColor: surface.border },
              '&:hover fieldset': { borderColor: surface.borderStrong },
              '&.Mui-focused fieldset': { borderColor: accent.violetBorder },
            },
          }}
        />
        <Button
          variant="contained"
          onClick={handleTokenSave}
          disabled={!tokenInput.trim()}
          sx={{ borderRadius: `${radius.sm}px`, px: 2.5, whiteSpace: 'nowrap' }}
        >
          Unlock
        </Button>
      </Box>

      {tokenError && (
        <Typography role="alert" variant="body2" sx={{ color: status.danger, mt: 1.5 }}>
          {tokenError}
        </Typography>
      )}
    </Dialog>
  );


  return (
    <>
      {tokenPromptNode}

      <AttachmentPicker
        kind={pickerKind}
        projects={attachableProjects}
        onCancel={() => {
          pendingPickerResult.current = null;
          setPickerKind(null);
        }}
        onChoose={({ kind, project }) => {
          pendingPickerResult.current = {
            kind,
            label: project.name,
            locator: project.path,
            workspace: project,
          };
          setPickerKind(null);
        }}
        onExited={() => {
          const result = pendingPickerResult.current;
          if (result === undefined) return;
          pendingPickerResult.current = undefined;
          settlePicker(result);
        }}
      />
      <McpResourcePicker
        open={mcpResourcePickerOpen}
        resources={mcpResources}
        loading={mcpResourcesLoading}
        error={mcpResourcesError}
        onCancel={() => {
          pendingPickerResult.current = null;
          setMcpResourcePickerOpen(false);
        }}
        onChoose={chooseMcpResource}
        onExited={() => {
          const result = pendingPickerResult.current;
          if (result === undefined) return;
          pendingPickerResult.current = undefined;
          settlePicker(result);
        }}
      />
      {/*
        No blur, opacity or pointer-events juggling here. Dialog renders in a
        portal with its own backdrop, marks the rest of the app aria-hidden, and
        blocks interaction. The previous treatment double-dimmed against that
        backdrop and animated with a hardcoded 0.3s transition that ignored
        reduced motion.
      */}
      <Box sx={{ height: '100vh', width: '100vw' }}>
      {(() => {
          const guidance = workstationGuidance({
            gatewayConnected: backendHealth?.status === 'ok',
            loading,
            hasProject: Boolean(activeWorkspace),
            objective: headroomObjective,
          });
          const conversationNode = (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                {renderChatTranscript()}
              </Box>
              {/* Persistent composer dock. The guidance line and prompt-ideas
                  affordance share one row directly above the input, so the three
                  read as a single grouped control rather than a stack of loose
                  fragments. The dock sits on the deepest surface so the composer's
                  own raised, violet-focus input reads as the primary target. */}
              <Box
                sx={{
                  px: 2,
                  pt: 1.5,
                  pb: 2,
                  borderTop: `1px solid ${surface.border}`,
                  backgroundColor: surface.base,
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ mb: 1, alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Typography
                    role={guidance.kind === 'attention' ? 'alert' : 'status'}
                    variant="caption"
                    sx={{
                      minWidth: 0,
                      color: guidance.kind === 'attention' ? status.danger : ink.secondary,
                    }}
                  >
                    <Box component="span" sx={{ color: ink.primary, fontWeight: 600, textTransform: 'capitalize' }}>
                      {guidance.kind}
                    </Box>
                    {' · '}{guidance.text}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => setTokenStream((v) => { const next = !v; try { localStorage.setItem('panetera-token-stream', next ? '1' : '0'); } catch { /* ignore */ } return next; })}
                    aria-label={`Streaming mode: ${tokenStream ? 'token' : 'event'}. Click to toggle.`}
                    sx={{ flexShrink: 0, minHeight: 30, px: 1.1, textTransform: 'none', borderRadius: `${radius.sm}px`, fontSize: '0.72rem', color: tokenStream ? accent.violet : ink.secondary, border: `1px solid ${tokenStream ? accent.violet : surface.border}`, '&:hover': { backgroundColor: surface.sunken } }}
                  >
                    {tokenStream ? 'Token stream' : 'Event stream'}
                  </Button>
                  <Button
                    size="small"
                    startIcon={<AutoAwesomeIcon sx={{ fontSize: '14px !important' }} />}
                    onClick={handleOpenSuggestions}
                    aria-label="Open prompt ideas"
                    aria-haspopup="true"
                    aria-expanded={Boolean(suggestionsAnchorEl)}
                    sx={{ flexShrink: 0, minHeight: 30, px: 1.1, textTransform: 'none', borderRadius: `${radius.sm}px`, color: ink.secondary, fontSize: '0.72rem', '&:hover': { color: ink.primary, backgroundColor: surface.sunken }, '&:focus-visible': { outline: `2px solid ${accent.violet}`, outlineOffset: 2 } }}
                  >
                    Prompt ideas
                  </Button>
                  <Menu
                    anchorEl={suggestionsAnchorEl}
                    open={Boolean(suggestionsAnchorEl)}
                    onClose={handleCloseSuggestions}
                    PaperProps={{ sx: { mt: 0.75, minWidth: 240, backgroundColor: surface.overlay, color: ink.primary, border: `1px solid ${surface.border}`, boxShadow: elevation.overlay } }}
                  >
                    {suggestionItems.map(item => (
                      <MenuItem key={item.message} onClick={() => { handleSend(item.message); handleCloseSuggestions(); }}>
                        {item.label}
                      </MenuItem>
                    ))}
                  </Menu>
                </Stack>
                <Composer
                  onSubmit={handleSubmission}
                  resolverContext={composerResolverContext}
                  onRequestAttachment={requestAttachment}
                  focusRequestKey={composerFocusKey}
                  availability={{
                    hasProjectPicker: true,
                    hasLocalFilePicker: true,
                    hasLocalFolderPicker: true,
                    hasProjects: attachableProjects.length > 0,
                    hasWebLinks: true,
                    hasMcpResources: mcpResources.length > 0,
                  }}
                  modelOptions={modelList}
                  activeModel={activeModel}
                  onSelectModel={selectModel}
                  modelSelectorOpen={modelSelectorKey}
                />
              </Box>
            </Box>
          );


          const governanceSummary = {
            gatewayConnected: backendHealth?.status === 'ok',
            activeWorkspaceName: activeWorkspace?.name || null,
            policyActive: true,
            portalAuthValid: !!token,
            workspaceCatalogCount: workspacesList.length,
            localAdapterActive: backendHealth?.status === 'ok',
            liveAppUrlReachable: localAppStatus === 'reachable',
            liveAppManifestAvailable: !!localAppDef,
            currentObjective: headroomObjective.trim() || null,
          };

          // Cockpit strip summary. Every field is sourced from state the shell can
          // already see; nothing here is inferred or scaled against an invented
          // ceiling. Approvals are counted across both places a pending decision
          // can sit -- the feed and the active run -- rather than reported as a
          // status flag. Headroom reports its open questions, a defined quantity.
          const cockpitAwaitingApproval = isRunAwaitingApproval(activeComponent);
          const cockpitSummary: CockpitSummary = {
            sessionLabel: `Session ${headroomSessionId.slice(0, 6)}`,
            runStatus: cockpitAwaitingApproval
              ? 'awaiting-approval'
              : loading ? 'working' : 'idle',
            approvalsWaiting: countApprovalsWaiting(previewFeed, activeComponent),
            headroomActive: Boolean(activeHeadroomCapsule),
            headroomOpenQuestions: activeHeadroomCapsule?.unresolvedQuestions?.length ?? 0,
          };

          const contextBrief = buildContextBrief({
            projects: workspacesList.map((w) => ({
              id: w.id,
              name: w.name,
              lastTouchedAt: undefined,
              reachable: true,
              activeRuns: 0,
              attention: [],
              trackedBecause: w.id === activeWorkspace?.id ? 'pinned' : undefined,
            })),
            activeProjectId: activeWorkspace?.id ?? null,
            objective: headroomObjective.trim() || null,
            now: new Date(),
          });
          // Merge server-provided AI suggestions into the brief
          if (workflowSuggestions.length > 0) {
            contextBrief.suggestions = { items: workflowSuggestions, total: workflowSuggestions.length };
          }

          const handleBriefAction = (action: NextAction) => {
            switch (action.kind) {
              case 'focus-composer':
                setRevealConversationKey((v) => v + 1);
                break;
              case 'open-project-picker':
                setProjectPickerRequestKey((v) => v + 1);
                break;
              case 'open-surface':
                if (action.surface === 'rig') setRigRequestKey((v) => v + 1);
                else if (action.surface === 'headroom') setHeadroomRequestKey((v) => v + 1);
                else if (action.surface === 'audit') setIsAuditLogsOpen(true);
                break;
              case 'submit-message':
                handleSend(action.message);
                break;
            }
          };

          const emptyCanvasNode = activeWorkspace ? (
            <ContextBriefPanel brief={contextBrief} onAction={handleBriefAction} />
          ) : (
            <CanvasStart
              onChooseProject={() => setProjectPickerRequestKey((value) => value + 1)}
              onConnectCapability={() => setRigRequestKey((value) => value + 1)}
              onDescribeGoal={() => setRevealConversationKey((value) => value + 1)}
            />
          );

          // The browser branch, migrated to an explicit surface projection.
          //
          // This is the first of the canvas chain to move. App state is adapted
          // to the projection's input, projected into a descriptor, and hosted:
          // identity, presence and the header's actions now all derive from one
          // place instead of being restated by each surface's own chrome.
          //
          // WebPreviewSurface keeps its body and its probe. Only the header
          // moved, which is what keeps this step small enough to verify -- the
          // remaining branches stay exactly as they were until each is moved.
          const browserDescriptor = webPreview
            ? projectBrowserSurface(
                browserSourceState({
                  request: webPreview,
                  inspection: webPreviewInspection,
                  pairing: {
                    paired: browserOperatorConnected,
                    extensionAvailable: browserExtensionAvailable,
                  },
                }),
              )
            : null;

          const closeWebPreview = () => {
            clearWebPreviewInspection();
            setWebPreview(null);
          };

          const canvasNode = webPreview && browserDescriptor ? (
            <SurfaceHost
              descriptor={browserDescriptor}
              onClose={closeWebPreview}
              onAction={(action) => {
                // Both browser header actions are 'observe': they read the page
                // without changing it, so neither enters the governed path. A
                // 'propose' action would be routed to the approval flow instead
                // of handled here, and the header marks it as such before it is
                // clicked.
                if (action.id === 'snapshot') setWebPreviewRevision((value) => value + 1);
                if (action.id === 'inspect') inspectWebPreview();
              }}
            >
            <WebPreviewSurface
              chrome="hosted"
              key={`${webPreview.url}:${webPreviewRevision}`}
              name={webPreview.name}
              url={webPreview.url}
              onClose={closeWebPreview}
              operator={browserOperatorConnected ? 'connected' : 'not-connected'}
              onConnectOperator={() => setRigRequestKey((value) => value + 1)}
              onInspectWithOperator={inspectWebPreview}
              inspection={webPreviewInspection}
              onClearEvidence={clearWebPreviewInspection}
              onOutcome={(outcome) => {
                // One announcement per attempt, composed from what the probe
                // established rather than from the request.
                const attempt = `${webPreview.url}:${webPreviewRevision}`;
                if (announcedPreview.current === attempt) return;
                announcedPreview.current = attempt;

                addMessage({
                  role: 'assistant',
                  content: describeOutcome(outcome, {
                    url: webPreview.url,
                    siteName: webPreview.name,
                    operator: browserOperatorConnected ? 'connected' : 'not-connected',
                  }),
                  // Any failure to display, not only a header refusal. An
                  // unreachable address previously produced a transcript line
                  // saying PaneTera could not open the page beside a status
                  // line saying the site was in the canvas.
                  intent: failedToDisplay(outcome) ? 'needs_capability' : 'web_preview',
                });
                setActiveReply(summariseOutcome(outcome, { siteName: webPreview.name }));
              }}
            />
            </SurfaceHost>
          ) : workbenchMode === 'local-app' ? (
            !prefs.activeAppId ? (
              <WorkbenchEmptyState onSelectApp={handleSelectLocalApp} onClose={() => handleWorkbenchModeChange('native-focus')} />
            ) : localAppStatus !== 'reachable' ? (
              <WorkbenchFailureState status={localAppStatus} onRetry={handleReloadLocalApp} onClear={handleClearLocalApp} onClose={() => handleWorkbenchModeChange('native-focus')} />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <LiveWorkbenchToolbar app={localAppDef} status={localAppStatus} onReload={handleReloadLocalApp} onClose={handleClearLocalApp} />
                <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                  {localAppDef && <LiveWorkbenchSurface app={localAppDef} status={localAppStatus} />}
                </Box>
              </Box>
            )
          ) : showEvidenceCanvas ? (
            <BrowserEvidenceCanvas
              onReturnToPreview={() => setShowEvidenceCanvas(false)}
            />
          ) : activeComponent ? (
            renderActiveCard()
          ) : activeWorkspace ? (
            renderActiveWorkspaceWorkbench()
          ) : (
            emptyCanvasNode
          );

          return (
              <WorkstationShell
                conversation={
                  <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {conversationNode}
                  </Box>
                }
                canvas={canvasNode}
                renderActivity={(closeActivity) => (
                  <PreviewPanel
                    previewFeed={previewFeed}
                    onClose={closeActivity}
                    onAction={handleSend}
                    onRemoveItem={handleRemoveItem}
                    onClearFeed={() => setPreviewFeed([])}
                    onApproveAction={handleApproveAction}
                    token={token}
                    loading={loading}
                  />
                )}
                renderWorkspaceSelector={(closeWorkspaceSelector) => (
                  <WorkspaceNavigator
                    token={token}
                    activeWorkspace={activeWorkspace}
                    onSelectWorkspace={(ws) => {
                      if (ws) {
                        setActiveWorkspace(ws);
                        closeWorkspaceSelector();
                      }
                    }}
                    onAuditLogsClick={() => setIsAuditLogsOpen(true)}
                  />
                )}
                renderRig={(closeRig) => (
                  <React.Suspense fallback={<Box role="status" sx={{ p: 2 }}>Loading Rig…</Box>}>
                    <RigPanel token={token} onClose={closeRig} onResourcesChanged={() => { void refreshMcpResources(); }} />
                  </React.Suspense>
                )}
                renderHeadroom={(closeHeadroom) => (
                  <React.Suspense fallback={<Box role="status" sx={{ p: 2 }}>Loading Headroom…</Box>}>
                    {/* Key on token+session so a principal or session change fully
                        remounts the panel: its load boundary starts fresh and one
                        principal's or session's cached context can never be shown or
                        disclosed as stale under another. */}
                    <HeadroomPanel
                      key={`${token}:${headroomSessionId}`}
                      token={token}
                      sessionId={headroomSessionId}
                      projectId={activeWorkspace?.name ?? activeWorkspace?.id ?? null}
                      objective={headroomObjective}
                      onObjectiveChange={setHeadroomObjective}
                      onResume={(capsule) => {
                        setActiveHeadroomCapsule(capsule);
                        setHeadroomObjective(capsule?.objective ?? '');
                      }}
                      onClose={closeHeadroom}
                    />
                  </React.Suspense>
                )}
                governanceStatus={governanceSummary}
                cockpit={cockpitSummary}
                rigRequestKey={rigRequestKey}
                headroomRequestKey={headroomRequestKey}
                projectPickerRequestKey={projectPickerRequestKey}
                revealConversationKey={revealConversationKey}
                onConversationRevealed={() => setComposerFocusKey((value) => value + 1)}
                onOpenAudit={() => setIsAuditLogsOpen(true)}
                // Everything except the empty state counts as canvas content.
                // The narrow layout uses this to signal the canvas and to avoid
                // stranding a person on an empty canvas with the composer out of
                // reach. Kept in sync with the canvasNode chain above.
                canvasHasContent={Boolean(
                  webPreview || workbenchMode === 'local-app' || activeComponent || activeWorkspace,
                )}
                onMarkupAction={handleSend}
                onMarkupAnnotate={async (text, annotation) => {
                  if (!activeHeadroomCapsule?.capsuleId || !token) return;
                  try {
                    await fetch(`/api/headroom/capsules/${activeHeadroomCapsule.capsuleId}/annotations`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ target: text, text: annotation }),
                    });
                  } catch {
                    // Annotation storage is best-effort
                  }
                }}
              />
          );
      })()}
      </Box>
      <AuditLogsView
        token={token}
        open={isAuditLogsOpen}
        onClose={() => setIsAuditLogsOpen(false)}
      />
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
          sx={{ width: '100%', fontSize: '0.75rem' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default App;
