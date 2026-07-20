// src/composer/naturalLanguageSelectors.ts
// Deterministic natural-language selectors for the dual-door families.
//
// These are deliberately anchored to the start of the input and deliberately
// narrow. AGENTS.md records the failure they must avoid: real work prompts like
// "check my commit for regressions" being swallowed by local matchers. A loose
// keyword matcher that fires on the word "run" anywhere in a sentence would
// reintroduce exactly that.
//
// Every selector here must satisfy: if it fires, the user's leading verb was
// unambiguous. Where it does not fire, the input falls through to conversation,
// which is the safe direction to fail.

export interface SelectorMatch {
  /** The remainder after the matched verb phrase, trimmed. */
  target: string;
}

/**
 * Matchers are anchored with ^ and require the verb phrase to be followed by
 * either end-of-input or whitespace, so "running total of expenses" does not
 * match "run".
 */
const RUN_PHRASE = /^(?:run|execute|start)\s+(.+)$/i;
const PROJECT_PHRASE =
  /^(?:(?:switch|change)\s+to\s+(?:the\s+)?project|open\s+(?:the\s+)?project|choose\s+(?:the\s+)?project|resume\s+(?:the\s+)?project|use\s+(?:the\s+)?project)\s+(.+)$/i;
const INSPECT_PHRASE = /^(?:inspect|examine)\s+(.+)$/i;

/**
 * Phrases that look like a run request but are questions about running, not
 * requests to run. Checked first so that "how do I run the tests" stays
 * conversational.
 */
const INTERROGATIVE = /^(?:how|why|what|when|where|who|can|could|should|would|does|do|is|are)\b/i;

function match(pattern: RegExp, input: string): SelectorMatch | null {
  if (INTERROGATIVE.test(input)) return null;
  const found = input.match(pattern);
  const target = found?.[1]?.trim();
  return target ? { target } : null;
}

export function matchRunPhrase(input: string): SelectorMatch | null {
  return match(RUN_PHRASE, input);
}

export function matchProjectPhrase(input: string): SelectorMatch | null {
  return match(PROJECT_PHRASE, input);
}

export function matchInspectPhrase(input: string): SelectorMatch | null {
  return match(INSPECT_PHRASE, input);
}

/**
 * Families with both a slash door and a natural-language door.
 *
 * Documented here rather than in prose so the equivalence claim in
 * COMPOSER_CONTEXT_CONTRACT.md has a machine-checkable counterpart. A family
 * absent from this list is reachable by slash only, and the contract says so
 * instead of implying a symmetry that does not exist.
 */
export const DUAL_DOOR_FAMILIES = ['web-surface', 'run', 'project', 'artifact'] as const;
