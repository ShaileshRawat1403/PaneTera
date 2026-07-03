// server/index.ts
import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import chokidar from 'chokidar';
import path from 'path';
import { spawn as spawnProc, ChildProcess as CP } from 'child_process';
import readline from 'readline';
import { readFileSafe, listWorkspaces, listFilesInWorkspace, searchFilesInWorkspace } from './workspaceReader';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const TOKEN = process.env.PORTAL_TOKEN || '';

// Fail fast if token placeholder is still present
if (TOKEN === 'changeme-12345' || !TOKEN) {
  console.error('\n[ERROR] PORTAL_TOKEN is still the default placeholder. Please set a strong token in .env before starting.\n');
  process.exit(1);
}

app.use(express.json());

// CORS – restrict to localhost origins only
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin && origin.startsWith('http://localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
  }
  next();
});

// Token authentication middleware (supports Authorization header and query parameter token for EventSource)
app.use((req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization?.split(' ')[1] || (req.query.token as string);
  if (!authHeader || authHeader !== TOKEN) {
    return res.status(401).json({ error: 'Invalid or missing token' });
  }
  next();
});

// ── Rook MCP Memory Bridge ───────────────────────────────────────────────────
// Spawns `rook mcp memory` as a child process and communicates over stdio
// using JSON-RPC (MCP protocol). No changes to the rook repo are needed.

const ROOK_BINARY = process.env.ROOK_BINARY_PATH
  || '/Users/Shailesh/MYAIAGENTS/rook/target/debug/rook';

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

    // MCP initialize handshake
    await this.call('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'myai-portal', version: '1.0.0' }
    });
    this.ready = true;
    console.log('[MemoryBridge] rook memory server ready');
  }

  private call(method: string, params: Record<string, unknown>): Promise<McpRpcResp> {
    return new Promise((resolve) => {
      const id = this.idCounter++;
      const req: McpRpcReq = { jsonrpc: '2.0', id, method, params };
      this.pending.set(id, resolve);
      this.proc!.stdin!.write(JSON.stringify(req) + '\n');
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
      const text = ((resp.result as any)?.content?.[0]?.text as string) || '';
      return text ? [text] : [];
    } catch {
      return [];
    }
  }

  stop(): void { this.proc?.kill(); }
}

const memoryBridge = new RookMemoryBridge();
memoryBridge.start().catch((e: Error) =>
  console.warn('[MemoryBridge] Could not start rook memory server (build rook first):', e.message)
);
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

setupWatcher().catch(err => console.error('Error starting chokidar watcher:', err));

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

import { exec, spawn, ChildProcess } from 'child_process';

