// server/operatorContext.ts
//
// Turns the durable Headroom context into a bounded text block the chat
// operator can work from, so the operator reasons over goals, decisions, and
// open questions rather than raw transcript alone.
//
// Pure and store-free so it is unit-testable; the caller supplies the capsules.

import type { HeadroomCapsule } from './headroom/store';

// Keep the injected block bounded regardless of capsule size.
const MAX_ITEMS_PER_LIST = 12;
const MAX_BLOCK_CHARS = 4000;

/**
 * Pick the capsule that represents the current working context: the most
 * recently updated one. Returns null if there are none.
 */
export function selectActiveCapsule(capsules: HeadroomCapsule[]): HeadroomCapsule | null {
  if (!capsules || capsules.length === 0) return null;
  return capsules
    .slice()
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0];
}

function bulletList(label: string, items: string[]): string | null {
  const clean = (items || []).map((s) => String(s).trim()).filter(Boolean).slice(0, MAX_ITEMS_PER_LIST);
  if (clean.length === 0) return null;
  return `${label}:\n- ${clean.join('\n- ')}`;
}

/**
 * Format one capsule into a labeled context block, or an empty string if it
 * carries nothing worth injecting. Labeled clearly so the operator treats it as
 * durable working context, not as instructions.
 */
export function formatHeadroomContext(capsule: HeadroomCapsule | null): string {
  if (!capsule) return '';

  const sections: string[] = [];
  if (capsule.objective && capsule.objective.trim()) {
    sections.push(`Objective: ${capsule.objective.trim()}`);
  }
  const decisions = bulletList('Decisions', capsule.decisions);
  if (decisions) sections.push(decisions);
  const assumptions = bulletList('Assumptions', capsule.assumptions);
  if (assumptions) sections.push(assumptions);
  const open = bulletList('Unresolved questions', capsule.unresolvedQuestions);
  if (open) sections.push(open);
  const changed = bulletList('Changed understanding', capsule.changedUnderstanding);
  if (changed) sections.push(changed);

  if (sections.length === 0) return '';

  const title = (capsule.title && capsule.title.trim()) || capsule.capsuleId;
  const block = `[HEADROOM CONTEXT — active capsule "${title}"]\n${sections.join('\n')}`;
  return block.length > MAX_BLOCK_CHARS ? `${block.slice(0, MAX_BLOCK_CHARS)}\n…(truncated)` : block;
}

/** Convenience: select the active capsule and format it in one step. */
export function headroomContextBlock(capsules: HeadroomCapsule[]): string {
  return formatHeadroomContext(selectActiveCapsule(capsules));
}
