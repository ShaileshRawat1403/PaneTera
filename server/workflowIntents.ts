// server/workflowIntents.ts

export interface FlowrightWorkflowsIntent {
  kind: 'flowright-workflows';
}

export interface SoothsayerWorkflowsIntent {
  kind: 'soothsayer-workflows';
}

export interface ContentOpsDraftIntent {
  kind: 'contentops-draft';
  prompt: string;
  contentBrief?: string;
  siteGoal?: string;
}

export type WorkflowIntent = FlowrightWorkflowsIntent | SoothsayerWorkflowsIntent | ContentOpsDraftIntent;

export function parseWorkflowIntent(query: string): WorkflowIntent | null {
  const q = query.trim().toLowerCase();

  // 1. Flowright workflows patterns
  const flowrightPatterns = [
    /^show workflows$/,
    /^show flowright workflows$/,
    /^view workflows in flowright$/
  ];
  if (flowrightPatterns.some(p => p.test(q))) {
    return { kind: 'flowright-workflows' };
  }

  // 2. Soothsayer workflows patterns
  const soothsayerPatterns = [
    /^show soothsayer workflows$/,
    /^inspect soothsayer workflows$/,
    /^show soothsayer ui$/
  ];
  if (soothsayerPatterns.some(p => p.test(q))) {
    return { kind: 'soothsayer-workflows' };
  }

  // 3. ContentOps patterns
  const contentOpsPrefixes = [
    'write a blog',
    'draft a blog',
    'create content update',
    'write a post',
    'draft a content update'
  ];

  if (contentOpsPrefixes.some(prefix => q.startsWith(prefix))) {
    let contentBrief = query;
    if (q.startsWith('write a post about ')) {
      contentBrief = query.substring(19).trim();
    } else if (q.startsWith('write a blog post about ')) {
      contentBrief = query.substring(24).trim();
    } else if (q.startsWith('draft a blog post about ')) {
      contentBrief = query.substring(24).trim();
    } else if (q.startsWith('write a blog about ')) {
      contentBrief = query.substring(19).trim();
    } else if (q.startsWith('draft a blog about ')) {
      contentBrief = query.substring(19).trim();
    } else if (q.startsWith('draft a content update for ')) {
      contentBrief = query.substring(27).trim();
    } else if (q.startsWith('draft a content update ')) {
      contentBrief = query.substring(23).trim();
    } else if (q.startsWith('create a post about ')) {
      contentBrief = query.substring(20).trim();
    } else if (q.startsWith('write a post for ')) {
      contentBrief = query.substring(17).trim();
    }

    return {
      kind: 'contentops-draft',
      prompt: query,
      contentBrief,
      siteGoal: 'Publish new article or plant care update.'
    };
  }

  return null;
}
