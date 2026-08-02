// src/utils/claimProvenance.ts
//
// Client-side half of the provenance groundwork (see server/provenance.ts).
// Dormant plumbing: nothing renders this yet. A future hover affordance on a
// claim in the transcript can call `selectAttributionForClaim` to look up the
// events that produced it, once the model actually emits claim ids.
//
// Types are mirrored rather than imported from the server, since client code
// does not import server modules.

export interface ClaimAttribution {
  claimId: string;
  text: string;
  start?: number;
  end?: number;
  eventIds: string[];
  capabilities?: string[];
  confidence?: 'stated' | 'inferred';
}

export interface AnswerProvenance {
  runId: string;
  attributions: ClaimAttribution[];
}

// Finds the attribution for a given claim id, or null when there is no
// provenance record, no attributions, or no match. Defensive against
// malformed input so a bad run record cannot throw inside a render path.
export function selectAttributionForClaim(
  provenance: AnswerProvenance | null | undefined,
  claimId: string,
): ClaimAttribution | null {
  if (!provenance || !Array.isArray(provenance.attributions)) return null;
  if (!claimId) return null;
  return provenance.attributions.find((attribution) => attribution?.claimId === claimId) ?? null;
}
