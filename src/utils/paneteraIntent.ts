const WORKSPACE_REQUEST = /\b(workspace|project|repo(?:sitory)?|file|folder|code|source|git|branch|commit|dependency|dependencies|import|todo|fixme|config|build|test|lint|diff|entry\s?point|package\.json|tsconfig|architecture of (?:this|the) (?:app|project|repo))\b/i;

export type ConversationRoute = 'general' | 'workspace';

export function resolveConversationRoute(
  message: string,
  context: { hasWorkspace: boolean; hasSelectedFile: boolean },
): ConversationRoute {
  const trimmed = message.trim();
  if (context.hasSelectedFile && /\b(this|selected|current)\b/i.test(trimmed)) return 'workspace';
  if (context.hasWorkspace && /^(explain|inspect|summarize|review)\s+(this|it)$/i.test(trimmed)) return 'workspace';
  if (WORKSPACE_REQUEST.test(trimmed)) return 'workspace';
  return 'general';
}