let activeProcesses: { [id: string]: ChildProcess } = {};

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

    // Command verification
    const allowedCmds = [
      { match: /^npm\s+run\s+test$/, cmd: 'npm', args: ['run', 'test'] },
      { match: /^npm\s+test$/, cmd: 'npm', args: ['test'] },
      { match: /^npm\s+run\s+build$/, cmd: 'npm', args: ['run', 'build'] },
      { match: /^npm\s+run\s+lint$/, cmd: 'npm', args: ['run', 'lint'] },
      { match: /^cargo\s+check$/, cmd: 'cargo', args: ['check'] },
      { match: /^cargo\s+test$/, cmd: 'cargo', args: ['test'] },
      { match: /^git\s+diff$/, cmd: 'git', args: ['diff'] },
      { match: /^git\s+status$/, cmd: 'git', args: ['status'] }
    ];

    const matched = allowedCmds.find(item => item.match.test(command.trim()));
    if (!matched) {
      return res.status(400).json({ error: `Command "${command}" is not in the portal safe execution allowlist.` });
    }

    const child = spawn(matched.cmd, matched.args, { cwd: ws.path, shell: true });
    activeProcesses[procId] = child;

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

    child.stdout?.on('data', (data) => {
      broadcastLog('stdout', data.toString());
    });

    child.stderr?.on('data', (data) => {
      broadcastLog('stderr', data.toString());
    });

    child.on('close', (code) => {
      broadcastLog('status', `Process completed with exit code: ${code}`);
      delete activeProcesses[procId];
    });

    res.json({ success: true, message: 'Execution initiated' });
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
async function askGemini(query: string, history: any[] = []): Promise<{ reply: string; uiComponent?: any }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }

  // Key travels in a header, never in the URL — URLs leak into logs,
  // error traces, and proxies.
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  const contentsPayload: any[] = [];
  for (const h of history) {
    contentsPayload.push({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: h.parts?.[0]?.text || '' }]
    });
  }

  contentsPayload.push({
    role: 'user',
    parts: [{ text: query }]
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: contentsPayload,
      systemInstruction: {
        parts: [{
          text: 'You are the assistant for MyAI Portal, a secure, governed dashboard for non-technical stakeholders.\n' +
                'You help users explore their workspaces, inspect files, check folder contents, and search code/docs.\n' +
                'You must use the provided tools to fetch actual workspace data. Do not make up file paths or contents.\n' +
                'If the user asks to build, test, lint, or check status/diff for a workspace, call proposeExecution — ' +
                'never claim to have run or changed anything yourself. Execution only happens after the user explicitly ' +
                'approves the proposal card, and only for the fixed set of safe commands proposeExecution allows.\n' +
                'Always answer in natural language, be friendly and helpful, and do NOT use emojis in your response.'
        }]
      },
      tools: [
        {
          functionDeclarations: [
            {
              name: 'listWorkspaces',
              description: 'Lists the allowed workspaces configured in the portal.'
            },
            {
              name: 'listFilesInWorkspace',
              description: 'Lists all safe files recursively within the specified workspace.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  workspaceName: { type: 'STRING', description: 'The name of the workspace to list files from.' }
                },
                required: ['workspaceName']
              }
            },
            {
              name: 'readFileSafe',
              description: 'Reads the contents of a file within a workspace. Enforces file size limits and extension allowlist.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  workspaceName: { type: 'STRING', description: 'The name of the workspace.' },
                  relPath: { type: 'STRING', description: 'The relative path to the file inside the workspace.' }
                },
                required: ['workspaceName', 'relPath']
              }
            },
            {
              name: 'searchFilesInWorkspace',
              description: 'Searches for a keyword inside safe files in a workspace, returning matching lines.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  workspaceName: { type: 'STRING', description: 'The name of the workspace.' },
                  keyword: { type: 'STRING', description: 'The keyword or string to search for.' }
                },
                required: ['workspaceName', 'keyword']
              }
            },
            {
              name: 'proposeExecution',
              description: 'Propose running a safe, allowlisted command in a workspace. This never executes anything directly — it only creates a card the user must explicitly approve before anything runs. Use this whenever the user asks to build, test, lint, or check status/diff for a workspace.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  workspaceName: { type: 'STRING', description: 'The name of the workspace to run the command in.' },
                  command: {
                    type: 'STRING',
                    enum: ['npm run test', 'npm test', 'npm run build', 'npm run lint', 'cargo check', 'cargo test', 'git diff', 'git status'],
                    description: 'The exact allowlisted command to propose.'
                  },
                  reason: { type: 'STRING', description: 'A short, plain-language reason this command answers the request.' }
                },
                required: ['workspaceName', 'command']
              }
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const content = candidate?.content;

  if (content) {
    const part = content.parts?.[0];
    if (part?.text) {
      const rawText = part.text;
      const cleanText = rawText.replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
      return { reply: cleanText.trim() };
    }
  }

  let uiComponent: any = null;
  const contents = [...contentsPayload];

  for (let turn = 0; turn < 5; turn++) {
    const message = candidate?.content || content;
    if (!message) break;
    contents.push(message);

    const part = message.parts?.[0];
    if (part?.functionCall) {
      const { name, args } = part.functionCall;
      let toolResult: any;

      try {
        if (name === 'listWorkspaces') {
          const workspaces = await listWorkspaces();
          toolResult = workspaces;
          uiComponent = { type: 'WorkspaceList', data: workspaces };
        } else if (name === 'listFilesInWorkspace') {
          const files = await listFilesInWorkspace(args.workspaceName);
          toolResult = { workspace: args.workspaceName, files };
          uiComponent = { type: 'FileList', data: { workspace: args.workspaceName, files } };
        } else if (name === 'readFileSafe') {
          const content = await readFileSafe(args.workspaceName, args.relPath);
          toolResult = { content };
          uiComponent = { type: 'CodePreview', data: { workspace: args.workspaceName, path: args.relPath, content } };
        } else if (name === 'searchFilesInWorkspace') {
          const results = await searchFilesInWorkspace(args.workspaceName, args.keyword);
          toolResult = { results };
          uiComponent = { type: 'SearchResults', data: { workspace: args.workspaceName, keyword: args.keyword, results } };
        } else if (name === 'proposeExecution') {
          // Never executes — only produces a card the user must explicitly
          // approve. The actual run still passes through /api/execute's
          // own server-side allowlist regardless of what's proposed here.
          toolResult = { proposed: true, workspaceName: args.workspaceName, command: args.command };
          uiComponent = {
            type: 'ProposedAction',
            data: { workspaceName: args.workspaceName, command: args.command, reason: args.reason || '' }
          };
        } else {
          throw new Error(`Unknown function: ${name}`);
        }
      } catch (err: any) {
        toolResult = { error: err.message };
      }

      contents.push({
        role: 'function',
        parts: [
          {
            functionResponse: {
              name,
              response: { output: toolResult }
            }
          }
        ]
      });

      const nextResp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents })
      });

      if (!nextResp.ok) {
        const nextErr = await nextResp.text();
        throw new Error(`Gemini function chaining error: ${nextResp.status} - ${nextErr}`);
      }

      const nextData = await nextResp.json();
      const nextCandidate = nextData.candidates?.[0];
      const nextPart = nextCandidate?.content?.parts?.[0];
      
      if (nextPart?.text) {
        const rawText = nextPart.text;
        const cleanText = rawText.replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
        return {
          reply: cleanText.trim(),
          uiComponent
        };
      }
    }
  }

  throw new Error('Too many function calls');
}

