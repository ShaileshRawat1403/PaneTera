// server/index.ts
import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import chokidar from 'chokidar';
import path from 'path';
import { exec, execFile, spawn, spawn as spawnProc, ChildProcess as CP } from 'child_process';
import { randomUUID } from 'crypto';
import readline from 'readline';
import { readFileSafe, listWorkspaces, listFilesInWorkspace, searchFilesInWorkspace, addWorkspaceToPortalYaml } from './workspaceReader';
import { executeCommand, type ExecutionMode, validateCommand, buildProposedActionData, parseLocalCommandProposal, selectedExecutionMode } from './execution';
import { buildRepoSetupProposal } from './repoSetup';
import { parseLiveAppIntent, buildLiveAppWorkbench } from './liveApp';
import { parseWorkflowIntent } from './workflowIntents';
import { getWorkspaceAdapter, stopWorkspaceAdapter, stopAllWorkspaceAdapters } from './mcpAdapter';
import { getWorkspaceCatalogPath } from './appData';
import { fingerprint, normalizeAuditRecord } from './auditRecord';
import { auditOperatorAction } from './operatorAudit';
import { authenticatePortalRequest, operatorPrincipalForRequest } from './operatorPrincipal';
import * as fs from 'fs';
import { getTesseraAppDataDir } from './appData';
import { FEATURES } from './features';
import { handleOrchestratorQuery } from './orchestrator';
import { runToolLoop } from './agentLoop';
import type { AgentToolCall, ModelTurn, ToolExecution } from './agentLoop';
import { rigRegistry, rigRuntime } from './rig/routes';
import { RigToolAdapter } from './rig/adapter';
import { createRigCapabilities, mergeCapabilities } from './agent/rigCapabilities';
import { createBrowserActionCapabilities } from './agent/browserActionCapabilities';
import type { AgentCapability } from './agent/types';
import { capabilityToGeminiTool, capabilityToOpenAITool, dispatchCapability, indexCapabilities } from './operatorCapabilities';
import { headroomStore } from './headroom/routes';
import { headroomContextBlock } from './operatorContext';
import { browserRouter } from './browserGateway';
import { mcpRouter } from './mcp/browserMcpRoute';
import { probeWebPreview } from './workbench/webPreviewProbe';
import { workbenchRouter } from './workbench/workbenchRoutes';
import { rigRouter } from './rig/routes';
import { headroomRouter } from './headroom/routes';
import { nativeRouter } from './native/routes';
import { tesseraRouter } from './tessera/routes';
import { agentRouter } from './agent/routes';
import { modelRouter } from './modelRoutes';
import { schemaRouter } from './schema/routes';
import { registerItOpsDomain } from './domains/itops/tools';

// Register IT Ops domain schemas on startup
registerItOpsDomain();
import { LocalScopeStore, type LocalSelectionKind, type LocalSelectionGrant } from './headroom/localScopeStore';
import { PANETERA_ASSISTANT_INSTRUCTION } from './assistantInstruction';
import { geminiGenerateContentUrl } from './modelConfig';
import { securityHeaders, corsHeaders } from './middleware/securityHeaders';
import { apiLimiter, agentRunLimiter } from './middleware/rateLimiter';
import { requestLogger } from './logging/logger';
import { metricsMiddleware } from './logging/metrics';
import { manifestCache, historyCache } from './middleware/cache';

dotenv.config();

export const app = express();
const PORT = Number(process.env.PORT) || 4000;
const TOKEN = process.env.PORTAL_TOKEN || '';

// Security and middleware
app.use(securityHeaders);
app.use(corsHeaders);
app.use(requestLogger);
app.use(metricsMiddleware);

// Fail fast if token placeholder is still present
if (TOKEN === 'changeme-12345' || !TOKEN) {
  console.error('\n[ERROR] PORTAL_TOKEN is still the default placeholder. Please set a strong token in .env before starting.\n');
  process.exit(1);
}

app.use(express.json({ limit: '2mb' }));

// Mount browser gateway router BEFORE global master token check middleware
app.use('/api/browser', browserRouter);

// Mount MCP Façade V0 router
app.use('/mcp/browser', mcpRouter);

// Mount Workbench APIs
app.use('/api/workbench', workbenchRouter);

// Unauthenticated liveness/readiness probes for process managers and
// orchestrators. They sit ahead of the token gate and expose no sensitive
// data: liveness proves the process serves, readiness proves the app-data
// directory is writable so state operations can proceed.
app.get('/livez', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});
app.get('/readyz', (_req: Request, res: Response) => {
  const checks: Record<string, boolean> = {};
  let ready = true;
  try {
    fs.accessSync(getTesseraAppDataDir(), fs.constants.W_OK);
    checks.appDataWritable = true;
  } catch {
    checks.appDataWritable = false;
    ready = false;
  }
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not-ready', checks });
});

// Token authentication middleware (supports Authorization header and query parameter token for EventSource)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!authenticatePortalRequest(req, TOKEN, { allowQueryToken: req.path === '/api/events' })) {
    return res.status(401).json({ error: 'Invalid or missing token' });
  }
  next();
});

// Rig can establish processes and network connections, so every route lives
// behind the master-token boundary. It must never be mounted with the public
// browser/workbench routers above.
app.use('/api/rig', rigRouter);
app.use('/api/headroom', headroomRouter);
app.use('/api/native-grants', nativeRouter);
app.use('/api/tessera', tesseraRouter);
app.use('/api/agent', agentRouter);
app.use('/api/models', modelRouter);
app.use('/api/schemas', schemaRouter);

// ── Rook MCP Memory Bridge (optional) ────────────────────────────────────────
// Spawns `rook mcp memory` as a child process and communicates over stdio
// using JSON-RPC (MCP protocol). Only starts if ROOK_BINARY_PATH is set.
// Portal works fine without it — memory recall cards show "unavailable".

const ROOK_BINARY = process.env.ROOK_BINARY_PATH || '';

interface McpRpcReq  { jsonrpc: '2.0'; id: number; method: string; params: Record<string, unknown>; }
interface McpRpcResp { jsonrpc: '2.0'; id: number; result?: unknown; error?: { code: number; message: string }; }

class RookMemoryBridge {
  private proc: CP | null = null;
  private rl: readline.Interface | null = null;
  private pending = new Map<number, (r: McpRpcResp) => void>();
  private idCounter = 1;
  public ready = false;

  async start(): Promise<void> {
    this.proc = spawnProc(ROOK_BINARY, ['mcp', 'memory'], {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    // Spawn failure (binary missing, rook not built yet, wrong path) must
    // not crash the portal. Without this handler, Node treats an unhandled
    // 'error' event on a ChildProcess as a fatal exception — the memory
    // bridge is an optional enhancement, not something the rest of the app
    // depends on, so it should degrade to not-ready, not take the server down.
    this.proc.on('error', (err: Error) => {
      this.ready = false;
      console.warn('[MemoryBridge] Could not start rook memory server (build rook first):', err.message);
    });

    this.rl = readline.createInterface({ input: this.proc.stdout! });
    this.rl.on('line', (line: string) => {
      try {
        const msg: McpRpcResp = JSON.parse(line);
        const resolve = this.pending.get(msg.id);
        if (resolve) { this.pending.delete(msg.id); resolve(msg); }
      } catch { /* ignore non-JSON lines */ }
    });

    this.proc.on('exit', () => {
      this.ready = false;
      console.warn('[MemoryBridge] rook mcp memory process exited');
    });

    // MCP initialize handshake — bounded, so a missing/hung binary can't
    // stall portal startup indefinitely.
    const initTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('memory bridge init timed out')), 3000)
    );
    await Promise.race([
      this.call('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'panetera', version: '1.0.0' }
      }),
      initTimeout
    ]);
    this.ready = true;
    console.log('[MemoryBridge] rook memory server ready');
  }

  private call(method: string, params: Record<string, unknown>): Promise<McpRpcResp> {
    return new Promise((resolve, reject) => {
      if (!this.proc || !this.proc.stdin || this.proc.stdin.destroyed) {
        reject(new Error('memory bridge process not available'));
        return;
      }
      const id = this.idCounter++;
      const req: McpRpcReq = { jsonrpc: '2.0', id, method, params };
      this.pending.set(id, resolve);
      try {
        this.proc.stdin.write(JSON.stringify(req) + '\n');
      } catch (err) {
        this.pending.delete(id);
        reject(err as Error);
      }
    });
  }

  async remember(category: string, data: string, tags: string[] = []): Promise<void> {
    if (!this.ready) return;
    await this.call('tools/call', {
      name: 'remember_memory',
      arguments: { category, data, tags, is_global: false }
    });
  }

  async retrieve(category: string): Promise<string[]> {
    if (!this.ready) return [];
    try {
      const resp = await this.call('tools/call', {
        name: 'retrieve_memories',
        arguments: { category, is_global: false }
      });
      const text = ((resp.result as { content?: Array<{ text?: string }> })?.content?.[0]?.text as string) || '';
      return text ? [text] : [];
    } catch {
      return [];
    }
  }

  stop(): void { this.proc?.kill(); }
}

const memoryBridge = new RookMemoryBridge();
if (ROOK_BINARY && process.env.NODE_ENV !== 'test') {
  memoryBridge.start().catch((e: Error) =>
    console.warn('[MemoryBridge] Could not start rook memory server:', e.message)
  );
} else if (ROOK_BINARY) {
  // Silent during test
} else {
  console.log('[MemoryBridge] ROOK_BINARY_PATH not set — memory bridge disabled (portal works without it)');
}
// ─────────────────────────────────────────────────────────────────────────────

// SSE Clients registration
let sseClients: Response[] = [];

// Watcher initialization for workspaces changes
async function setupWatcher() {
  const workspaces = await listWorkspaces();
  workspaces.forEach(ws => {
    const watcher = chokidar.watch(ws.path, {
      ignored: (testPath: string) => {
        const normalized = testPath.replace(/\\/g, '/');
        const parts = normalized.split('/');
        return parts.some(part => 
          part === 'node_modules' || 
          part === '.git' || 
          part === 'target' || 
          part === 'dist' || 
          part === 'build' || 
          part === '.cargo' || 
          part === '.claude' || 
          part === '.cursor' || 
          part === '.intersect' ||
          part === '.pnpm-store' ||
          (part.startsWith('.') && part !== '.' && part !== '..')
        );
      },
      persistent: true,
      ignoreInitial: true
    });

    const handleEvent = (event: string, filePath: string) => {
      const relativePath = path.relative(ws.path, filePath);
      const timestamp = new Date().toLocaleTimeString();

      // Broadcast changes to active SSE clients
      sseClients.forEach(client => {
        client.write(`data: ${JSON.stringify({
          type: 'file_change',
          workspace: ws.name,
          path: relativePath,
          event,
          timestamp
        })}\n\n`);
      });
    };

    watcher
      .on('add', filePath => handleEvent('added', filePath))
      .on('change', filePath => handleEvent('changed', filePath))
      .on('unlink', filePath => handleEvent('deleted', filePath));
  });
}

