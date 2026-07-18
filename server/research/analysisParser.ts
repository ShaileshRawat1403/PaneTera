import { CandidateResearchAnalysis, CandidateAnalysisClaim, CandidateAssessment, CandidateProvenanceRef } from "./analysisTypes";

const MAX_RAW_RESPONSE_BYTES = 256 * 1024;
const MAX_CLAIMS = 50;
const MAX_CLAIM_TEXT_LENGTH = 2000;
const MAX_REFERENCES_PER_CLAIM = 25;
const MAX_LIMITATIONS_PER_CLAIM = 10;
const MAX_LIMITATION_LENGTH = 1000;

export function parseStructuredOutput(rawOutput: string): CandidateResearchAnalysis {
  if (Buffer.byteLength(rawOutput, 'utf8') > MAX_RAW_RESPONSE_BYTES) {
    throw new Error(`Raw response exceeds maximum bytes limit (${MAX_RAW_RESPONSE_BYTES})`);
  }

  // Reject markdown code fences or commentary
  const trimmed = rawOutput.trim();
  if (trimmed.startsWith("```") || trimmed.endsWith("```")) {
    throw new Error("Raw output contains markdown fences. Expected pure JSON.");
  }
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    throw new Error("Raw output contains commentary. Expected pure JSON object.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid JSON: ${msg}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error("Parsed output is not an object.");
  }
  
  const parsedObj = parsed as Record<string, unknown>;

  if (parsedObj.schemaVersion !== "1.0") {
    throw new Error(`Unsupported schemaVersion: ${parsedObj.schemaVersion}`);
  }

  if (!Array.isArray(parsedObj.claims)) {
    throw new Error("Missing or invalid 'claims' array.");
  }

  if (parsedObj.claims.length > MAX_CLAIMS) {
    throw new Error(`Claims exceed maximum limit (${MAX_CLAIMS})`);
  }

  const seenClaimIds = new Set<string>();
  const claims: CandidateAnalysisClaim[] = [];

  for (const item of parsedObj.claims) {
    const c = item as Record<string, unknown>;
    if (!c.candidateClaimId || typeof c.candidateClaimId !== "string") {
      throw new Error("Invalid or missing candidateClaimId");
    }
    if (seenClaimIds.has(c.candidateClaimId)) {
      throw new Error(`Duplicate candidateClaimId: ${c.candidateClaimId}`);
    }
    seenClaimIds.add(c.candidateClaimId);

    if (!c.text || typeof c.text !== "string") {
      throw new Error(`Invalid or missing text for claim ${c.candidateClaimId}`);
    }
    if (c.text.length > MAX_CLAIM_TEXT_LENGTH) {
      throw new Error(`Claim text exceeds maximum length for claim ${c.candidateClaimId}`);
    }

    if (!["supported", "mixed", "insufficient", "unsupported"].includes(c.proposedAssessment as string)) {
      throw new Error(`Invalid proposedAssessment for claim ${c.candidateClaimId}: ${c.proposedAssessment}`);
    }

    const validateRefs = (refs: unknown, refType: string) => {
      if (!Array.isArray(refs)) throw new Error(`Missing or invalid ${refType} for claim ${c.candidateClaimId}`);
      if (refs.length > MAX_REFERENCES_PER_CLAIM) throw new Error(`${refType} exceeds maximum limit for claim ${c.candidateClaimId}`);
      const seen = new Set<string>();
      const parsedRefs: CandidateProvenanceRef[] = [];
      for (const item of refs) {
        const r = item as Record<string, unknown>;
        if (!r.snapshotEntryId || typeof r.snapshotEntryId !== "string") throw new Error(`Invalid snapshotEntryId in ${refType} for claim ${c.candidateClaimId}`);
        if (seen.has(r.snapshotEntryId)) throw new Error(`Duplicate reference ${r.snapshotEntryId} in ${refType} for claim ${c.candidateClaimId}`);
        seen.add(r.snapshotEntryId);
        parsedRefs.push({ snapshotEntryId: r.snapshotEntryId });
      }
      return { parsedRefs, seen };
    };

    const { parsedRefs: supportingReferences, seen: supportingSeen } = validateRefs(c.supportingReferences, "supportingReferences");
    const { parsedRefs: counterEvidenceReferences, seen: counterSeen } = validateRefs(c.counterEvidenceReferences, "counterEvidenceReferences");

    // Reject same reference in both lists
    for (const ref of counterEvidenceReferences) {
      if (supportingSeen.has(ref.snapshotEntryId)) {
        throw new Error(`Reference ${ref.snapshotEntryId} appears in both supporting and counter evidence for claim ${c.candidateClaimId}`);
      }
    }

    if (!Array.isArray(c.limitations)) {
      throw new Error(`Missing or invalid limitations array for claim ${c.candidateClaimId}`);
    }
    if (c.limitations.length > MAX_LIMITATIONS_PER_CLAIM) {
      throw new Error(`Limitations exceed maximum limit for claim ${c.candidateClaimId}`);
    }
    for (const l of c.limitations) {
      if (typeof l !== "string" || l.length > MAX_LIMITATION_LENGTH) {
        throw new Error(`Invalid or oversized limitation for claim ${c.candidateClaimId}`);
      }
    }

    claims.push({
      candidateClaimId: c.candidateClaimId as string,
      text: c.text as string,
      proposedAssessment: c.proposedAssessment as CandidateAssessment,
      supportingReferences,
      counterEvidenceReferences,
      limitations: c.limitations
    });
  }

  return {
    schemaVersion: "1.0",
    claims
  };
}
