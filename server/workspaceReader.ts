// server/workspaceReader.ts
import path from 'path';
import fs from 'fs/promises';
import yaml from 'js-yaml';

// Settings
const ROOT = process.env.WORKSPACE_ROOT || '/Users/Shailesh/MYAIAGENTS';
const PORTAL_YAML = path.join(process.cwd(), 'portal.yaml');

// Load portal.yaml and validate its structure
export async function listWorkspaces(): Promise<Array<{name:string; path:string}>> {
  try {
    const raw = await fs.readFile(PORTAL_YAML, 'utf8');
    const doc = yaml.load(raw) as any;
    if (!doc || !Array.isArray(doc.workspaces)) {
      throw new Error('Invalid portal.yaml format');
    }
    // Ensure each workspace is inside the allowed ROOT
    const workspaces = doc.workspaces.map((ws:any) => {
      if (!ws.name || !ws.path) throw new Error('Workspace entry missing name or path');
      const absPath = path.resolve(ws.path);
      if (!absPath.startsWith(ROOT)) {
        throw new Error(`Workspace ${ws.name} is outside allowed root`);
      }
      return { name: ws.name, path: absPath };
    });
    return workspaces;
  } catch (e:any) {
    throw new Error(`Failed to read portal.yaml: ${e.message}`);
  }
}

// Safe file read respecting allowlist, size limits, and blocked paths
const BLOCKED_FOLDERS = ['.git','node_modules','dist','build','.next','.turbo','.cache','out'];
const BLOCKED_FILES = ['.env','*.key','*.pem','*.crt','*.crt','*.secret'];
const ALLOWED_EXTS = ['.md','.txt','.json','.yaml','.yml','.ts','.tsx','.js','.jsx','.java','.go','.cpp','.c','.rs'];
const MAX_SIZE = 2 * 1024 * 1024; // 2 MiB

export async function readFileSafe(workspaceName:string, relPath:string): Promise<string> {
  const workspaces = await listWorkspaces();
  const ws = workspaces.find(w=>w.name===workspaceName);
  if (!ws) throw new Error(`Workspace ${workspaceName} not allowed`);
  const absPath = path.resolve(ws.path, relPath);
  // Ensure the final resolved path is still inside the workspace root
  if (!absPath.startsWith(ws.path)) throw new Error('Path traversal detected');
  // Block disallowed folders
  const segments = absPath.split(path.sep);
  if (segments.some(seg=>BLOCKED_FOLDERS.includes(seg))) {
    throw new Error('Access to blocked folder');
  }
  // Block disallowed file patterns (simple check for .env etc.)
  const base = path.basename(absPath);
  if (BLOCKED_FILES.some(pat=> {
    if (pat.startsWith('*.')) {
      return base.endsWith(pat.slice(1));
    }
    return base===pat;
  })) {
    throw new Error('Access to blocked file');
  }
  // Extension allowlist
  const ext = path.extname(absPath).toLowerCase();
  if (!ALLOWED_EXTS.includes(ext)) throw new Error('File extension not allowed');
  // Size check
  const stat = await fs.stat(absPath);
  if (stat.size > MAX_SIZE) throw new Error('File too large');
  // Read and return as UTF‑8 text
  const data = await fs.readFile(absPath, 'utf8');
  return data;
}

export async function listFilesInWorkspace(workspaceName: string): Promise<string[]> {
  const workspaces = await listWorkspaces();
  const ws = workspaces.find(w => w.name === workspaceName);
  if (!ws) throw new Error(`Workspace ${workspaceName} not allowed`);

  const fileList: string[] = [];
  async function recurse(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (BLOCKED_FOLDERS.includes(entry.name)) continue;

      if (entry.isDirectory()) {
        try {
          await recurse(fullPath);
        } catch (e) {
          // Skip unreadable directories
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!ALLOWED_EXTS.includes(ext)) continue;

        if (BLOCKED_FILES.some(pat => {
          if (pat.startsWith('*.')) return entry.name.endsWith(pat.slice(1));
          return entry.name === pat;
        })) continue;

        try {
          const stat = await fs.stat(fullPath);
          if (stat.size > MAX_SIZE) continue;
          const rel = path.relative(ws.path, fullPath);
          fileList.push(rel);
        } catch (e) {
          // Skip un-statable files
        }
      }
    }
  }
  await recurse(ws.path);
  return fileList;
}


export async function searchFilesInWorkspace(workspaceName: string, keyword: string): Promise<Array<{file: string; matches: string[]}>> {
  const files = await listFilesInWorkspace(workspaceName);
  const results: Array<{file: string; matches: string[]}> = [];
  const keywordLower = keyword.toLowerCase();

  for (const file of files) {
    try {
      const content = await readFileSafe(workspaceName, file);
      const lines = content.split(/\r?\n/);
      const fileMatches: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.toLowerCase().includes(keywordLower)) {
          fileMatches.push(`Line ${i + 1}: ${line.trim()}`);
          if (fileMatches.length >= 5) break;
        }
      }
      if (fileMatches.length > 0) {
        results.push({ file, matches: fileMatches });
      }
      if (results.length >= 10) break;
    } catch (e) {
      // Skip files we fail to read/process
    }
  }
  return results;
}

