// server/workspaceReader.ts
import path from 'path';
import fs from 'fs/promises';
import yaml from 'js-yaml';
import { getPortalYamlPath } from './appData';

// Settings
const getRoot = () => process.env.WORKSPACE_ROOT || '/Users/Shailesh/MYAIAGENTS';
const PORTAL_YAML = getPortalYamlPath();

interface PortalYaml {
  workspaces: Array<{ name: string; folder?: string; path?: string }>;
}

// Load portal.yaml and validate its structure
export async function listWorkspaces(): Promise<Array<{name:string; path:string}>> {
  try {
    const raw = await fs.readFile(PORTAL_YAML, 'utf8');
    const doc = yaml.load(raw) as PortalYaml;
    if (!doc || !Array.isArray(doc.workspaces)) {
      throw new Error('Invalid portal.yaml format');
    }
    const currentRoot = getRoot();
    // Ensure each workspace is inside the allowed ROOT
    const workspaces = doc.workspaces.map((ws:any) => {
      if (!ws.name) throw new Error('Workspace entry missing name');
      
      let absPath: string;
      if (ws.folder) {
        absPath = path.resolve(currentRoot, ws.folder);
      } else if (ws.path) {
        absPath = path.resolve(ws.path);
      } else {
        throw new Error(`Workspace ${ws.name} missing 'folder' or 'path' property`);
      }

      // Boundary check must be segment-aware: plain startsWith(ROOT) would
      // accept sibling dirs like `${ROOT}-evil`.
      if (absPath !== currentRoot && !absPath.startsWith(currentRoot + path.sep)) {
        throw new Error(`Workspace ${ws.name} at path ${absPath} is outside allowed WORKSPACE_ROOT (${currentRoot})`);
      }
      return { name: ws.name, path: absPath };
    });
    return workspaces;
  } catch (e:any) {
    throw new Error(`Failed to read portal.yaml: ${e.message}`);
  }
}

export async function addWorkspaceToPortalYaml(name: string, folder: string): Promise<void> {
  const raw = await fs.readFile(PORTAL_YAML, 'utf8');
  const doc = yaml.load(raw) as PortalYaml;
  if (!doc || !Array.isArray(doc.workspaces)) {
    throw new Error('Invalid portal.yaml format');
  }
  
  // Check if it already exists
  if (doc.workspaces.some((w: any) => w.name === name || w.folder === folder)) {
    throw new Error(`Workspace with name "${name}" or folder "${folder}" already exists.`);
  }

  doc.workspaces.push({
    name,
    folder
  });

  const newYaml = yaml.dump(doc);
  await fs.writeFile(PORTAL_YAML, newYaml, 'utf8');
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
  let realAbsPath: string;
  try {
    realAbsPath = await fs.realpath(absPath);
  } catch (e) {
    // If it doesn't exist, just use the resolved path for the rest of the checks
    // The actual read will fail anyway if it doesn't exist.
    realAbsPath = absPath;
  }

  // Ensure the final resolved path is still inside the workspace root.
  // Segment-aware: startsWith(ws.path) alone would accept `${ws.path}-evil`.
  if (realAbsPath !== ws.path && !realAbsPath.startsWith(ws.path + path.sep)) {
    throw new Error('Path traversal detected');
  }
  // Block disallowed folders
  const segments = realAbsPath.split(path.sep);
  if (segments.some(seg=>BLOCKED_FOLDERS.includes(seg))) {
    throw new Error('Access to blocked folder');
  }
  // Block disallowed file patterns (simple check for .env etc.)
  const base = path.basename(realAbsPath);
  if (BLOCKED_FILES.some(pat=> {
    if (pat.startsWith('*.')) {
      return base.endsWith(pat.slice(1));
    }
    return base===pat;
  })) {
    throw new Error('Access to blocked file');
  }
  // Extension allowlist
  const ext = path.extname(realAbsPath).toLowerCase();
  if (!ALLOWED_EXTS.includes(ext)) throw new Error('File extension not allowed');
  // Size check
  let stat;
  try {
    stat = await fs.stat(realAbsPath);
  } catch (e: any) {
    if (e.code === 'ENOENT') throw new Error(`File not found: ${relPath}`);
    throw new Error('Failed to stat file');
  }
  if (stat.size > MAX_SIZE) throw new Error('File too large');
  // Read and return as UTF‑8 text
  try {
    const data = await fs.readFile(realAbsPath, 'utf8');
    return data;
  } catch (e: any) {
    if (e.code === 'ENOENT') throw new Error(`File not found: ${relPath}`);
    throw new Error('Failed to read file');
  }
}

export async function listFilesInWorkspace(workspaceName: string): Promise<string[]> {
  const workspaces = await listWorkspaces();
  const ws = workspaces.find(w => w.name === workspaceName);
  if (!ws) throw new Error(`Workspace ${workspaceName} not allowed`);
  const workspacePath = ws.path;

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
          const rel = path.relative(workspacePath, fullPath);
          fileList.push(rel);
        } catch (e) {
          // Skip un-statable files
        }
      }
    }
  }
  await recurse(workspacePath);
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