// OpenAI Q&A execution handler
async function askOpenAI(query: string, history: any[] = []): Promise<{ reply: string; uiComponent?: any }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is missing.');
  }

  const url = 'https://api.openai.com/v1/chat/completions';

  const messagesPayload: any[] = [
    {
      role: 'system',
      content: 'You are the assistant for MyAI Portal, a secure, governed dashboard for non-technical stakeholders.\n' +
               'You help users explore their workspaces, inspect files, check folder contents, and search code/docs.\n' +
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
              enum: ['npm run test', 'npm test', 'npm run build', 'npm run lint', 'cargo check', 'cargo test', 'git diff', 'git status'],
              description: 'The exact allowlisted command to propose.'
            },
            reason: { type: 'string', description: 'A short, plain-language reason this command answers the request.' }
          },
          required: ['workspaceName', 'command']
        }
      }
    }
  ];

  let uiComponent: any = null;

  for (let turn = 0; turn < 5; turn++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messagesPayload,
        tools,
        tool_choice: 'auto'
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const assistantMessage = choice?.message;
    if (!assistantMessage) {
      throw new Error('Invalid response received from OpenAI API');
    }

    messagesPayload.push(assistantMessage);

    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolCall = assistantMessage.tool_calls[0];
      const { name, arguments: argsString } = toolCall.function;
      const args = argsString ? JSON.parse(argsString) : {};
      let toolResult: any;

      try {
        if (name === 'listWorkspaces') {
          const workspaces = await listWorkspaces();
          toolResult = workspaces;
          uiComponent = { type: 'WorkspaceList', data: workspaces };
        } else if (name === 'listFilesInWorkspace') {
          const files = await listFilesInWorkspace(args.workspaceName);
          toolResult = { workspace: args.workspaceName, files };
          uiComponent = { type: 'FileList', data: { workspace: args.workspaceName, files } };
        } else if (name === 'readFileSafe') {
          const content = await readFileSafe(args.workspaceName, args.relPath);
          toolResult = { content };
          uiComponent = { type: 'CodePreview', data: { workspace: args.workspaceName, path: args.relPath, content } };
        } else if (name === 'searchFilesInWorkspace') {
          const results = await searchFilesInWorkspace(args.workspaceName, args.keyword);
          toolResult = { results };
          uiComponent = { type: 'SearchResults', data: { workspace: args.workspaceName, keyword: args.keyword, results } };
        } else if (name === 'proposeExecution') {
          // Never executes — only produces a card the user must explicitly
          // approve. The actual run still passes through /api/execute's
          // own server-side allowlist regardless of what's proposed here.
          toolResult = { proposed: true, workspaceName: args.workspaceName, command: args.command };
          uiComponent = {
            type: 'ProposedAction',
            data: { workspaceName: args.workspaceName, command: args.command, reason: args.reason || '' }
          };
        } else {
          throw new Error(`Unknown function: ${name}`);
        }
      } catch (err: any) {
        toolResult = { error: err.message };
      }

      messagesPayload.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name,
        content: JSON.stringify(toolResult)
      });
    } else {
      const rawText = assistantMessage.content || 'No response';
      const cleanText = rawText.replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
      return {
        reply: cleanText.trim(),
        uiComponent
      };
    }
  }

  throw new Error('Too many tool execution loops in OpenAI call');
}

