// server/configValidation.ts
//
// Pure validators for the two runtime config files, so a malformed config
// surfaces an actionable message at startup instead of a cryptic crash deep in a
// request. Lenient by design: an empty catalog and unknown extra fields are
// valid, so a fresh or default install always passes. Only clearly-wrong shapes
// are flagged. Each function returns human-readable error strings; empty means
// valid.

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Validate the parsed `myai-workspaces.json` catalog. */
export function validateWorkspaceCatalog(value: unknown): string[] {
  const root = asObject(value);
  if (!root) return ['myai-workspaces.json must be a JSON object with a "workspaces" array.'];

  const ws = root.workspaces;
  if (!Array.isArray(ws)) return ['myai-workspaces.json: "workspaces" must be an array.'];

  const errors: string[] = [];
  ws.forEach((entry, i) => {
    const obj = asObject(entry);
    if (!obj) {
      errors.push(`myai-workspaces.json: workspaces[${i}] must be an object.`);
      return;
    }
    if (typeof obj.name !== 'string' || !obj.name.trim()) {
      errors.push(`myai-workspaces.json: workspaces[${i}] is missing a non-empty "name".`);
    }
  });
  return errors;
}

/** Validate the parsed `portal.yaml` workspace catalog. */
export function validatePortalCatalog(value: unknown): string[] {
  const root = asObject(value);
  if (!root) return ['portal.yaml must be a mapping with a "workspaces" list.'];

  const ws = root.workspaces;
  // A portal with no workspaces key, or an explicit null, is a valid empty catalog.
  if (ws === undefined || ws === null) return [];
  if (!Array.isArray(ws)) return ['portal.yaml: "workspaces" must be a list.'];

  const errors: string[] = [];
  ws.forEach((entry, i) => {
    const obj = asObject(entry);
    if (!obj) {
      errors.push(`portal.yaml: workspaces[${i}] must be a mapping.`);
      return;
    }
    if (typeof obj.name !== 'string' || !obj.name.trim()) {
      errors.push(`portal.yaml: workspaces[${i}] is missing a "name".`);
    }
    if (obj.folder !== undefined && typeof obj.folder !== 'string') {
      errors.push(`portal.yaml: workspaces[${i}].folder must be a string when present.`);
    }
  });
  return errors;
}
