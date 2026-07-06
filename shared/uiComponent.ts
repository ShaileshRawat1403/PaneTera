// shared/uiComponent.ts — the single source of truth for the portal's
// typed UI card contract.
//
// This schema IS the point of the portal POC: the model (or any producer)
// never emits markup, only a typed payload validated here before the
// renderer sees it. Server and client both import from this file; the
// unions must never be copy-pasted again (that drift is how the repo
// accumulated four disagreeing versions of this type).
//
// Models generate. Systems govern. This file is the governor.

export const UI_COMPONENT_TYPES = [
  'WorkspaceList',
  'FileList',
  'CodePreview',
  'SearchResults',
  'TerminalLogs',
  'WorkflowsList',
  'ProposedAction',
  'RepoSetupProposal',
  'LiveAppWorkbench',
  'ContentWorkflow',
  'ExecutionLogs',
  'GitHistory',
  'DesktopApps',
  'MemoryRecall',
  'ContentOpsStarter',
] as const;

export type UiComponentType = (typeof UI_COMPONENT_TYPES)[number];

export interface UiComponent {
  type: UiComponentType;
  // `any` is a POC concession: per-type payload schemas are the next
  // tightening step once the card set stabilizes.
  data: any;
}

/** A feed entry as rendered in the preview panel. */
export interface FeedItem {
  id: string;
  type: UiComponentType;
  data: any;
  timestamp: string;
}

/**
 * Validate an untrusted candidate (LLM tool output, ingest payload, local
 * resolver result) against the contract. Returns the typed component or
 * null — the renderer must never see anything that fails this gate.
 */
export function validateUiComponent(candidate: unknown): UiComponent | null {
  if (typeof candidate !== 'object' || candidate === null) return null;
  const c = candidate as Record<string, unknown>;
  if (typeof c.type !== 'string') return null;
  if (!(UI_COMPONENT_TYPES as readonly string[]).includes(c.type)) return null;
  if (!('data' in c)) return null;
  return { type: c.type as UiComponentType, data: c.data };
}