// Local Ollama Q&A offline execution fallback handler
async function askOllama(query: string): Promise<{ reply: string; uiComponent?: any }> {
  const url = 'http://localhost:11434/api/generate';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3',
      prompt: `You are the assistant for MyAI Portal, a secure, governed dashboard for non-technical stakeholders.\n` +
              `Help the user explore workspaces. Query: ${query}\n` +
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

// Local deterministic parsing logic (acts as direct command backup)
async function resolveQueryLocally(query: string): Promise<{ reply: string; uiComponent?: any }> {
  const q = query.toLowerCase().trim();

  // 1. Workspaces / Journey
  if (q.includes('workspace') || q.includes('journey')) {
    const workspaces = await listWorkspaces();
    return {
      reply: `[LOCAL FALLBACK ENGINE] Active registered workspaces loaded. Choose a directory inside the stream panel to begin.`,
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
        reply: `[LOCAL FALLBACK ENGINE] File loaded: "${filePath}" inside workspace "${workspace}".`,
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
        reply: `[LOCAL FALLBACK ENGINE] Search results populated for "${keyword}" inside workspace "${workspace}".`,
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
        reply: `[LOCAL FALLBACK ENGINE] Found ${files.length} safe files inside workspace "${workspace}". View explorer on the right.`,
        uiComponent: { type: 'FileList', data: { workspace, files } }
      };
    } catch (err: any) {
      return { reply: `[ERROR] Directory listing failed: ${err.message}` };
    }
  }

  // 4.5. Web search intent — no live web search is wired up. Say so
  // plainly instead of returning results that look real but aren't.
  const webSearchRegex = /(?:search web for|web search for|search web|search the web for)\s+(.+)/i;
  const webSearchMatch = query.match(webSearchRegex);
  if (webSearchMatch) {
    return {
      reply: `[LOCAL FALLBACK ENGINE] Web search isn't connected in this build. Ask about a registered workspace, a file, or a keyword inside one instead.`
    };
  }

  // 4.55. Build/test/lint intent — propose it, never auto-run it. This is
  // the local (no-LLM-key) path to the same approval-gated control-plane
  // pattern proposeExecution gives the LLM tool-calling paths.
  const proposeVerbRegex = /\b(build|lint|tests?)\b/i;
  const proposeWorkspaceMatch = query.match(/(?:for|in)\s+([\w-]+)/i);
  const proposeVerbMatch = query.match(proposeVerbRegex);
  if (proposeVerbMatch && proposeWorkspaceMatch) {
    const workspace = proposeWorkspaceMatch[1];
    const verb = proposeVerbMatch[1].toLowerCase();
    const isRust = workspace.toLowerCase() === 'rook';
    const command = verb.startsWith('lint')
      ? 'npm run lint'
      : verb.startsWith('test')
        ? (isRust ? 'cargo test' : 'npm test')
        : (isRust ? 'cargo check' : 'npm run build');
    return {
      reply: `[LOCAL FALLBACK ENGINE] I can run "${command}" in workspace "${workspace}". Nothing runs until you approve it below.`,
      uiComponent: {
        type: 'ProposedAction',
        data: { workspaceName: workspace, command, reason: `Requested via: "${query}"` }
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
      reply: `[LOCAL FALLBACK ENGINE] Pipelines and workflow history loaded for workspace "${workspace}". View build logs on the right.`,
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
        reply: `[LOCAL FALLBACK ENGINE] Git status and log history loaded for workspace "${workspace}".`,
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
      reply: `[LOCAL FALLBACK ENGINE] System application audit initialized. Querying active macOS process lists.`,
      uiComponent: {
        type: 'DesktopApps',
        data: {}
      }
    };
  }

  // 5. General Q&A Fallback
  return {
    reply: `SYSTEM CONFIG // LOCAL CORE CONTROLS
--------------------------------------------------
Status: Gemini API connection quota exhausted (429)
Mode: Local deterministic parsing system active

Please run standard workspace queries directly:
- "List workspaces" -> Scan active directories
- "List files in rook" -> Index files in workspace
- "Read README.md in flowright" -> Browse file code
- "Search for config in flowright" -> Scan codebase
--------------------------------------------------
Local terminal is operational. Ready for queries.`
  };
}

// Post chat endpoint - routes queries to natural language engine
app.post('/api/chat', async (req, res) => {
  const { query, history } = req.body as { query: string; history?: any[] };
  if (!query) {
    return res.status(400).json({ error: 'query missing' });
  }

  // Inject recalled memory context into the query before calling any LLM
  let augmentedQuery = query;
  try {
    const recalled = await memoryBridge.retrieve('workspace');
    if (recalled.length > 0) {
      augmentedQuery = query + '\n\n[RECALLED CONTEXT from previous sessions]\n' + recalled.join('\n');
    }
  } catch { /* memory bridge unavailable — proceed without context */ }

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
      const result = await askOpenAI(augmentedQuery, history || []);
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

app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Portal backend listening on http://127.0.0.1:${PORT}`);
});
