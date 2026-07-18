import fs from 'fs/promises';
import yaml from 'js-yaml';
import path from 'path';

const PORTAL_YAML = path.join(process.cwd(), 'portal.yaml');

export async function addWorkspaceToPortalYaml(name: string, folder: string): Promise<void> {
  const raw = await fs.readFile(PORTAL_YAML, 'utf8');
  const doc = yaml.load(raw) as any;
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
