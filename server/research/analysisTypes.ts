export type CandidateAssessment = "supported" | "mixed" | "insufficient" | "unsupported";

export interface CandidateProvenanceRef {
  snapshotEntryId: string;
}

export interface CandidateAnalysisClaim {
  candidateClaimId: string;
  text: string;
  proposedAssessment: CandidateAssessment;
  supportingReferences: CandidateProvenanceRef[];
  counterEvidenceReferences: CandidateProvenanceRef[];
  limitations: string[];
}

export interface CandidateResearchAnalysis {
  schemaVersion: "1.0";
  claims: CandidateAnalysisClaim[];
}

// Validated Contracts

export type ClaimValidationStatus = "validated" | "validated-with-warnings" | "blocked";
export type ProvenanceStatus = "resolved" | "partially-resolved" | "unresolved";
export type AnalysisStatus = "completed" | "completed-with-warnings" | "rejected";

export interface ValidatedProvenanceRef {
  snapshotEntryId: string;
  resolved: boolean;
}

export interface ClaimValidationFailure {
  type: string;
  message: string;
  snapshotEntryId?: string;
}

export interface AnalysisClaim {
  claimId: string;
  text: string;
  proposedAssessment: CandidateAssessment;
  validationStatus: ClaimValidationStatus;
  provenanceStatus: ProvenanceStatus;
  supportingReferences: ValidatedProvenanceRef[];
  counterEvidenceReferences: ValidatedProvenanceRef[];
  limitations: string[];
  validationFailures: ClaimValidationFailure[];
}

export interface ProvenanceValidationSummary {
  totalReferences: number;
  resolvedReferences: number;
  unresolvedReferences: number;
  claimsBlocked: number;
  warnings: string[];
}

export interface AnalysisWarning {
  type: string;
  message: string;
}

export interface ResearchAnalysis {
  analysisId: string;
  ownerId: string;
  sessionId: string;
  snapshotId: string;
  snapshotContentHash: string;
  schemaVersion: "1.0";
  createdAt: string;
  generator: {
    type: "mock" | "llm" | "human";
    provider?: string;
    model?: string;
    promptVersion: string;
  };
  status: AnalysisStatus;
  claims: AnalysisClaim[];
  validationSummary: ProvenanceValidationSummary;
  warnings: AnalysisWarning[];
}
