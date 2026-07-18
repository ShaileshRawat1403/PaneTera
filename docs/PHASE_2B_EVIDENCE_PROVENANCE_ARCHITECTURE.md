---
title: Phase 2B Evidence and Provenance Integrity
archetype: explanation
status: draft
owner: Shailesh Rawat
maintainer: Shailesh Rawat
version: 0.1.0
tags:
  - tessera
  - browser-operator
  - evidence
  - provenance
  - research
  - orchestration
last_reviewed: 2026-07-17
---

# 1. EVIDENCE GRAPH

## Graph Definition
The authoritative evidence graph conceptually links source and derived analysis:
*   `Capture` → `ExtractionResult` → `EvidenceItem`
*   `ResearchSession` → `ResearchSessionSnapshot` → selected `EvidenceItem`s and `WorkspaceEvidenceRef`s
*   `ResearchAnalysis` → `AnalysisClaim` → `ProvenanceRef` → `ResearchSessionSnapshot` entry

## EvidenceGraphResolver
An `EvidenceGraphResolver` service must be implemented to act as the single source of truth for graph resolution.
It will be responsible for:
*   Resolving complete capture chains (Capture → Extraction → EvidenceItem).
*   Resolving workspace evidence.
*   Validating ownership matching between the requester, the session, and the evidence items.
*   Validating trust metadata boundaries.
*   Validating content hashes against current stores.
*   Validating text and line ranges within canonical bounds.
*   Detecting missing, expired, or pruned nodes.
*   Returning explicit structured resolution failures (e.g., `invalid-range`, `hash-mismatch`, `broken-parent`).

This logic will strictly remain in this core service and will NOT be duplicated across UI components, prompts, MCP registries, or model adapters. Missing or unauthorised references will respond with a non-disclosing 404 (unavailable) externally, while the audit layer logs the exact structured reason.

# 2. STABLE EVIDENCE IDENTITY

## Retention Pinning & Snapshot Model
To preserve stable citation targets, a Research Session records an immutable snapshot manifest whenever an analysis is generated. 
Analyses cite the `snapshotEntryId` instead of live mutable positions.

```typescript
interface ResearchSessionSnapshotEntry {
  snapshotEntryId: string;
  sourceType: "browser-evidence" | "workspace-evidence";
  captureId?: string;
  extractionId?: string;
  evidenceId?: string;
  workspaceId?: string;
  relativePath?: string;
  contentHash: string;
  textRange?: {
    start: number;
    end: number;
  };
  lineRange?: {
    start: number;
    end: number;
  };
  sourceTitle: string;
  sourceUri: string;
  capturedAt: string;
  trust: EvidenceTrust;
}
```

*   **Hashes:** Calculated (e.g., SHA-256) over the canonical text content of the extraction or workspace file at the time of snapshot creation.
*   **Ranges:** Coordinates map strictly to the canonical hashed text.
*   **Retention Pins:** The presence of a `snapshotEntryId` signals to the retention layer that the referenced evidence must not be evicted.
*   **Deletion:** When a session is archived/deleted, its retention pin is released.
*   **Modifications:** Generating new analyses or adding sources results in a *new* snapshot version. Old analyses remain tied to their original snapshot version.
*   **Absolute Paths:** Strictly forbidden; workspace relative paths are mapped securely via the `WorkspaceReader`.

# 3. RESEARCH SESSION MODEL

`ResearchSession` groups evidence selections but never contains generated analysis text itself.

```typescript
interface ResearchSession {
  sessionId: string;
  ownerId: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  status: "draft" | "ready" | "partial" | "archived";
  currentSnapshotId: string;
  sourceCount: number;
  warnings: ResearchWarning[];
}

interface ResearchSessionSnapshot {
  snapshotId: string;
  sessionId: string;
  version: number;
  createdAt: string;
  entries: ResearchSessionSnapshotEntry[];
  snapshotHash: string;
}
```

*   **Explicit Selection:** Sources are added explicitly; no background tab monitoring.
*   **Duplication:** The resolver rejects identical hashes across the same snapshot.
*   **Readiness:** Broken references immediately revert the status from `ready` to `partial`.

# 4. WORKSPACE EVIDENCE MODEL

