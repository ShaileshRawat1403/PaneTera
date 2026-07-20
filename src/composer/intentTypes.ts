// src/composer/intentTypes.ts
// Canonical intent vocabulary for PaneTera's single resolver.
//
// See docs/COMPOSER_CONTEXT_CONTRACT.md. Both natural language and `/` actions
// compile to IntentEnvelope through one resolver. The `+` attachment menu does
// NOT route through here: it produces ContextItem records (see contextTypes.ts).

/**
 * The ten canonical families from PANETERA_WORKSTATION_CONTRACT.md. Exactly
 * ten. Composer-local behaviours such as help are expressed as an `action`
 * within a family, never as an eleventh family, so that the canonical
 * vocabulary does not drift because the UI needed something.
 */
export type IntentFamily =
  | 'converse'      // converse or explain generally
  | 'project'       // choose, resume, or inspect a project
  | 'web-surface'   // open, reload, close, or externalise a web surface
  | 'live-app'      // open a registered live application
  | 'artifact'      // render or inspect an artifact
  | 'evidence'      // inspect evidence or changed understanding
  | 'run'           // start, observe, or stop a bounded run
  | 'proposal'      // propose, approve, reject, or verify an action
  | 'rig'           // configure or inspect the Rig
  | 'headroom';     // inspect or refresh Headroom, including clearing context

export type Readiness =
  | 'ready'
  | 'needs-clarification'
  | 'needs-context'
  | 'needs-capability'
  | 'needs-approval';

/**
 * How the family was determined.
 *
 * `model-classifier` is declared but not produced in the composer-foundation
 * slice, which has no backend classification. Declaring it keeps the audit
 * field stable when classification arrives.
 */
export type AssertedBy = 'user-slash' | 'deterministic-matcher' | 'model-classifier';

export type MissingKind =
  | 'url'
  | 'project'
  | 'target'
  | 'capability'
  | 'approval'
  | 'context-item';

export interface MissingRequirement {
  kind: MissingKind;
  /** Smallest useful clarification, per the intent contract. */
  prompt: string;
}

export type CanvasSurface =
  | 'web-preview'
  | 'live-app'
  | 'artifact'
  | 'evidence'
  | 'proposal'
  | 'rig'
  | 'headroom'
  | 'conversation';

/**
 * Normalised arguments. These are semantic, not syntactic: `/open <url>` and
 * `open <url>` must produce the same IntentArgs, so the raw text a user typed
 * lives on the envelope rather than in here.
 */
export interface IntentArgs {
  url?: string;
  label?: string;
  target?: string;
  action?: string;
}

export interface IntentEnvelope {
  family: IntentFamily;
  readiness: Readiness;
  assertedBy: AssertedBy;
  /** null when assertedBy is 'user-slash': the user asserted, we did not guess. */
  confidence: number | null;
  missing: MissingRequirement[];
  surface: CanvasSurface | null;
  args: IntentArgs;
  /**
   * Exactly what the user typed. Provenance, not decision input. Two envelopes
   * are equivalent when everything except assertedBy, confidence, and rawInput
   * matches, since those three are precisely the record of which door was used.
   */
  rawInput: string;
}

/** The decision-bearing fields, for equivalence checking. */
export type IntentDecision = Omit<IntentEnvelope, 'assertedBy' | 'confidence' | 'rawInput'>;

export function intentDecision(envelope: IntentEnvelope): IntentDecision {
  const { assertedBy: _a, confidence: _c, rawInput: _r, ...decision } = envelope;
  return decision;
}
