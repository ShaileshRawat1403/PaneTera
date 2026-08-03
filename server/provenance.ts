// server/provenance.ts
//
// Option 2: provenance groundwork. This lays the plumbing for attributing a
// claim in the model's reply to the run events (mostly tool calls) that
// produced the evidence behind it, without any model-side generation yet.
// Nothing here changes what the user sees: `deriveProvenanceScaffold` always
// returns an empty attribution list. What is real is the candidate-source
// collection, so the shape is exercised end to end and a future pass can
// start filling `attributions` in without touching the transport or the
// run record again.

import type { AgentEvent } from './agent/types';

export interface ClaimAttribution {
  claimId: string;          // stable id for a claim span
  text: string;             // the claim text or a representative quote
  start?: number;           // optional char offset into the reply
  end?: number;             // optional char offset (exclusive)
  eventIds: string[];       // AgentEvent.eventId values that produced it
  capabilities?: string[];  // denormalized tool names for display
  confidence?: 'stated' | 'inferred';
}

export interface AnswerProvenance {
  runId: string;
  attributions: ClaimAttribution[];
}

// Gathers the tool.completed events that are candidate evidence sources for a
// reply: their eventIds and the (deduplicated) capability names that ran.
// Pure and defensive, since it reads persisted event data that may be
// malformed or missing fields from older runs.
export function collectCandidateSources(events: AgentEvent[]): { eventIds: string[]; capabilities: string[] } {
  const eventIds: string[] = [];
  const capabilities: string[] = [];
  const seenCapabilities = new Set<string>();

  if (!Array.isArray(events)) return { eventIds, capabilities };

  for (const event of events) {
    if (!event || typeof event !== 'object') continue;
    if (event.type !== 'tool.completed') continue;
    if (typeof event.eventId !== 'string' || !event.eventId) continue;

    eventIds.push(event.eventId);

    const capability = event.data?.capability;
    if (typeof capability === 'string' && capability && !seenCapabilities.has(capability)) {
      seenCapabilities.add(capability);
      capabilities.push(capability);
    }
  }

  return { eventIds, capabilities };
}

// Builds the (currently empty) provenance record for a completed run. The
// candidate sources are computed so the scaffold is real plumbing rather than
// a stub, but attributions stay empty until the model actually emits claims
// tied to evidence; wiring that up is a later, model-side change.
export function deriveProvenanceScaffold(runId: string, events: AgentEvent[], _reply: string): AnswerProvenance {
  // Computed for its side-effect-free validation value (never throws on junk
  // input) and as the seam a future claim-extraction pass will call into.
  collectCandidateSources(events);
  return {
    runId,
    attributions: [],
  };
}