Browser and workspace evidence are resolved uniformly without merging their distinct trust characteristics.

```typescript
interface WorkspaceEvidenceRef {
  workspaceEvidenceId: string;
  ownerId: string;
  workspaceId: string;
  relativePath: string;
  contentHash: string;
  lineRange?: {
    start: number;
    end: number;
  };
  inspectedAt: string;
  sourceType: "workspace-file";
  trustLevel: "local-approved-source";
  instructionAuthority: "none";
}
```

*   **Bounded Snapshots:** We will store a bounded excerpt snapshot to preserve citation stability, avoiding full-file duplication while guaranteeing the citation text never silently changes if the workspace file mutates.
*   **No Absolute Paths:** Always uses workspace-relative paths.

# 5. RESEARCH ANALYSIS MODEL

A separate, derived artifact representing an interpretation of a session's snapshot.

```typescript
interface ResearchAnalysis {
  analysisId: string;
  ownerId: string;
  sessionId: string;
  snapshotId: string;
  createdAt: string;
  generator: AnalysisGenerator;
  status: "draft" | "validating" | "completed" | "completed-with-warnings" | "rejected";
  claims: AnalysisClaim[];
  relationships: ClaimRelationship[];
  warnings: AnalysisWarning[];
  validationSummary: ProvenanceValidationSummary;
}

interface AnalysisGenerator {
  type: "llm" | "deterministic" | "human";
  provider?: string;
  model?: string;
  promptVersion?: string;
}

interface AnalysisClaim {
  claimId: string;
  text: string;
  assessment: "supported" | "mixed" | "insufficient" | "unsupported";
  provenance: ProvenanceRef[];
  counterEvidence: ProvenanceRef[];
  limitations: string[];
}

interface ProvenanceRef {
  snapshotEntryId: string;
  evidenceId?: string;
  workspaceEvidenceId?: string;
  relevantRange?: {
    start: number;
    end: number;
  };
}
```

*   Raw model outputs undergo a structural and deterministic schema validation before persistence.
*   Supported claims absolutely require resolved provenance. 
*   If provenance fails, the claim drops to `unsupported` and blocks `completed` status.

# 6. ANALYSIS GENERATION PIPELINE

1.  **Request:** Research Session snapshot requested for analysis.
2.  **Pack:** A bounded evidence pack is created containing excerpts and entry IDs.
3.  **Provide:** LLM is invoked with strict structured-output schemas.
4.  **Validate Schema:** Structure is checked.
5.  **Resolve Provenance:** LLM-proposed citation entry IDs are resolved against the snapshot.
6.  **Persist:** Successfully validated Analysis is written.
7.  **Audit:** The attempt, its policies, and rejection/success metrics are recorded.

# 7. CLAIM RELATIONSHIPS AND CONFLICTS

```typescript
interface ClaimRelationship {
  relationshipId: string;
  claimId: string;
  relatedClaimId?: string;
  type: "supports" | "contradicts" | "different-scope" | "supersedes" | "duplicates" | "insufficient-overlap";
  provenance: ProvenanceRef[];
  explanation: string;
}
```
Distinctions between contradictions and mere scoping/date differences will be explicitly supported to avoid false binary assessments. Source capture dates are always provided to the provider and UI to enable timeline detection.

# 8. PROVENANCE VALIDATION SERVICE

The central clearinghouse for checking references. It strictly does NOT use an LLM.

```typescript
interface ProvenanceValidationResult {
  valid: boolean;
  status: ProvenanceStatus;
  resolvedSource?: ResolvedEvidenceSource;
  warnings: string[];
}

interface ProvenanceValidationSummary {
  totalReferences: number;
  resolvedReferences: number;
  unresolvedReferences: number;
  claimsBlocked: number;
  warnings: string[];
}
```

Checks ownership, valid hashes, canonical ranges, unbroken parent capture lineage, and overlapping duplicate references.

# 9. API AND SERVICE BOUNDARIES