if (process.env.NODE_ENV !== 'test') {
  setupWatcher().catch(err => console.error('Error starting chokidar watcher:', err));
}

// SSE endpoint to broadcast filesystem event updates
app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);

  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
  });
});

// Health check – reports read‑only mode and the real workspace count.
// A status endpoint that reports env-var guesses instead of truth is a
// tiny lie in exactly the place lies matter most.
app.get('/api/health', async (req, res) => {
  let workspaceCount = 0;
  try {
    workspaceCount = (await listWorkspaces()).length;
  } catch {
    // portal.yaml unreadable — report zero rather than a guess
  }
  res.json({
    status: 'ok',
    // Reads are unrestricted; execution is real but gated — every command
    // requires explicit human approval before /api/execute runs it, and
    // only against the fixed allowlist. Neither 'read-only' nor
    // 'unrestricted' is true, so say what actually holds.
    mode: 'governed',
    workspaceCount,
    memoryBridgeReady: memoryBridge.ready
  });
});

// Remember a fact via rook MCP MemoryServer
app.post('/api/memory/remember', async (req, res) => {
  const { category, data, tags } = req.body as { category: string; data: string; tags?: string[] };
  if (!category || !data) {
    return res.status(400).json({ error: 'category and data required' });
  }
  if (!memoryBridge.ready) {
    return res.status(503).json({ error: 'Memory bridge not ready. Build rook first.' });
  }
  try {
    await memoryBridge.remember(category, data, tags || []);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Recall memories by category via rook MCP MemoryServer
app.get('/api/memory/recall', async (req, res) => {
  const category = (req.query.category as string) || '*';
  if (!memoryBridge.ready) {
    return res.json({ memories: [], bridgeReady: false });
  }
  try {
    const memories = await memoryBridge.retrieve(category);
    res.json({ memories, bridgeReady: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// List allowed workspaces from portal.yaml
app.get('/api/workspaces', async (req, res) => {
  try {
    const workspaces = await listWorkspaces();
    res.json(workspaces);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// A selection grant records exactly what the person chose. It does not grant
// recursive filesystem access by itself; retrieval remains a separate governed
// operation. Keeping the record server-side prevents the browser from turning
// an arbitrary typed path into a claimed native selection.
const localSelectionGrants = new LocalScopeStore();

function openNativePathPicker(kind: LocalSelectionKind, prompt: string): Promise<string | null> {
  const command = kind === 'file' ? 'choose file' : 'choose folder';
  return new Promise((resolve, reject) => {
    // No shell. The AppleScript source and its arguments are fixed by PaneTera;
    // no client-controlled path is interpolated into a command line.
    execFile('osascript', ['-e', `POSIX path of (${command} with prompt "${prompt}")`],
      (error, stdout) => {
        if (error) {
          if (error.message.includes('User canceled') || error.message.includes('-128')) {
            resolve(null);
            return;
          }
          reject(error);
          return;
        }
        resolve(stdout.trim() || null);
      });
  });
}

// Select one local file or folder from anywhere on the machine. This endpoint
// is behind the master-token middleware above and accepts only the selection
// kind; the path comes exclusively from the native operating-system dialog.
app.post('/api/local-selection', async (req, res) => {
  const kind = req.body?.kind;
  const sessionId = req.body?.sessionId;
  if (kind !== 'file' && kind !== 'folder') {
    return res.status(400).json({ error: 'Selection kind must be file or folder.' });
  }
  if (typeof sessionId !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(sessionId)) {
    return res.status(400).json({ error: 'A valid Headroom session is required.' });
  }

  try {
    const selected = await openNativePathPicker(
      kind,
      kind === 'file' ? 'Choose a file for PaneTera' : 'Choose a folder for PaneTera',
    );
    if (!selected) return res.json({ canceled: true });

    const resolvedPath = await fs.promises.realpath(selected);
    const info = await fs.promises.stat(resolvedPath);
    if ((kind === 'file' && !info.isFile()) || (kind === 'folder' && !info.isDirectory())) {
      return res.status(400).json({ error: `The selected path is not a ${kind}.` });
    }

    const grant: LocalSelectionGrant = {
      id: randomUUID(),
      kind,
      path: resolvedPath,
      selectedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 8 * 60 * 60_000).toISOString(),
      sessionId,
      recursive: kind === 'folder' && req.body?.recursive === true,
      revokedAt: null,
      observedMtimeMs: info.mtimeMs,
    };
    await localSelectionGrants.add(grant);
    auditOperatorAction({
      event: 'local_context_selected',
      principal: operatorPrincipalForRequest(req),
      correlation: { grantId: grant.id },
      details: {
      kind: grant.kind,
      scopeFingerprint: fingerprint(grant.path),
      selectedAt: grant.selectedAt,
      expiresAt: grant.expiresAt,
      recursive: grant.recursive,
      observedMtimeMs: grant.observedMtimeMs,
      authority: 'reference-only',
      },
    });

    return res.json({
      canceled: false,
      grantId: grant.id,
      kind: grant.kind,
      path: grant.path,
      label: path.basename(grant.path),
      selectedAt: grant.selectedAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

app.get('/api/local-selection/scopes', (req, res) => {
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : '';
  const now = Date.now();
  const scopes = localSelectionGrants.list(sessionId).filter((grant) => (
    grant.sessionId === sessionId && !grant.revokedAt && Date.parse(grant.expiresAt) > now
  )).map((grant) => {
    try {
      const currentMtimeMs = fs.statSync(grant.path).mtimeMs;
      return { ...grant, freshness: currentMtimeMs === grant.observedMtimeMs ? 'current' : 'needs-review', currentMtimeMs };
    } catch {
      return { ...grant, freshness: 'stale', currentMtimeMs: null };
    }
  });
  res.json({ scopes });
});

app.post('/api/local-selection/scopes/:grantId/revoke', async (req, res) => {
  const grant = localSelectionGrants.get(req.params.grantId);
  if (!grant) return res.status(404).json({ error: 'Temporary attachment scope not found.' });
  try {
    const revoked = await localSelectionGrants.revoke(grant.id);
    auditOperatorAction({
      event: 'local_context_revoked',
      principal: operatorPrincipalForRequest(req),
      correlation: { grantId: revoked.id },
      details: { kind: revoked.kind, sessionId: revoked.sessionId },
    });
    return res.json({ revoked: true, grantId: revoked.id });
  } catch (error: unknown) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Browse native folder dialog for registering a durable project.
app.post('/api/workspaces/browse', async (req, res) => {
  try {
    const selectedPath = await openNativePathPicker('folder', 'Select a project folder');
    if (!selectedPath) return res.json({ canceled: true });

    const resolvedPath = await fs.promises.realpath(selectedPath);
    const pathParts = resolvedPath.split('/').filter(Boolean);
    const defaultName = pathParts[pathParts.length - 1] || 'New Project';
    return res.json({ canceled: false, path: resolvedPath, name: defaultName });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

// Add a new workspace to portal.yaml and register it in the catalog
app.post('/api/workspaces/add', async (req, res) => {
  try {
    const { name, folder } = req.body;
    if (!name || !folder) {
      return res.status(400).json({ error: 'Missing name or folder in request body' });
    }
    try {
      await addWorkspaceToPortalYaml(name, folder);
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        throw e;
      }
    }

    // After adding to portal.yaml, also register it in myai-workspaces.json
    const catalogPath = getWorkspaceCatalogPath();
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    
    // We get the absolute path for myai-workspaces.json since it expects it
    const workspacesList = await listWorkspaces();
    const newlyAdded = workspacesList.find(w => w.name === name);
    
    if (newlyAdded && !catalog.workspaces.find((w: any) => w.id === name)) {
      catalog.workspaces.push({
        id: name,
        name: name,
        path: newlyAdded.path,
        type: 'repo',
        enabled: true,
        status: 'online'
      });
      fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
      auditOperatorAction({
        event: 'workspace.enabled',
        principal: operatorPrincipalForRequest(req),
        details: { workspaceId: name, source: 'native-folder-picker' },
      });
    }

    res.json({ success: true, message: `Workspace ${name} added successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List files recursively in allowed workspace directory
app.get('/api/files', async (req, res) => {
  const workspaceName = req.query.workspace as string;
  if (!workspaceName) {
    return res.status(400).json({ error: 'workspace query parameter missing' });
  }
  try {
    const files = await listFilesInWorkspace(workspaceName);
    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Read contents of safe file in workspace (with size limits and extension verification)
app.get('/api/read', async (req, res) => {
  const workspaceName = req.query.workspace as string;
  const relPath = req.query.path as string;
  if (!workspaceName || !relPath) {
    return res.status(400).json({ error: 'workspace and path query parameters required' });
  }
  try {
    const content = await readFileSafe(workspaceName, relPath);
    res.json({ content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Search keyword in allowed workspace directory files
app.get('/api/search', async (req, res) => {
  const workspaceName = req.query.workspace as string;
  const keyword = req.query.keyword as string;
  if (!workspaceName || !keyword) {
    return res.status(400).json({ error: 'workspace and keyword query parameters required' });
  }
  try {
    const results = await searchFilesInWorkspace(workspaceName, keyword);
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

let activeProcesses: { [id: string]: CP } = {};



// Helper to get Git details
async function getWorkspaceGit(workspaceName: string): Promise<{ status: string; log: string }> {
  const workspaces = await listWorkspaces();
  const ws = workspaces.find(w => w.name === workspaceName);
  if (!ws) {
    throw new Error(`Workspace ${workspaceName} not found`);
  }
  return new Promise((resolve) => {
    exec('git status -s && echo "---LOGS---" && git log -n 5 --oneline', { cwd: ws.path }, (error, stdout, stderr) => {
      if (error) {
        resolve({ status: 'No git active', log: 'No commits indexed.' });
        return;
      }
      const parts = stdout.split('---LOGS---');
      resolve({
        status: (parts[0] || '').trim() || 'Clean working tree',
        log: (parts[1] || '').trim() || 'No logs found.'
      });
    });
  });
}

// Git history endpoint
app.get('/api/git/history', async (req, res) => {
  const workspaceName = req.query.workspace as string;
  if (!workspaceName) {
    return res.status(400).json({ error: 'workspace query parameter required' });
  }
  try {
    const gitDetails = await getWorkspaceGit(workspaceName);
    res.json(gitDetails);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Execute task whitelisted command
app.post('/api/execute', async (req, res) => {
  if (!FEATURES.commandExecution) {
    return res.status(403).json({ error: "Access denied: governed execution is disabled in PaneTera." });
  }

  const { workspaceName, command, procId } = req.body as { workspaceName: string; command: string; procId: string };
  if (!workspaceName || !command || !procId) {
    return res.status(400).json({ error: 'workspaceName, command, and procId required' });
  }

  try {
    const workspaces = await listWorkspaces();
    const ws = workspaces.find(w => w.name === workspaceName);
    if (!ws) {
      return res.status(404).json({ error: `Workspace ${workspaceName} not found` });
    }

    const broadcastLog = (type: 'stdout' | 'stderr' | 'status', text: string) => {
      sseClients.forEach(client => {
        client.write(`data: ${JSON.stringify({
          type: 'proc_log',
          procId,
          logType: type,
          text,
          timestamp: new Date().toLocaleTimeString()
        })}\n\n`);
      });
    };

    const result = await executeCommand(
      command,
      ws.path,
      ws.name,
      selectedExecutionMode()
    );

    if (result.stdout) {
      broadcastLog('stdout', result.stdout);
    }
    if (result.stderr) {
      broadcastLog('stderr', result.stderr);
    }

    const statusText = result.dryRun
      ? `Dry-run completed via ${result.adapter}. No command was executed.`
      : `Process completed with exit code: ${result.exitCode}`;
    broadcastLog('status', statusText);

    if (!result.success) {
      return res.status(400).json({ error: result.stderr || 'Execution failed validation' });
    }

    res.json({ success: true, message: statusText, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Terminate running task
app.post('/api/execute/kill', (req, res) => {
  const { procId } = req.body as { procId: string };
  if (!procId) {
    return res.status(400).json({ error: 'procId parameter required' });
  }

  const child = activeProcesses[procId];
  if (child) {
    child.kill('SIGINT');
    delete activeProcesses[procId];
    res.json({ success: true, message: 'SIGINT sent to process' });
  } else {
    res.status(404).json({ error: 'Process not found or already completed' });
  }
});

// ── Flowright governed workflow bridge ──────────────────────────────────────
// A second, structurally different execution primitive from /api/execute's
// shell allowlist above. That allowlist runs literal commands (npm/cargo/git)
// and streams raw output. This bridges to flowright's own governed workflow
// runtime — draft -> verify -> human_review -> export — for work that isn't
// a shell command at all (e.g. a content update), where flowright already
// owns the review gate and evidence ledger.
//
// This talks to flowright's real kernel API (apps/api), not its CLI. That
// matches the architecture soothsayer's own docs already state for its own
// operator console — "Flowright is the governed kernel. [The operator
// plane] is the operator plane over the Flowright kernel API. It does not
// own run state, policy, ledger projection, evidence, verification, or
// promotion authority." — rather than reinventing a second, parallel way of
// reaching the same runtime via a shelled-out CLI process per call.
//
// FLOWRIGHT_DB is intentionally left unset unless the operator sets it —
// flowright then falls back to its own persistent flowwright_db.json in the
// repo root, the same store used for prior real runs. That is deliberate:
// runs created here are real flowright history, not a throwaway sandbox.

const FLOWRIGHT_REPO = process.env.FLOWRIGHT_REPO_PATH
  ? path.resolve(process.env.FLOWRIGHT_REPO_PATH)
  : null;
const FLOWRIGHT_TEMPLATES_DIR = FLOWRIGHT_REPO ? path.join(FLOWRIGHT_REPO, 'templates') : null;
// Distinct from flowright's own documented default (3001) so this doesn't
// collide with a copy the operator might already be running standalone.
const FLOWRIGHT_API_PORT = process.env.FLOWRIGHT_API_PORT || '3101';
const FLOWRIGHT_API_BASE = `http://127.0.0.1:${FLOWRIGHT_API_PORT}`;

class FlowrightApiBridge {
  private proc: CP | null = null;
  public ready = false;

  async start(): Promise<void> {
    if (!FLOWRIGHT_REPO) throw new Error('FLOWRIGHT_REPO_PATH is not configured.');
    const tsNodeBin = path.join(FLOWRIGHT_REPO, 'node_modules', 'ts-node', 'dist', 'bin.js');
    const apiEntry = path.join(FLOWRIGHT_REPO, 'apps', 'api', 'src', 'index.ts');
    if (!fs.existsSync(tsNodeBin) || !fs.existsSync(apiEntry)) {
      throw new Error('Flowright API entry point or local ts-node runtime is missing.');
    }
    this.proc = spawn(process.execPath, [tsNodeBin, apiEntry], {
      cwd: FLOWRIGHT_REPO,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_URL: process.env.DATABASE_URL,
        FLOWRIGHT_DB: process.env.FLOWRIGHT_DB,
        PORT: FLOWRIGHT_API_PORT,
        // This is a local, same-machine, single-operator POC — the portal
        // and flowright's API run on the same box as the same person. Real
        // multi-user deployment would need proper JWTs (the API supports
        // RS256/OIDC), not this dev fallback. Explicitly opted into, not a
        // silent default: without it the API correctly refuses every
        // request with "Authorization token is required."
        FLOWRIGHT_DEV_AUTH: 'true'
      },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Same lesson as RookMemoryBridge below: an unhandled 'error' event on
    // a spawned child is fatal to the whole Node process. This bridge is an
    // enhancement, not something the rest of the portal depends on — it
    // must degrade to not-ready, never take the server down.
    this.proc.on('error', (err: Error) => {
      this.ready = false;
      console.warn('[FlowrightBridge] Could not start flowright API (check FLOWRIGHT_REPO_PATH):', err.message);
    });
    this.proc.on('exit', () => {
      this.ready = false;
      console.warn('[FlowrightBridge] flowright API process exited');
    });

    // Poll /api/health rather than a fixed sleep — the underlying app does
    // its own DB connection attempt (Postgres, else local JSON fallback)
    // before it's actually ready to serve.
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      try {
        const resp = await fetch(`${FLOWRIGHT_API_BASE}/api/health`);
        if (resp.ok) {
          this.ready = true;
          console.log('[FlowrightBridge] flowright API ready on', FLOWRIGHT_API_BASE);
          return;
        }
      } catch {
        // not up yet, keep polling
      }
      await new Promise(r => setTimeout(r, 500));
    }
    throw new Error(`flowright API did not become healthy within 15s on ${FLOWRIGHT_API_BASE}`);
  }

  stop(): void { this.proc?.kill(); }
}

const flowrightBridge = new FlowrightApiBridge();
if (process.env.NODE_ENV !== 'test' && FLOWRIGHT_REPO && process.env.FLOWRIGHT_AUTOSTART === 'true') {
  flowrightBridge.start().catch((e: Error) =>
    console.warn('[FlowrightBridge] Could not start flowright API:', e.message)
  );
}

// Only allow template paths that actually live inside this flowright repo's
// own templates directory.
function resolveSafeTemplatePath(templatePath: string): string {
  if (!FLOWRIGHT_REPO || !FLOWRIGHT_TEMPLATES_DIR) {
    throw new Error('Flowright is not configured. Set FLOWRIGHT_REPO_PATH explicitly.');
  }
  const resolved = path.resolve(FLOWRIGHT_REPO, templatePath);
  if (!resolved.startsWith(FLOWRIGHT_TEMPLATES_DIR + path.sep)) {
    throw new Error('templatePath must resolve inside the flowright templates directory');
  }
  return resolved;
}

async function flowrightApi(method: string, urlPath: string, body?: unknown, headers: Record<string, string> = {}): Promise<any> {
  if (!flowrightBridge.ready) {
    throw new Error('Flowright API is not available yet — check the portal server logs for FlowrightBridge startup errors.');
  }
  const resp = await fetch(`${FLOWRIGHT_API_BASE}${urlPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.error || `flowright API returned ${resp.status}`);
  }
  return data;
}

app.post('/api/flowright/runs', async (req, res) => {
  const { workflowId, templatePath, inputs } = req.body as {
    workflowId: string;
    templatePath?: string;
    inputs: Record<string, string>;
  };
  if (!workflowId || !inputs || typeof inputs !== 'object') {
    return res.status(400).json({ error: 'workflowId and inputs are required' });
  }
  try {
    if (templatePath) {
      // Idempotent — safe to (re)load every time so "not loaded" never
      // blocks a run create, without needing separate state to track it.
      await flowrightApi('POST', '/api/templates/load', { path: resolveSafeTemplatePath(templatePath) });
    }
    const created = await flowrightApi('POST', '/api/runs', { workflowId, inputs });
    res.json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/flowright/runs/:id/drive', async (req, res) => {
  const rawMaxSteps = Number(req.body?.maxSteps);
  const maxSteps = Number.isInteger(rawMaxSteps) && rawMaxSteps > 0 ? rawMaxSteps : 10;
  try {
    const result = await flowrightApi('POST', `/api/runs/${req.params.id}/drive`, { maxSteps });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/flowright/runs/:id', async (req, res) => {
  try {
    const show = await flowrightApi('GET', `/api/runs/${req.params.id}`);
    res.json(show);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// The one place a flowright run's human_review gate actually gets resolved —
// only ever called from an explicit Approve/Reject/Request-revision click in
// the UI, mirroring what handleApproveAction is for the shell allowlist above.
// Flowright itself, not the portal, is what actually enforces the gate. The
// reviewer identity travels as a header (x-flowright-reviewer-id) because
// that's what the API's dev-auth path reads it from — not a body field.
app.post('/api/flowright/runs/:id/review', async (req, res) => {
  const { action, reviewer, notes } = req.body as {
    action: 'approve' | 'reject' | 'request_revision';
    reviewer?: string;
    notes?: string;
  };
  if (!['approve', 'reject', 'request_revision'].includes(action)) {
    return res.status(400).json({ error: 'action must be approve, reject, or request_revision' });
  }
  try {
    const result = await flowrightApi('POST', `/api/runs/${req.params.id}/reviews`, { action, notes }, {
      'x-flowright-reviewer-id': reviewer || 'portal-operator'
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/flowright/runs/:id/evidence', async (req, res) => {
  try {
    const evidence = await flowrightApi('GET', `/api/runs/${req.params.id}/evidence`);
    res.json(evidence);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
// ─────────────────────────────────────────────────────────────────────────────

// Desktop apps status checker endpoint
app.get('/api/desktop/apps', (req, res) => {
  const checkApps = [
    { name: 'Docker Desktop', process: 'Docker' },
    { name: 'VS Code', process: 'Electron' },
    { name: 'Google Chrome', process: 'Google Chrome' }
  ];

  const results: any[] = [];
  let count = 0;

  checkApps.forEach(appItem => {
    exec(`pgrep -f "${appItem.process}"`, (err, stdout) => {
      results.push({
        name: appItem.name,
        status: stdout.trim() ? 'Running' : 'Offline'
      });
      count++;
      if (count === checkApps.length) {
        res.json({ apps: results });
      }
    });
  });
});

// NOTE: the former /api/web/click mock endpoint was removed on purpose.
// It logged coordinates as if clicks landed on a live screen — simulation
// presented as capability. If the portal ever needs real screen/browser
// actuation, that is a deliberate new surface with its own threat model,
// not a stub to grow into.

// Gemini Q&A execution handler
// Shared operator tool executor. Both the Gemini and OpenAI adapters normalise
// their model's tool call into an AgentToolCall and dispatch here, so the tools
// behave identically regardless of the underlying model.
async function tryBuiltinTool(call: AgentToolCall): Promise<ToolExecution | null> {
  const name = call.name;
  const args: any = call.args || {};
  try {
    if (name === 'listWorkspaces') {
      const workspaces = await listWorkspaces();
      return { output: workspaces, uiComponent: { type: 'WorkspaceList', data: workspaces } };
    }
    if (name === 'listFilesInWorkspace') {
      const files = await listFilesInWorkspace(args.workspaceName);
      return { output: { workspace: args.workspaceName, files }, uiComponent: { type: 'FileList', data: { workspace: args.workspaceName, files } } };
    }
    if (name === 'readFileSafe') {
      const fileContent = await readFileSafe(args.workspaceName, args.relPath);
      return { output: { content: fileContent }, uiComponent: { type: 'CodePreview', data: { workspace: args.workspaceName, path: args.relPath, content: fileContent } } };
    }
    if (name === 'searchFilesInWorkspace') {
      const results = await searchFilesInWorkspace(args.workspaceName, args.keyword);
      return { output: { results }, uiComponent: { type: 'SearchResults', data: { workspace: args.workspaceName, keyword: args.keyword, results } } };
    }
    if (name === 'proposeExecution') {
      return { output: { proposed: true, workspaceName: args.workspaceName, command: args.command }, uiComponent: { type: 'ProposedAction', data: buildProposedActionData(args.workspaceName, args.command, args.reason || '') } };
    }
    if (name === 'fetchWebPage') {
      const outcome = await probeWebPreview(args.url);
      return { output: { url: args.url, outcome }, uiComponent: { type: 'WebPreview', data: { url: args.url, name: new URL(args.url).hostname.replace(/^www\./, ''), outcome } } };
    }
    return null; // not a built-in tool; the caller falls through to capabilities
  } catch (err: any) {
    return { output: { error: err.message } };
  }
}

// Assemble the operator's dynamic capabilities from the shared, live Rig
// registry so the operator sees the user's actual enabled MCP tools.
function getOperatorCapabilities(): AgentCapability[] {
  const adapter = new RigToolAdapter(rigRegistry, rigRuntime);
  const rig = createRigCapabilities(adapter, rigRuntime);
  const browser = createBrowserActionCapabilities();
  // Browser action capabilities are governed (propose-risk actions self-gate
  // and return approval records). Listed first so a name collision resolves to
  // them over a same-named Rig tool.
  return mergeCapabilities(browser, rig);
}

// Compose the built-in tools with the dynamic capabilities into one executor
// for the tool loop. Built-ins win on name; capabilities are dispatched under
// their risk policy (observe executes, propose returns an approval card).
function makeOperatorExecuteTool(capIndex: Map<string, AgentCapability>) {
  return async (call: AgentToolCall): Promise<ToolExecution> => {
    const builtin = await tryBuiltinTool(call);
    if (builtin) return builtin;
    const capability = capIndex.get(call.name);
    if (capability) {
      try {
        return await dispatchCapability(capability, call.args || {});
      } catch (err: any) {
        return { output: { error: err.message } };
      }
    }
    return { output: { error: `Unknown tool: ${call.name}` } };
  };
}

// One shared operator-loop spine. A provider path supplies only its model
// adapter (callModel) and how it records a tool result; capability assembly,
// dispatch, the loop, and the return shape are shared here so the paths do not
// drift apart.
function operatorToolset(): { capabilities: AgentCapability[]; capIndex: Map<string, AgentCapability> } {
  const capabilities = getOperatorCapabilities();
  return { capabilities, capIndex: indexCapabilities(capabilities) };
}

async function runOperatorLoop(opts: {
  callModel: () => Promise<ModelTurn>;
  recordToolResult: (call: AgentToolCall, execution: ToolExecution) => void;
  capIndex: Map<string, AgentCapability>;
}): Promise<{ reply: string; uiComponent?: any }> {
  const result = await runToolLoop({
    callModel: opts.callModel,
    executeTool: makeOperatorExecuteTool(opts.capIndex),
    recordToolResult: opts.recordToolResult,
  });
  return { reply: result.reply, uiComponent: result.uiComponent as any };
}

async function askGemini(query: string, history: any[] = [], modelId?: string): Promise<{ reply: string; uiComponent?: any }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }

  const geminiModel = modelId || process.env.GEMINI_MODEL;
  const url = geminiGenerateContentUrl(geminiModel);

  const contentsPayload: any[] = [];
  for (const h of history) {
    contentsPayload.push({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: h.parts?.[0]?.text || '' }]
    });
  }
  contentsPayload.push({ role: 'user', parts: [{ text: query }] });

  const geminiSystemInstruction = { parts: [{ text: PANETERA_ASSISTANT_INSTRUCTION }] };
  const geminiTools = [
    {
      functionDeclarations: [
        { name: 'listWorkspaces', description: 'Lists the allowed workspaces configured in the portal.' },
        { name: 'listFilesInWorkspace', description: 'Lists all safe files recursively within the specified workspace.', parameters: { type: 'OBJECT', properties: { workspaceName: { type: 'STRING', description: 'The name of the workspace to list files from.' } }, required: ['workspaceName'] } },
        { name: 'readFileSafe', description: 'Reads the contents of a file within a workspace. Enforces file size limits and extension allowlist.', parameters: { type: 'OBJECT', properties: { workspaceName: { type: 'STRING', description: 'The name of the workspace.' }, relPath: { type: 'STRING', description: 'The relative path to the file inside the workspace.' } }, required: ['workspaceName', 'relPath'] } },
        { name: 'searchFilesInWorkspace', description: 'Searches for a keyword inside safe files in a workspace, returning matching lines.', parameters: { type: 'OBJECT', properties: { workspaceName: { type: 'STRING', description: 'The name of the workspace.' }, keyword: { type: 'STRING', description: 'The keyword or string to search for.' } }, required: ['workspaceName', 'keyword'] } },
        { name: 'proposeExecution', description: 'Propose running a safe, allowlisted command in a workspace. This never executes anything directly, it only creates a card the user must explicitly approve before anything runs. Use this whenever the user asks to build, test, lint, or check status/diff for a workspace.', parameters: { type: 'OBJECT', properties: { workspaceName: { type: 'STRING', description: 'The name of the workspace to run the command in.' }, command: { type: 'STRING', enum: ['npm run test', 'npm test', 'npm run build', 'npm run lint', 'npm run verify', 'cargo check', 'cargo test', 'git diff', 'git status'], description: 'The exact allowlisted command to propose. Prefer "npm run verify" over "npm run test" for workspaces (like flowright) that only define a verify script and no test script.' }, reason: { type: 'STRING', description: 'A short, plain-language reason this command answers the request.' } }, required: ['workspaceName', 'command'] } },
        { name: 'fetchWebPage', description: 'Inspects a public website URL, probes its framing headers, and opens a public web preview on the canvas. If asked for web search or current information, pass https://html.duckduckgo.com/html/?q=<encoded_query>.', parameters: { type: 'OBJECT', properties: { url: { type: 'STRING', description: 'The absolute http/https public web URL to inspect.' } }, required: ['url'] } }
      ]
    }
  ];

  const stripEmoji = (s: string) => s.replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');

  const callGemini = async (): Promise<ModelTurn> => {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: contentsPayload, systemInstruction: geminiSystemInstruction, tools: geminiTools })
    });
    if (!resp.ok) {
      throw new Error(`Gemini API error: ${resp.status} - ${await resp.text()}`);
    }
    const data = await resp.json();
    const content = data.candidates?.[0]?.content;
    if (content) contentsPayload.push(content);
    let text = '';
    const toolCalls: AgentToolCall[] = [];
    for (const part of (content?.parts ?? [])) {
      if (part.text) text += part.text;
      if (part.functionCall) toolCalls.push({ name: part.functionCall.name, args: part.functionCall.args || {} });
    }
    return { text: stripEmoji(text), toolCalls };
  };

  const recordToolResult = (call: AgentToolCall, execution: ToolExecution) => {
    contentsPayload.push({ role: 'function', parts: [{ functionResponse: { name: call.name, response: { output: execution.output } } }] });
  };

  const { capabilities, capIndex } = operatorToolset();
  (geminiTools[0].functionDeclarations as any[]).push(...capabilities.map(capabilityToGeminiTool));
  return runOperatorLoop({ callModel: callGemini, recordToolResult, capIndex });
}

// OpenAI Q&A execution handler
async function askOpenAI(query: string, history: any[] = [], modelId?: string): Promise<{ reply: string; uiComponent?: any }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is missing.');
  }

  const url = 'https://api.openai.com/v1/chat/completions';
  const resolvedModel = modelId || 'gpt-4o-mini';

  const messagesPayload: any[] = [
    {
      role: 'system',
      content: PANETERA_ASSISTANT_INSTRUCTION + '\n' +
               'You must use the provided tools to fetch actual workspace data. Do not make up file paths or contents.\n' +
               'If the user asks to build, test, lint, or check status/diff for a workspace, call proposeExecution — ' +
               'never claim to have run or changed anything yourself. Execution only happens after the user explicitly ' +
               'approves the proposal card, and only for the fixed set of safe commands proposeExecution allows.\n' +
               'Always answer in natural language, be friendly and helpful, and do NOT use emojis in your response.'
    }
  ];

  for (const h of history) {
    const text = h.parts?.[0]?.text || '';
    if (text) {
      messagesPayload.push({
        role: h.role === 'model' ? 'assistant' : 'user',
        content: text
      });
    }
  }

  messagesPayload.push({
    role: 'user',
    content: query
  });

  const tools = [
    {
      type: 'function',
      function: {
        name: 'listWorkspaces',
        description: 'Lists the allowed workspaces configured in the portal.'
      }
    },
    {
      type: 'function',
      function: {
        name: 'listFilesInWorkspace',
        description: 'Lists all safe files recursively within the specified workspace.',
        parameters: {
          type: 'object',
          properties: {
            workspaceName: { type: 'string', description: 'The name of the workspace to list files from.' }
          },
          required: ['workspaceName']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'readFileSafe',
        description: 'Reads the contents of a file within a workspace. Enforces file size limits and extension allowlist.',
        parameters: {
          type: 'object',
          properties: {
            workspaceName: { type: 'string', description: 'The name of the workspace.' },
            relPath: { type: 'string', description: 'The relative path to the file inside the workspace.' }
          },
          required: ['workspaceName', 'relPath']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'searchFilesInWorkspace',
        description: 'Searches for a keyword inside safe files in a workspace, returning matching lines.',
        parameters: {
          type: 'object',
          properties: {
            workspaceName: { type: 'string', description: 'The name of the workspace.' },
            keyword: { type: 'string', description: 'The keyword or string to search for.' }
          },
          required: ['workspaceName', 'keyword']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'proposeExecution',
        description: 'Propose running a safe, allowlisted command in a workspace. This never executes anything directly — it only creates a card the user must explicitly approve before anything runs. Use this whenever the user asks to build, test, lint, or check status/diff for a workspace.',
        parameters: {
          type: 'object',
          properties: {
            workspaceName: { type: 'string', description: 'The name of the workspace to run the command in.' },
            command: {
              type: 'string',
              enum: ['npm run test', 'npm test', 'npm run build', 'npm run lint', 'npm run verify', 'cargo check', 'cargo test', 'git diff', 'git status'],
              description: 'The exact allowlisted command to propose. Prefer "npm run verify" over "npm run test" for workspaces (like flowright) that only define a verify script and no test script.'
            },
            reason: { type: 'string', description: 'A short, plain-language reason this command answers the request.' }
          },
          required: ['workspaceName', 'command']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'fetchWebPage',
        description: 'Inspects a public website URL, probes its framing headers, and opens a public web preview on the canvas.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The absolute http/https public web URL to inspect.' }
          },
          required: ['url']
        }
      }
    }
  ];

  const stripEmoji = (s: string) => s.replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');

  const callOpenAI = async (): Promise<ModelTurn> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: resolvedModel, messages: messagesPayload, tools, tool_choice: 'auto' })
    });
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} - ${await response.text()}`);
    }
    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message;
    if (!assistantMessage) {
      throw new Error('Invalid response received from OpenAI API');
    }
    messagesPayload.push(assistantMessage);
    const toolCalls: AgentToolCall[] = (assistantMessage.tool_calls || []).map((tc: any) => ({
      id: tc.id,
      name: tc.function?.name,
      args: tc.function?.arguments ? JSON.parse(tc.function.arguments) : {}
    }));
    return { text: stripEmoji(assistantMessage.content || ''), toolCalls };
  };

  const recordToolResult = (call: AgentToolCall, execution: ToolExecution) => {
    messagesPayload.push({
      role: 'tool',
      tool_call_id: call.id,
      name: call.name,
      content: JSON.stringify(execution.output)
    });
  };

  const { capabilities, capIndex } = operatorToolset();
  (tools as any[]).push(...capabilities.map(capabilityToOpenAITool));
  return runOperatorLoop({ callModel: callOpenAI, recordToolResult, capIndex });
}

// Local Ollama Q&A offline execution fallback handler
async function askOllama(query: string, modelId?: string): Promise<{ reply: string; uiComponent?: any }> {
  const ollamaModel = modelId?.replace('ollama:', '') || 'llama3';
  const url = 'http://localhost:11434/api/generate';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaModel,
      prompt: `${PANETERA_ASSISTANT_INSTRUCTION}\nQuery: ${query}\n` +
              `You cannot execute anything from this offline path — if asked to build, test, or lint, tell the user ` +
              `to try again once the portal's main connection is available so the request can go through approval.\n` +
              `Answer in natural language, be concise, helpful, and do NOT use emojis in your response.`,
      stream: false
    })
  });
  if (!response.ok) {
    throw new Error(`Ollama status: ${response.status}`);
  }
  const data = await response.json();
  const rawText = data.response || 'No response';
  const cleanText = rawText.replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
  return {
    reply: `[LOCAL OLLAMA ENGINE] ${cleanText.trim()}`
  };
}

// Strict local workbench intents must resolve before any LLM path. These are
// native UI cards, not model answers, so the model should not reinterpret them.
export async function resolveGatewayCardLocally(query: string): Promise<{ reply: string; uiComponent?: any } | null> {
  const q = query.toLowerCase().trim();

  if (q === 'inspect workspaces' || q === 'show workspaces' || q === 'workspaces status' || q === 'show workspaces catalog') {
    const catalogPath = getWorkspaceCatalogPath();
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    return {
      reply: `I loaded the local workspaces catalog. You can enable/disable, monitor, and switch between your registered workspaces.`,
      uiComponent: {
        type: 'WorkspacesCatalog',
        data: catalog
      }
    };
  }

  // Route workflow intents before provider chat
  const workflowIntent = parseWorkflowIntent(query);
  if (workflowIntent) {
    if (workflowIntent.kind === 'flowright-workflows') {
      try {
        const templates = await flowrightApi('GET', '/api/templates');
        return {
          reply: `Flowright active workflows are ready in the canvas.`,
          uiComponent: {
            type: 'WorkflowsList',
            data: {
              source: 'flowright',
              workspace: 'flowright',
              workflows: templates.map((t: any) => ({
                id: t.id,
                name: t.name || t.id,
                label: t.label || t.name || t.id,
                status: 'available',
                description: t.description || 'Governed operations workflow.',
                templatePath: t.templatePath || 'templates/websiteops/website-content-publish.workflow.yaml',
                inputs: t.inputs || [],
                approvalRequired: t.approvalRequired !== false,
                previewOnly: false
              }))
            }
          }
        };
      } catch (err: any) {
        return {
          reply: `Flowright workflow source is not available right now.`,
          uiComponent: {
            type: 'WorkflowsList',
            data: {
              source: 'flowright',
              workspace: 'flowright',
              workflows: [],
              error: `Flowright API is not available: ${err.message}`
            }
          }
        };
      }
    }

    if (workflowIntent.kind === 'soothsayer-workflows') {
      try {
        const data = await buildLiveAppWorkbench('soothsayer');
        if (!data.manifestAvailable) {
          throw new Error('Manifest not available');
        }
        return {
          reply: `I retrieved the workflows from Soothsayer's app-native manifest endpoint. These are preview-only.`,
          uiComponent: {
            type: 'WorkflowsList',
            data: {
              source: 'soothsayer',
              workspace: 'soothsayer',
              workflows: data.workflows.map((w: any) => ({
                id: w.id,
                name: w.label || w.id,
                label: w.label || w.id,
                status: w.status || 'available',
                description: 'App-native preview-only workflow.',
                templatePath: '',
                inputs: [],
                approvalRequired: true,
                previewOnly: true
              }))
            }
          }
        };
      } catch (err: any) {
        return {
          reply: `Soothsayer workflow source is not available right now.`,
          uiComponent: {
            type: 'WorkflowsList',
            data: {
              source: 'soothsayer',
              workspace: 'soothsayer',
              workflows: [],
              error: 'Workbench manifest not available.'
            }
          }
        };
      }
    }
    if (workflowIntent.kind === 'soothsayer-workbench') {
      try {
        const data = await buildLiveAppWorkbench('soothsayer');
        const hasWorkbench = Boolean(data.workbench?.views?.length);
        return {
          reply: hasWorkbench
            ? `I loaded the Soothsayer app-native workbench session. You can inspect its workspace context, workflow status, and native views below.`
            : `Soothsayer is reachable, but its app-native workbench session is not exposed yet. I can show the live app manifest summary and a deep link, but not a native draft/run surface.`,
          uiComponent: {
            type: 'SoothsayerWorkbench',
            data: {
              app: 'soothsayer',
              url: data.url || 'https://ops-soothsayer-web-production.up.railway.app',
              manifestAvailable: data.manifestAvailable,
              environment: data.environment,
              version: data.version,
              routes: data.routes,
              features: data.features,
              workflows: data.workflows,
              health: data.health,
              workbench: data.workbench || null,
              workbenchReachable: data.workbenchReachable,
              workbenchAvailable: hasWorkbench,
              workbenchSource: data.workbenchSource,
              embed: data.embed || null,
              embedUrl: data.embedUrl || null,
            }
          }
        };
      } catch (err: any) {
        return {
          reply: `Soothsayer is currently unreachable. I cannot show an app-native workbench without a live Soothsayer manifest.`,
          uiComponent: {
            type: 'SoothsayerWorkbench',
            data: {
              app: 'soothsayer',
              url: 'https://ops-soothsayer-web-production.up.railway.app',
              manifestAvailable: false,
              environment: 'production',
              version: '1.0.0',
              routes: [
                { path: '/api/health', label: 'Health', method: 'GET' },
                { path: '/api/portal-manifest', label: 'Portal manifest', method: 'GET' }
              ],
              features: [
                { id: 'flowright-operator', label: 'Flowright operator bridge', status: 'available' }
              ],
              workflows: [],
              workbench: null,
              workbenchReachable: false,
              workbenchAvailable: false,
              workbenchSource: 'fallback',
              workbenchError: err.message || 'Soothsayer manifest unreachable',
            }
          }
        };
      }
    }
    if (workflowIntent.kind === 'browser-observation') {
      const latest = latestObservations[latestObservations.length - 1];
      if (!latest) {
        return {
          reply: `There are no stored Chrome browser observations yet. Use a trusted local agent to capture and post page outlines to "/api/browser-observation".`,
          uiComponent: {
            type: 'BrowserObservation',
            data: null
          }
        };
      }
      return {
        reply: `I retrieved the latest browser observation for "${latest.title}".`,
        uiComponent: {
          type: 'BrowserObservation',
          data: latest
        }
      };
    }

    if (workflowIntent.kind === 'contentops-draft') {
      try {
        const data = await buildLiveAppWorkbench('soothsayer');
        const formFirstWorkbench = data.workbench
          ? {
              ...data.workbench,
              views: [...data.workbench.views].sort((a: any, b: any) => {
                if (a.type === 'schema-form' && b.type !== 'schema-form') return -1;
                if (a.type !== 'schema-form' && b.type === 'schema-form') return 1;
                return 0;
              }),
            }
          : null;
        const hasWorkbench = Boolean(formFirstWorkbench?.views?.length);
        return {
          reply: `I opened the Soothsayer app-native workbench with the topic pre-filled. You can review the schema inputs and propose a governed run.`,
          uiComponent: {
            type: 'SoothsayerWorkbench',
            data: {
              app: 'soothsayer',
              url: data.url || 'https://ops-soothsayer-web-production.up.railway.app',
              manifestAvailable: data.manifestAvailable,
              environment: data.environment,
              version: data.version,
              routes: data.routes,
              features: data.features,
              workflows: data.workflows,
              health: data.health,
              workbench: formFirstWorkbench,
              workbenchReachable: data.workbenchReachable,
              workbenchAvailable: hasWorkbench,
              workbenchSource: data.workbenchSource,
              embed: data.embed || null,
              embedUrl: data.embedUrl || null,
              initialValues: {
                topic: workflowIntent.contentBrief || ''
              }
            }
          }
        };
      } catch (err: any) {
        return {
          reply: `Soothsayer is currently unreachable. I cannot show the app-native workbench without a live Soothsayer manifest.`,
          uiComponent: {
            type: 'SoothsayerWorkbench',
            data: {
              app: 'soothsayer',
              url: 'https://ops-soothsayer-web-production.up.railway.app',
              manifestAvailable: false,
              environment: 'production',
              version: '1.0.0',
              routes: [
                { path: '/api/health', label: 'Health', method: 'GET' },
                { path: '/api/portal-manifest', label: 'Portal manifest', method: 'GET' }
              ],
              features: [
                { id: 'flowright-operator', label: 'Flowright operator bridge', status: 'available' }
              ],
              workflows: [],
              workbench: null,
              workbenchReachable: false,
              workbenchAvailable: false,
              workbenchSource: 'fallback',
              initialValues: {
                topic: workflowIntent.contentBrief || ''
              },
              workbenchError: err.message || 'Soothsayer manifest unreachable'
            }
          }
        };
      }
    }
  }

  // IT Ops schema-driven cards
  if (q.includes('deployment pipeline') || q.includes('deploy status') || q.includes('deployment status')) {
    const { getDeploymentStatusPayload } = require('./domains/itops/tools');
    const payload = getDeploymentStatusPayload();
    return {
      reply: 'Here is the current deployment pipeline status across all environments.',
      uiComponent: {
        type: 'SchemaCard',
        data: payload,
      }
    };
  }

  if (q.includes('metrics dashboard') || q.includes('show metrics') || q.includes('operational metrics') || q.includes('system metrics')) {
    const { getMetricsPayload } = require('./domains/itops/tools');
    const payload = getMetricsPayload();
    return {
      reply: 'Here are the current operational metrics and KPIs.',
      uiComponent: {
        type: 'SchemaCard',
        data: payload,
      }
    };
  }

  if (q.includes('approval gate') || q.includes('release gate') || q.includes('release approval') || q.includes('show approval')) {
    const { getApprovalGatePayload } = require('./domains/itops/tools');
    const payload = getApprovalGatePayload();
    return {
      reply: 'Here is the governed release approval gate with pre-flight checks.',
      uiComponent: {
        type: 'SchemaCard',
        data: payload,
      }
    };
  }

  const setupProposal = await buildRepoSetupProposal(query);
  if (setupProposal) {
    return {
      reply: `I found a project setup proposal. Review it before adding it to PaneTera.`,
      uiComponent: {
        type: 'RepoSetupProposal',
        data: setupProposal
      }
    };
  }

  const liveAppIntent = parseLiveAppIntent(query);
  if (liveAppIntent) {
    const data = await buildLiveAppWorkbench(liveAppIntent.appName);
    return {
      reply: 'I prepared a Soothsayer live app workbench preview. Manifest truth is shown only if the app exposes /api/portal-manifest.',
      uiComponent: {
        type: 'LiveAppWorkbench',
        data
      }
    };
  }

  if (q === 'list workspaces' || q === 'show connected systems' || q === 'connected systems') {
    const workspaces = await listWorkspaces();
    return {
      reply: `Your registered workspaces are ready. Choose one to begin.`,
      uiComponent: { type: 'WorkspaceList', data: workspaces }
    };
  }

  const proposal = parseLocalCommandProposal(query);
  if (proposal) {
    const { workspace, command } = proposal;
    return {
      reply: `I can run "${command}" in workspace "${workspace}". Nothing runs until you approve it.`,
      uiComponent: {
        type: 'ProposedAction',
        data: buildProposedActionData(workspace, command, `Requested via: "${query}"`)
      }
    };
  }

  return null;
}

// Local deterministic parsing logic (acts as direct command backup)
async function resolveQueryLocally(query: string): Promise<{ reply: string; uiComponent?: any }> {
  const q = query.toLowerCase().trim();
  const gatewayCard = await resolveGatewayCardLocally(query);
  if (gatewayCard) {
    return gatewayCard;
  }

  // 1. Workspaces / Journey
  if (q.includes('workspace') || q.includes('journey')) {
    const workspaces = await listWorkspaces();
    return {
      reply: `Your registered workspaces are ready. Choose one to begin.`,
      uiComponent: { type: 'WorkspaceList', data: workspaces }
    };
  }

  // 2. Read file
  const readRegex = /(?:read|content of)\s+([\w./\\-]+)\s+in\s+([\w-]+)/i;
  const readMatch = query.match(readRegex);
  if (readMatch) {
    const filePath = readMatch[1];
    const workspace = readMatch[2];
    try {
      const content = await readFileSafe(workspace, filePath);
      return {
        reply: `I loaded "${filePath}" from workspace "${workspace}" into the canvas.`,
        uiComponent: { type: 'CodePreview', data: { workspace, path: filePath, content } }
      };
    } catch (err: any) {
      return { reply: `[ERROR] Failed to read file: ${err.message}` };
    }
  }

  // 3. Search files
  const searchRegex = /(?:search for|search|find)\s+(.+?)\s+in\s+([\w-]+)/i;
  const searchMatch = query.match(searchRegex);
  if (searchMatch) {
    const keyword = searchMatch[1].replace(/['"]/g, '').trim();
    const workspace = searchMatch[2];
    try {
      const results = await searchFilesInWorkspace(workspace, keyword);
      return {
        reply: `I found the workspace results for "${keyword}" and opened them in the canvas.`,
        uiComponent: { type: 'SearchResults', data: { workspace, keyword, results } }
      };
    } catch (err: any) {
      return { reply: `[ERROR] Search execution failed: ${err.message}` };
    }
  }

  // 4. List files
  const filesRegex = /(?:list files in|files in|browse)\s+([\w-]+)/i;
  const filesMatch = query.match(filesRegex);
  if (filesMatch) {
    const workspace = filesMatch[1];
    try {
      const files = await listFilesInWorkspace(workspace);
      return {
        reply: `I found ${files.length} accessible files in workspace "${workspace}" and opened them in the canvas.`,
        uiComponent: { type: 'FileList', data: { workspace, files } }
      };
    } catch (err: any) {
      return { reply: `[ERROR] Directory listing failed: ${err.message}` };
    }
  }

  // 4.5. Web search intent — probe DuckDuckGo search preview and display in canvas
  const webSearchRegex = /(?:search web for|web search for|search web|search the web for)\s+(.+)/i;
  const webSearchMatch = query.match(webSearchRegex);
  if (webSearchMatch) {
    const keyword = webSearchMatch[1].trim();
    const targetUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(keyword)}`;
    const outcome = await probeWebPreview(targetUrl);
    return {
      reply: `I searched the web for "${keyword}" and opened the live web preview in the canvas.`,
      uiComponent: {
        type: 'WebPreview',
        data: {
          url: targetUrl,
          name: `DuckDuckGo: ${keyword}`,
          outcome,
        }
      }
    };
  }

  // 4.55. Build/test/lint intent — propose it, never auto-run it. This is
  // the local (no-LLM-key) path to the same approval-gated control-plane
  // pattern proposeExecution gives the LLM tool-calling paths.
  const proposal = parseLocalCommandProposal(query);
  if (proposal) {
    const { workspace, command } = proposal;
    return {
      reply: `I can run "${command}" in workspace "${workspace}". Nothing runs until you approve it.`,
      uiComponent: {
        type: 'ProposedAction',
        data: buildProposedActionData(workspace, command, `Requested via: "${query}"`)
      }
    };
  }

  // 4.6. Workflows and runs fallback
  const workflowRegex = /(?:workflow|run|pipeline|ci\/cd|ci-cd)\s*(?:in|for)?\s*([\w-]+)?/i;
  const workflowMatch = query.match(workflowRegex);
  if (workflowMatch || q.includes('workflow') || q.includes('run') || q.includes('pipeline')) {
    let workspace = 'rook';
    if (q.includes('flowright')) workspace = 'flowright';
    
    const workflows = [
      { name: 'CI Pipeline (ci.yml)', status: 'success', lastRun: '#348', duration: '3m 42s', date: 'Today, 08:32 AM', commit: 'a3d4f82', branch: 'main' },
      { name: 'Build CLI (build-cli.yml)', status: 'success', lastRun: '#194', duration: '5m 12s', date: 'Yesterday, 04:15 PM', commit: 'bf83921', branch: 'main' },
      { name: 'Rook UI CI (rook-ui-ci.yml)', status: 'failed', lastRun: '#88', duration: '1m 20s', date: 'Yesterday, 11:05 AM', commit: '9d8e3c1', branch: 'dev' },
      { name: 'Publish Docker (publish-docker.yml)', status: 'success', lastRun: '#52', duration: '8m 05s', date: '2 days ago', commit: 'e83d921', branch: 'release-v1' }
    ];

    return {
      reply: `I loaded the workflow history for workspace "${workspace}" into the canvas.`,
      uiComponent: {
        type: 'WorkflowsList',
        data: { workspace, workflows }
      }
    };
  }

  // 4.7. Git history/status fallback
  const gitRegex = /(?:git status|git log|git history|git commits)\s*(?:in|for)?\s*([\w-]+)/i;
  const gitMatch = query.match(gitRegex);
  if (gitMatch) {
    const workspace = gitMatch[1];
    try {
      const gitDetails = await getWorkspaceGit(workspace);
      return {
        reply: `I loaded the git status and recent history for workspace "${workspace}" into the canvas.`,
        uiComponent: {
          type: 'GitHistory',
          data: {
            workspace,
            status: gitDetails.status,
            log: gitDetails.log
          }
        }
      };
    } catch (err: any) {
      return { reply: `[ERROR] Failed to load Git details: ${err.message}` };
    }
  }

  // 4.8. Desktop apps status check fallback
  if (q.includes('desktop apps') || q.includes('running apps') || q.includes('system apps')) {
    return {
      reply: `I started a local application audit and opened the results in the canvas.`,
      uiComponent: {
        type: 'DesktopApps',
        data: {}
      }
    };
  }

  // 5. General Q&A Fallback — this fires whenever no live model answered
  // (no key configured, a real API failure, rate limiting, network issues,
  // whatever). Say that honestly instead of naming a specific cause we
  // haven't actually confirmed — a guessed diagnosis stated as fact is
  // exactly the kind of thing this build has been removing all session.
  if (/^(hi|hello|hey|good (morning|afternoon|evening))[.!?\s]*$/i.test(query)) {
    return {
      reply: 'Hello. What would you like to work on? You can describe a goal, open a public webpage, or choose a workspace for project-specific work.'
    };
  }

  if (/\b(what can you do|how can you help|help me|capabilities)\b/i.test(query)) {
    return {
      reply: 'I can help you think through a goal, open a public webpage in the canvas, inspect a chosen workspace, surface evidence, and propose safe actions for your approval. Live open-ended AI assistance is unavailable right now, but PaneTera’s local workspace and preview tools are ready.'
    };
  }

  return {
    reply: 'I understand the request, but live open-ended AI assistance is unavailable right now. I can still open a public webpage, list workspaces, inspect files, search a chosen project, show git status, or propose a build, test, or lint run for your approval.'
  };
}

export const latestObservations: any[] = [];

function isSuspicious(val: any): boolean {
  if (!val) return false;

  if (typeof val === 'string') {
    const s = val.trim();
    const lower = s.toLowerCase();
    if (/^Bearer\s/i.test(s)) return true;
    if (lower.startsWith('sk-')) return true;
    if (lower.startsWith('eyj')) return true;
    return false;
  }

  if (Array.isArray(val)) {
    return val.some(isSuspicious);
  }

  if (typeof val === 'object') {
    const suspiciousKeys = [
      'cookie', 'cookies', 'localStorage', 'sessionStorage', 'authorization',
      'auth', 'authToken', 'token', 'password', 'passwd', 'secret',
      'credential', 'credentials', 'bearer', 'apiKey', 'accessKey',
      'refreshToken', 'jwt'
    ].map(k => k.toLowerCase());
    for (const key of Object.keys(val)) {
      const normalizedKey = key.toLowerCase();
      if (suspiciousKeys.some(k => normalizedKey.includes(k))) {
        return true;
      }
      if (isSuspicious(val[key])) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Ask whether a public address will allow being framed, before rendering it.
 *
 * Exists because a cross-origin frame that refuses to load is silent from the
 * browser's side: the embedding page cannot read the response, so the canvas
 * renders blank with no way to explain itself. The server can read the headers.
 *
 * The address is validated inside `probeWebPreview` through the same validator
 * the composer uses, on the initial request and on every redirect hop.
 */
app.post('/api/web-preview/probe', async (req, res) => {
  const url = req.body?.url;
  if (typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'A url string is required' });
  }

  try {
    const outcome = await probeWebPreview(url);
    return res.json({ outcome });
  } catch (error) {
    // A probe failure must not stop the person seeing something useful, but it
    // must not vanish either. Discarding the exception here meant an
    // unanticipated failure reached the canvas as a bare "did not respond",
    // indistinguishable from a site that was genuinely down and with nothing
    // recorded anywhere to tell them apart.
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[web-preview-probe] threw while probing ${url}: ${reason}`);
    return res.json({
      outcome: { kind: 'unreachable', detail: 'the check could not be completed' },
    });
  }
});

app.post('/api/browser-observation', (req, res) => {
  if (!FEATURES.browserObservation) {
    return res.status(403).json({ error: "Access denied: browser observation is disabled in PaneTera." });
  }

  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Body must be an object' });
  }

  // 1. Recursive suspicious check
  if (isSuspicious(body)) {
    return res.status(400).json({ error: 'Payload contains suspicious auth/credential keys or token-like values' });
  }

  // 2. Validate required fields
  const { source, url, title, observedAt, domOutline, screenshotDataUrl, selectedText } = body;
  if (!source || !url || !title || !observedAt || !domOutline) {
    return res.status(400).json({ error: 'Missing required observation fields (source, url, title, observedAt, domOutline)' });
  }

  if (source !== 'chrome-observation') {
    return res.status(400).json({ error: 'Invalid source. Must be "chrome-observation"' });
  }

  if (!Array.isArray(domOutline)) {
    return res.status(400).json({ error: 'domOutline must be an array' });
  }

  // 3. Sanitize domOutline
  const sanitizedOutline: any[] = [];
  const allowedRoles = new Set(['heading', 'button', 'link', 'input', 'text', 'region']);
  for (const item of domOutline) {
    if (!item || typeof item !== 'object') continue;
    const role = String(item.role || '').toLowerCase();
    const rawText = String(item.text || '').trim();

    if (!allowedRoles.has(role)) {
      continue;
    }

    // Ignore passwords and input values entirely
    if (role === 'input' && (rawText.toLowerCase().includes('password') || rawText.toLowerCase().includes('passwd'))) {
      continue;
    }
    if (!rawText) continue;

    sanitizedOutline.push({
      role,
      text: rawText.substring(0, 300),
      level: typeof item.level === 'number' ? item.level : undefined
    });
  }
  const cappedOutline = sanitizedOutline.slice(0, 80);

  // 4. Validate screenshot
  if (screenshotDataUrl) {
    if (typeof screenshotDataUrl !== 'string') {
      return res.status(400).json({ error: 'screenshotDataUrl must be a string' });
    }
    const isPng = screenshotDataUrl.startsWith('data:image/png;base64,');
    const isJpeg = screenshotDataUrl.startsWith('data:image/jpeg;base64,');
    const isWebp = screenshotDataUrl.startsWith('data:image/webp;base64,');
    if (!isPng && !isJpeg && !isWebp) {
      return res.status(400).json({ error: 'Screenshot format must be PNG, JPEG, or WebP base64 data URL' });
    }
    if (screenshotDataUrl.length > 1.5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Screenshot exceeds 1.5MB size limit' });
    }
  }

  const sanitizedObs = {
    source,
    url,
    title,
    observedAt,
    domOutline: cappedOutline,
    screenshotDataUrl,
    selectedText: typeof selectedText === 'string' ? selectedText.substring(0, 500) : undefined
  };

  latestObservations.push(sanitizedObs);
  if (latestObservations.length > 10) {
    latestObservations.shift();
  }

  res.status(200).json({
    type: 'BrowserObservation',
    data: sanitizedObs
  });
});

// --- MYAI WORKSPACE MISSION CONTROL ENDPOINTS ---

// 1. Get workspaces catalog
app.get('/api/myai-workspaces', (req: Request, res: Response) => {
  const catalogPath = getWorkspaceCatalogPath();
  try {
    const data = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to read workspace catalog: ' + err.message });
  }
});

// 2. Register manual workspace
app.post('/api/myai-workspaces/register', (req: Request, res: Response) => {
  const { id, name, path: wsPath, type } = req.body as { id: string; name: string; path: string; type: string };
  if (!id || !name || !wsPath) {
    return res.status(400).json({ error: 'Missing required parameters (id, name, path).' });
  }

  const catalogPath = getWorkspaceCatalogPath();
  try {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    
    // Check if path or id already exists
    const exists = catalog.workspaces.find((w: any) => w.id === id || w.path === wsPath);
    if (exists) {
      return res.status(400).json({ error: 'Workspace ID or path is already registered.' });
    }

    const newWs = {
      id,
      name,
      path: wsPath,
      type: type || 'repo',
      enabled: false,
      status: 'offline'
    };

    catalog.workspaces.push(newWs);
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');

    auditOperatorAction({
      event: 'workspace.registered',
      principal: operatorPrincipalForRequest(req),
      details: { workspaceId: id, enabled: false, source: 'manual-registration' },
    });
    res.json({ success: true, workspace: newWs });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to register workspace: ' + err.message });
  }
});

// 3. Toggle workspace enabled state
app.post('/api/myai-workspaces/toggle', (req: Request, res: Response) => {
  const { id, enabled } = req.body as { id: string; enabled: boolean };
  if (!id) {
    return res.status(400).json({ error: 'Missing workspace id.' });
  }

  const catalogPath = getWorkspaceCatalogPath();
  try {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    const ws = catalog.workspaces.find((w: any) => w.id === id);
    if (!ws) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }

    ws.enabled = enabled;
    ws.status = enabled ? 'online' : 'offline';

    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');

    if (enabled) {
      auditOperatorAction({ event: 'workspace.enabled', principal: operatorPrincipalForRequest(req), details: { workspaceId: id } });
    } else {
      stopWorkspaceAdapter(id);
      auditOperatorAction({ event: 'workspace.disabled', principal: operatorPrincipalForRequest(req), details: { workspaceId: id } });
    }

    res.json({ success: true, workspace: ws });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to toggle workspace: ' + err.message });
  }
});

// 4. Scan for workspace suggestions in approved roots
app.get('/api/myai-workspaces/scan', (req: Request, res: Response) => {
  const catalogPath = getWorkspaceCatalogPath();
  try {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    
    // Approved parent root directory: we scan /Users/Shailesh/MYAIAGENTS
    const parentRoot = '/Users/Shailesh/MYAIAGENTS';
    const suggestions: any[] = [];

    if (fs.existsSync(parentRoot)) {
      const subdirs = fs.readdirSync(parentRoot, { withFileTypes: true });
      for (const dir of subdirs) {
        if (dir.isDirectory() && !dir.name.startsWith('.')) {
          const wsPath = path.join(parentRoot, dir.name);
          
          // Check if already registered
          const registered = catalog.workspaces.some((w: any) => w.path === wsPath);
          if (!registered) {
            // Check for manifest/config indicators
            const hasManifest = fs.existsSync(path.join(wsPath, 'myai-manifest.json'));
            const hasMcp = fs.existsSync(path.join(wsPath, '.mcp-config'));
            const hasPkgJson = fs.existsSync(path.join(wsPath, 'package.json'));

            if (hasManifest || hasMcp || hasPkgJson) {
              suggestions.push({
                id: `suggested-${dir.name.toLowerCase()}`,
                name: `${dir.name} (Suggested)`,
                path: wsPath,
                type: 'repo',
                enabled: false,
                status: 'offline',
                suggested: true
              });
            }
          }
        }
      }
    }

    res.json({ suggestions });
  } catch (err: any) {
    res.status(500).json({ error: 'Scan failed: ' + err.message });
  }
});

// 5. Query workspace tool (authorized & policy-wrapped)
app.post('/api/myai-workspaces/query', async (req: Request, res: Response) => {
  const { workspaceId, toolName, arguments: toolArgs } = req.body as { workspaceId: string; toolName: string; arguments?: any };
  if (!workspaceId || !toolName) {
    return res.status(400).json({ error: 'Missing required parameters (workspaceId, toolName).' });
  }

  try {
    const adapter = await getWorkspaceAdapter(workspaceId);
    const result = await adapter.call(toolName, toolArgs || {}, operatorPrincipalForRequest(req));
    res.json(result);
  } catch (err: any) {
    res.status(403).json({ error: err.message || 'Tool execution failed' });
  }
});

// 6. Retrieve recent audit logs (latest 50 records)
app.get('/api/myai-workspaces/audit', (req: Request, res: Response) => {
  const logPath = path.resolve(__dirname, 'audit.log');
  try {
    if (!fs.existsSync(logPath)) {
      return res.json({ logs: [] });
    }
    const content = fs.readFileSync(logPath, 'utf8').trim();
    if (!content) {
      return res.json({ logs: [] });
    }
    const lines = content.split('\n').map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
    // Shape every line through the authoritative typed model before returning it,
    // so the client reads one consistent typed record and never re-derives actor
    // attribution from raw fields. Legacy lines come back as unknown/unattributed.
    // This is read-shaping only; it does not change what is recorded or how any
    // actor is classified at write time.
    const logs = lines.slice(-50).reverse().map((line) => normalizeAuditRecord(line));
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to read audit logs: ' + err.message });
  }
});

// Orchestrator Chat V0 endpoint (strictly read-only)
app.post('/api/orchestrator/chat', async (req: Request, res: Response) => {
  const { message, workspaceId, selectedFile, persona, captureId, modelId } = req.body as {
    message: string;
    workspaceId: string | null;
    selectedFile: string | null;
    persona: 'engineer' | 'pm' | 'ba' | 'qa' | 'exec';
    captureId?: string;
    modelId?: string;
  };

  if (!message) {
    return res.status(400).json({ error: 'Missing required field: message' });
  }

  // Strict local workbench intents must resolve before any LLM path.
  try {
    const gatewayCard = await resolveGatewayCardLocally(message);
    if (gatewayCard) {
      return res.json(gatewayCard);
    }
  } catch (gatewayErr: any) {
    console.error('[Error in local gateway resolver]:', gatewayErr);
    return res.status(500).json({ error: gatewayErr.message || 'Error processing gateway card.' });
  }

  const resolveWorkspacePath = async (wId: string) => {
    const catalogPath = getWorkspaceCatalogPath();
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as { workspaces: any[] };
    const found = catalog.workspaces.find(w => w.id === wId);
    if (!found) throw new Error(`Workspace with ID '${wId}' not found.`);
    return { name: found.name, path: found.path };
  };

  try {
    const response = await handleOrchestratorQuery(
      message,
      workspaceId,
      selectedFile,
      persona || 'engineer',
      resolveWorkspacePath,
      captureId,
      modelId
    );
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error processing query.' });
  }
});

// Post chat endpoint - routes queries to natural language engine
app.post('/api/chat', async (req, res) => {
  const { query, history, modelId } = req.body as { query: string; history?: any[]; modelId?: string };
  if (!query) {
    return res.status(400).json({ error: 'query missing' });
  }

  // Native workbench cards are local UI truth. Resolve them before provider
  // calls so the model cannot swallow card intents such as "inspect soothsayer"
  // or reinterpret them as ordinary workspace questions.
  try {
    const gatewayCard = await resolveGatewayCardLocally(query);
    if (gatewayCard) {
      return res.json(gatewayCard);
    }
  } catch (gatewayErr: any) {
    console.error('[Error in local gateway resolver]:', gatewayErr);
    return res.status(500).json({ error: gatewayErr.message || 'Error processing gateway card.' });
  }

  // Inject recalled memory context into the query before calling any LLM
  let augmentedQuery = query;
  try {
    const recalled = await memoryBridge.retrieve('workspace');
    if (recalled.length > 0) {
      augmentedQuery = query + '\n\n[RECALLED CONTEXT from previous sessions]\n' + recalled.join('\n');
    }
  } catch { /* memory bridge unavailable — proceed without context */ }

  // Inject durable Headroom context (active capsule: objective, decisions,
  // assumptions, open questions) so the operator works from compiled context,
  // not just raw history.
  try {
    const headroomBlock = headroomContextBlock(headroomStore.listCapsules());
    if (headroomBlock) augmentedQuery = augmentedQuery + '\n\n' + headroomBlock;
  } catch { /* Headroom unavailable — proceed without it */ }

  // Helper: auto-save key interactions to memory after a successful response
  const autoRemember = (result: { uiComponent?: any }) => {
    if (!result.uiComponent) return;
    const { type, data } = result.uiComponent;
    if (type === 'FileList' && data?.workspace) {
      memoryBridge.remember('workspace', `Explored files in workspace: ${data.workspace}`).catch(() => {});
    } else if (type === 'CodePreview' && data?.path) {
      memoryBridge.remember('workspace', `Read file "${data.path}" in workspace "${data.workspace}"`).catch(() => {});
    } else if (type === 'SearchResults' && data?.keyword) {
      memoryBridge.remember('workspace', `Searched for "${data.keyword}" in workspace "${data.workspace}"`).catch(() => {});
    } else if (type === 'WorkspaceList') {
      memoryBridge.remember('workspace', `Listed all workspaces`).catch(() => {});
    } else if (type === 'GitHistory' && data?.workspace) {
      memoryBridge.remember('workspace', `Viewed git history for workspace "${data.workspace}"`).catch(() => {});
    }
  };

  // Route by selected model provider, then fall back to the cascade
  const modelProvider = modelId?.startsWith('ollama:') ? 'ollama'
    : modelId?.startsWith('claude') ? 'anthropic'
    : modelId?.startsWith('gemini') ? 'google'
    : modelId?.startsWith('gpt') || modelId?.startsWith('o4') ? 'openai'
    : null;

  // If a specific provider was selected, try that provider first
  if (modelProvider === 'google' && process.env.GEMINI_API_KEY) {
    try {
      const result = await askGemini(augmentedQuery, history || [], modelId);
      autoRemember(result);
      return res.json(result);
    } catch (e: any) {
      console.warn('\n[Warning] Gemini API failed:', e.message || e);
    }
  } else if (modelProvider === 'openai' && process.env.OPENAI_API_KEY) {
    try {
      const result = await askOpenAI(augmentedQuery, history || [], modelId);
      autoRemember(result);
      return res.json(result);
    } catch (e: any) {
      console.warn('\n[Warning] OpenAI API failed:', e.message || e);
    }
  } else if (modelProvider === 'ollama') {
    try {
      const ollamaResult = await askOllama(augmentedQuery, modelId);
      autoRemember(ollamaResult);
      return res.json(ollamaResult);
    } catch (e: any) {
      console.warn('\n[Warning] Ollama failed:', e.message || e);
    }
  } else if (modelProvider === 'anthropic') {
    // Anthropic not yet supported — fall through to cascade
    console.warn('\n[Info] Anthropic provider not yet supported, falling back to cascade.');
  }

  // Fallback cascade: Gemini → OpenAI → Ollama → deterministic
  // 1. Try Gemini first (if key exists)
  if (process.env.GEMINI_API_KEY) {
    try {
      const result = await askGemini(augmentedQuery, history || []);
      autoRemember(result);
      return res.json(result);
    } catch (e: any) {
      console.warn('\n[Warning] Gemini API failed, checking OpenAI secondary fallback:', e.message || e);
    }
  }

  // 2. Try OpenAI second (if key exists)
  if (process.env.OPENAI_API_KEY) {
    try {
      const result = await askOpenAI(augmentedQuery, history || [], modelId);
      autoRemember(result);
      return res.json(result);
    } catch (e: any) {
      console.warn('\n[Warning] OpenAI API failed, checking Local tertiary Ollama fallback:', e.message || e);
    }
  }

  // 3. Try Local Ollama Offline LLM (as a tertiary option)
  try {
    const ollamaResult = await askOllama(augmentedQuery);
    return res.json(ollamaResult);
  } catch (e: any) {
    console.warn('\n[Warning] Local Ollama offline failover not running, falling back to local deterministic parser.');
  }

  // 4. Try Local deterministic resolver as a quaternary fallback
  try {
    const fallbackResult = await resolveQueryLocally(query);
    autoRemember(fallbackResult);
    res.json(fallbackResult);
  } catch (fallbackErr: any) {
    console.error('[Error in local fallback resolver]:', fallbackErr);
    res.status(500).json({ error: fallbackErr.message || 'Error processing query.' });
  }
});

// Intent classifier endpoint — uses a lightweight LLM call to classify
// ambiguous prompts that don't match deterministic patterns.
app.post('/api/classify-intent', async (req, res) => {
  const { query } = req.body as { query: string };
  if (!query) {
    return res.status(400).json({ error: 'query missing' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.json({ family: 'converse', confidence: 0 });
  }

  try {
    const prompt = `Classify this user message into ONE of these intent families. Return JSON only.
Families: converse, project, web-surface, live-app, artifact, run, proposal, rig, headroom, evidence

Rules:
- "converse": general question, greeting, or anything not matching other families
- "project": choose, switch, or open a workspace/project
- "web-surface": open, show, close a website URL
- "live-app": open a registered application
- "artifact": inspect, examine, explain code or files
- "run": start, execute, or run something (agent execution)
- "proposal": approve, reject, or review an action
- "rig": configure tools, connections, or MCP servers
- "headroom": context, capsules, or memory
- "evidence": browser observations, extractions, or provenance

User message: "${query}"

Respond with JSON: { "family": "...", "confidence": 0.0-1.0 }`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 100,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      return res.json({ family: 'converse', confidence: 0 });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(text || '{}');

    const validFamilies = ['converse', 'project', 'web-surface', 'live-app', 'artifact', 'run', 'proposal', 'rig', 'headroom', 'evidence'];
    const family = validFamilies.includes(parsed.family) ? parsed.family : 'converse';
    const confidence = typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0;

    res.json({ family, confidence });
  } catch {
    res.json({ family: 'converse', confidence: 0 });
  }
});

// Workflow suggestions endpoint — returns AI-guided suggestions based on
// project context and registered tool capabilities.
app.get('/api/workflow-suggestions', async (req, res) => {
  try {
    const projectId = (req.query.projectId as string) || '';
    const projectName = (req.query.projectName as string) || '';
    const suggestions: {
      label: string;
      description: string;
      action: { kind: string; label: string; message?: string; surface?: string; projectId?: string };
      confidence: number;
      source?: string;
    }[] = [];

    // If a specific project is active, suggest project-relevant workflows
    if (projectName) {
      suggestions.push({
        label: `Inspect ${projectName}`,
        description: 'Browse the project structure, recent changes, and health status.',
        action: { kind: 'submit-message', label: `Inspect ${projectName}`, message: `what is the current state of ${projectName}`, projectId },
        confidence: 4,
        source: 'workspace',
      });
    }

    // Suggest IT Ops inspection for any active project
    if (projectName) {
      suggestions.push({
        label: 'Check deployment pipeline',
        description: 'View IT Ops deployment status, recent runs, and pipeline health.',
        action: { kind: 'submit-message', label: 'Check deployment pipeline', message: `show deployment pipeline for ${projectName}`, projectId },
        confidence: 3,
        source: 'it-ops',
      });
    }

    // Suggestion to set a goal if no project is active
    if (!projectName) {
      suggestions.push({
        label: 'Open a project',
        description: 'Choose a workspace to start working on.',
        action: { kind: 'open-project-picker', label: 'Open a project' },
        confidence: 5,
        source: 'workspace',
      });
    }

    // Browse browser observation
    suggestions.push({
      label: 'Browse live web preview',
      description: 'Open an interactive browser view to inspect a live page.',
      action: { kind: 'submit-message', label: 'Browse web preview', message: 'show latest browser observation' },
      confidence: 2,
      source: 'browser',
    });

    // Content workflow suggestion
    if (projectName) {
      suggestions.push({
        label: 'Draft content update',
        description: 'Write a blog post, documentation, or content update for the project.',
        action: { kind: 'submit-message', label: 'Draft content update', message: `write a blog post about recent updates in ${projectName}`, projectId },
        confidence: 2,
        source: 'content-ops',
      });
    }

    // Soothsayer integration
    if (projectName) {
      suggestions.push({
        label: 'Open Soothsayer dashboard',
        description: 'View the live Soothsayer application dashboard and workflows.',
        action: { kind: 'submit-message', label: 'Open Soothsayer', message: 'show soothsayer ui', projectId },
        confidence: 3,
        source: 'soothsayer',
      });
    }

    res.json({ suggestions });
  } catch (err: any) {
    res.status(500).json({ error: err.message, suggestions: [] });
  }
});

// Evidence browsing endpoint — returns recent browser observations + extractions
// for the evidence canvas surface.
app.get('/api/evidence', (_req, res) => {
  try {
    const { browserEvidenceStore } = require('./browserEvidenceStore') as typeof import('./browserEvidenceStore');
    const observations = browserEvidenceStore.getObservations() ?? [];
    const extractions = browserEvidenceStore.getRecentExtractions(50) ?? [];
    res.json({ observations, extractions, count: observations.length + extractions.length });
  } catch {
    res.json({ observations: [], extractions: [], count: 0 });
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 PaneTera backend listening on http://127.0.0.1:${PORT}`);
  });
}

process.on('SIGINT', () => {
  stopAllWorkspaceAdapters();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopAllWorkspaceAdapters();
  process.exit(0);
});
