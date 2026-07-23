import type { FileInfo } from './WorkspaceFileTree';

export interface FileTreeNode extends FileInfo {
  children: FileTreeNode[];
}

/** Build a navigable hierarchy from the MCP server's flat relative paths. */
export function buildFileTree(files: readonly FileInfo[]): FileTreeNode[] {
  const nodes = new Map<string, FileTreeNode>();

  for (const file of files) {
    const cleanPath = file.path.replace(/\\/g, '/').replace(/^\.\//, '');
    if (!cleanPath || cleanPath.startsWith('/') || cleanPath.split('/').includes('..')) continue;
    nodes.set(cleanPath, { ...file, path: cleanPath, children: [] });
  }

  const roots: FileTreeNode[] = [];
  for (const node of nodes.values()) {
    const parentPath = node.path.includes('/') ? node.path.slice(0, node.path.lastIndexOf('/')) : '';
    const parent = parentPath ? nodes.get(parentPath) : undefined;
    if (parent?.isDirectory) parent.children.push(node);
    else roots.push(node);
  }

  const sortNodes = (items: FileTreeNode[]) => {
    items.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
    items.forEach((item) => sortNodes(item.children));
  };
  sortNodes(roots);
  return roots;
}

export function filterFileTree(nodes: readonly FileTreeNode[], query: string): FileTreeNode[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return nodes.map((node) => ({ ...node, children: filterFileTree(node.children, '') }));

  const matches: FileTreeNode[] = [];
  for (const node of nodes) {
    const children = filterFileTree(node.children, needle);
    if (node.path.toLocaleLowerCase().includes(needle) || children.length > 0) {
      matches.push({ ...node, children });
    }
  }
  return matches;
}

export function topLevelDirectories(nodes: readonly FileTreeNode[]): string[] {
  return nodes.filter((node) => node.isDirectory).map((node) => node.path);
}