```text
POST   /api/research/sessions
GET    /api/research/sessions
GET    /api/research/sessions/:sessionId
PATCH  /api/research/sessions/:sessionId
POST   /api/research/sessions/:sessionId/snapshots
POST   /api/research/sessions/:sessionId/analyses
GET    /api/research/analyses/:analysisId
GET    /api/research/provenance/:snapshotEntryId
DELETE /api/research/sessions/:sessionId
```
All routes authenticate via existing token mechanisms, verify `ownerId` boundaries, limit payload sizes, and return obfuscated safe errors (404/403) externally while logging specifics via `logAudit`.

# 10. UI/UX DESIGN

Key concepts:
*   **ResearchSessionBuilder:** Modal to assemble evidence into a session.
*   **ResearchAnalysisView / ClaimAssessmentBadge:** Displays claims with clear visual indicators of their support level (Supported, Mixed, Unsupported).
*   **ProvenanceDrawer:** A clickable drawer showing the exact text excerpt matching the citation, the source URI (browser) or relative path (workspace), capture time, and explicitly rendering the Trust Metadata (`untrusted`, `none`).

# 11. ORCHESTRATOR INTEGRATION

New intents to support:
*   `create_research_session`
*   `summarize_research_session`
*   `compare_browser_sources`
*   `compare_source_to_workspace`
*   `identify_agreements`
*   `identify_disagreements`
*   `inspect_claim_provenance`

Orchestrator prompts never instruct the LLM to write directly to evidence records or ignore validation states.

# 12. AUDIT MODEL

Events:
*   `research.session.create`, `update`, `archive`, `delete`
*   `research.snapshot.create`
*   `research.analysis.request`, `generate`, `validate`, `reject`
*   `research.provenance.resolve`, `fail`

Audit schema omits all sensitive contents (no excerpts, absolute paths, or tokens) and records the `actor`, `policyDecision`, `status`, `ownerId`, and transaction tracing IDs.

# 13. RETENTION AND DELETION

*   Browser evidence pinned by an active session snapshot cannot be garbage collected.
*   Deleting a session releases its pin.
*   Workspaces changes generate a drift warning if the new hash deviates from the snapshot hash, but the stored bounded excerpt ensures the citation points to the text that was actually analyzed.
*   Total bounds cap maximum references and payload extraction bytes.

# 14. SECURITY AND THREAT MODEL

*   **Spoofing / Invented Citations:** Detected by `ProvenanceValidationService` resolving strictly against the snapshot. Analysis is rejected.
*   **Workspace Path Substitution:** Bounded by `WorkspaceReader` segment-aware isolation; resolved paths must reside inside the root.
*   **Cross-owner Sessions:** Enforced by principal subjectId assertions during every query.
*   **Prompt Injection in Evidence:** The provider is fed explicit instruction blocks isolating evidence text as untrusted string literals. UI extracts raw text, bypassing DOM injection risks.

# 15. TEST PLAN

*   **Evidence Graph:** Test missing parents, broken hashes, unauthorized requests.
*   **Research Sessions:** Versioning snapshots, partial status blocks, cross-owner denials.
*   **Research Analysis:** Mock provider generating supported/mixed/unsupported claims, malformed schema rejection, hallucinated citation rejection.
*   **Workspace Comparison:** Changes to host files, path traversal rejection.

# 16. PHASE 2B ACCEPTANCE FLOW

1. Capture three browser sources (A, B, C) and select one approved workspace file.
2. Create session and snapshot.
3. Resolve chains and generate Analysis (Mock).
4. Validate a supported claim, a mixed claim, and an unsupported claim.
5. Identify one scope difference.
6. Click claim citation to view excerpt, trust, and metadata.
7. Inject a broken reference deliberately to test failure paths.
8. Assert audit trails.

# 17. FIRST IMPLEMENTATION SLICE (PHASE 2B.1)

**Slice Recommendation: EVIDENCE GRAPH AND PROVENANCE RESOLVER**

*Scope:* 
*   `ResearchSession`, `ResearchSessionSnapshot`, `ResearchSessionSnapshotEntry` models.
*   `EvidenceGraphResolver` and `ProvenanceValidationService`.
*   Retention pins mechanism.
*   No LLM generation, no UI, no workspace integration yet.

*Why:* Validates the foundational deterministic resolution and retention mechanics before introducing non-deterministic provider models or front-end dependencies.
