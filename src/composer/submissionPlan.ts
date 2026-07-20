// src/composer/submissionPlan.ts
// Turns a resolved submission into an executable plan.
//
// This is the execution boundary. Everything the app is allowed to do with a
// submission is decided here, in a pure function, so that the resolver's
// readiness invariant is enforced rather than merely declared.
//
// Two rules the app cannot bypass, because it never sees the envelope directly:
//
//   1. A non-ready envelope never reaches a backend. needs-approval,
//      needs-context, needs-clarification, and needs-capability all produce a
//      'blocked' plan carrying the reason.
//   2. Every family that reaches a backend has an explicit case here. There is
//      no default that quietly forwards an unhandled family to chat.

import type { IntentEnvelope } from './intentTypes';
import type { ContextItem } from './contextTypes';

export interface SubmissionInput {
  intent: IntentEnvelope;
  context: readonly ContextItem[];
  material: Readonly<Record<string, string>>;
}

/** Locator-level description of an attached item. Carries no content. */
export interface ContextDescriptor {
  id: string;
  kind: string;
  label: string;
  locator: string;
  workspaceId?: string;
  access: string;
  materialization: string;
}

export type SubmissionPlan =
  | { kind: 'blocked'; reason: string; readiness: IntentEnvelope['readiness'] }
  | { kind: 'web-open'; url: string; label: string }
  | { kind: 'web-close' }
  | { kind: 'web-reload' }
  | { kind: 'select-project'; target: string }
  | { kind: 'open-live-app'; target: string }
  | { kind: 'clear-context' }
  | {
      kind: 'chat';
      endpoint: 'orchestrator' | 'general';
      /** Message text as sent, including any attached material block. */
      message: string;
      /** Exactly what the user typed, for display and transcript purposes. */
      rawInput: string;
      /** Resolved family, so the consumer can tag the reply without
       *  reclassifying. */
      intentFamily: IntentEnvelope['family'];
      context: ContextDescriptor[];
      material: Record<string, string>;
    };

export function describeContext(items: readonly ContextItem[]): ContextDescriptor[] {
  return items.map((item) => ({
    id: item.id,
    kind: item.kind,
    label: item.label,
    locator: item.source.locator,
    workspaceId: item.source.workspaceId,
    access: item.access,
    materialization: item.materialization.mode,
  }));
}

/**
 * Render attached material into the outgoing message.
 *
 * PROVISIONAL, AND NOT A TRUST BOUNDARY.
 *
 * Every context item records `authority: 'none'`, but this function flattens
 * material into the same user-message channel that carries instructions. The
 * delimiters below are a *label*, not an isolation mechanism. A model may or
 * may not honour them, and nothing here enforces that it does.
 *
 * Delimiters are escaped so attached text cannot close or forge a block, which
 * removes the structural break but does not create separation. Real separation
 * needs a distinct channel, most likely a system-level instruction naming the
 * boundary, and belongs to the Headroom envelope stage where the trust model is
 * defined rather than improvised.
 *
 * Until then, this makes "included in next message" true, and claims nothing
 * further.
 */
export function buildMaterialBlock(
  items: readonly ContextItem[],
  material: Readonly<Record<string, string>>,
): string | null {
  const blocks: string[] = [];
  for (const item of items) {
    const body = material[item.id];
    if (typeof body !== 'string' || !body) continue;
    blocks.push(
      `<attached-context trust="untrusted" authority="none" kind="${escapeAttr(item.kind)}" label="${escapeAttr(item.label)}">\n${escapeBody(body)}\n</attached-context>`,
    );
  }
  if (blocks.length === 0) return null;
  return blocks.join('\n');
}

/**
 * Neutralise anything that could close or forge a delimiter.
 *
 * This prevents a structural break. It does not prevent the content from being
 * read as instruction, which no amount of escaping can.
 */
function escapeBody(value: string): string {
  // Quotes are escaped as well as angle brackets. Escaping `<` alone already
  // prevents a forged tag from parsing, but leaves readable text like
  // trust="trusted" sitting in the body, which is needless noise inside a block
  // whose whole purpose is to label trust.
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** References contribute their identity, never their contents. */
export function buildReferenceBlock(items: readonly ContextItem[]): string | null {
  const references = items.filter((item) => item.materialization.mode === 'reference');
  if (references.length === 0) return null;
  const lines = references.map(
    (item) => `- ${escapeBody(item.kind)}: ${escapeBody(item.source.locator)}`,
  );
  return `<attached-references trust="untrusted" note="named only, contents not included">\n${lines.join('\n')}\n</attached-references>`;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function planSubmission(input: SubmissionInput): SubmissionPlan {
  const { intent, context, material } = input;

  // Rule 1. Nothing that is not ready proceeds, whatever the family.
  if (intent.readiness !== 'ready') {
    return {
      kind: 'blocked',
      readiness: intent.readiness,
      reason: intent.missing[0]?.prompt ?? 'That is not ready to run.',
    };
  }

  const action = intent.args.action;

  switch (intent.family) {
    case 'web-surface': {
      if (action === 'close') return { kind: 'web-close' };
      if (action === 'reload') return { kind: 'web-reload' };
      if (intent.args.url && intent.args.label) {
        return { kind: 'web-open', url: intent.args.url, label: intent.args.label };
      }
      // Ready but without a URL should be unreachable; treat as blocked rather
      // than falling through to a chat call that would look like success.
      return {
        kind: 'blocked',
        readiness: intent.readiness,
        reason: 'Which page should I open?',
      };
    }

    case 'project': {
      if (!intent.args.target) {
        return { kind: 'blocked', readiness: intent.readiness, reason: 'Which project?' };
      }
      return { kind: 'select-project', target: intent.args.target };
    }

    case 'live-app': {
      if (!intent.args.target) {
        return { kind: 'blocked', readiness: intent.readiness, reason: 'Which application?' };
      }
      return { kind: 'open-live-app', target: intent.args.target };
    }

    case 'headroom': {
      if (action === 'clear') return { kind: 'clear-context' };
      return {
        kind: 'blocked',
        readiness: intent.readiness,
        reason: 'The Headroom surface is not built yet.',
      };
    }

    case 'artifact':
    case 'converse': {
      const parts = [intent.rawInput];
      const references = buildReferenceBlock(context);
      const attached = buildMaterialBlock(context, material);
      if (references) parts.push(references);
      if (attached) parts.push(attached);

      return {
        kind: 'chat',
        endpoint: intent.family === 'artifact' ? 'orchestrator' : 'general',
        message: parts.join('\n\n'),
        rawInput: intent.rawInput,
        intentFamily: intent.family,
        context: describeContext(context),
        material: { ...material },
      };
    }

    // No default. Every family that can reach a backend is named above, so a
    // new family fails the type check here rather than silently becoming chat.
    case 'run':
    case 'proposal':
    case 'rig':
    case 'evidence':
      return {
        kind: 'blocked',
        readiness: intent.readiness,
        reason: 'That surface is not connected yet.',
      };
  }
}
