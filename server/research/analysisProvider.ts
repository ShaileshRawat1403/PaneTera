import { EvidencePack } from "./evidencePackBuilder";

export interface CandidateAnalysisRequest {
  transactionId: string;
  ownerId: string;
  sessionId: string;
  snapshotId: string;
  evidencePack: EvidencePack;
  serializedEvidencePack: string;
  outputSchemaVersion: "1.0";
}

export interface CandidateAnalysisResponse {
  rawOutput: string;
  providerMetadata: {
    provider: string;
    model?: string;
    promptVersion: string;
  };
}

export interface CandidateAnalysisProvider {
  readonly providerId: string;
  generateCandidate(request: CandidateAnalysisRequest): Promise<CandidateAnalysisResponse>;
}

export class MockAnalysisProvider implements CandidateAnalysisProvider {
  readonly providerId = "mock-provider-v1";

  async generateCandidate(request: CandidateAnalysisRequest): Promise<CandidateAnalysisResponse> {
    const rawJSON = JSON.stringify({
      schemaVersion: "1.0",
      claims: [
        {
          candidateClaimId: "claim-mock-1",
          text: "Mock supported claim.",
          proposedAssessment: "supported",
          supportingReferences: request.evidencePack.entries.length > 0 
            ? [{ snapshotEntryId: request.evidencePack.entries[0].snapshotEntryId }] 
            : [],
          counterEvidenceReferences: [],
          limitations: []
        },
        {
          candidateClaimId: "claim-mock-2",
          text: "Mock mixed claim.",
          proposedAssessment: "mixed",
          supportingReferences: request.evidencePack.entries.length > 0 
            ? [{ snapshotEntryId: request.evidencePack.entries[0].snapshotEntryId }] 
            : [],
          counterEvidenceReferences: request.evidencePack.entries.length > 1 
            ? [{ snapshotEntryId: request.evidencePack.entries[1].snapshotEntryId }] 
            : [],
          limitations: []
        },
        {
          candidateClaimId: "claim-mock-3",
          text: "Mock insufficient claim.",
          proposedAssessment: "insufficient",
          supportingReferences: [],
          counterEvidenceReferences: [],
          limitations: ["Not enough data"]
        },
        {
          candidateClaimId: "claim-mock-4",
          text: "Mock invented reference claim.",
          proposedAssessment: "supported",
          supportingReferences: [{ snapshotEntryId: "invented-reference-id" }],
          counterEvidenceReferences: [],
          limitations: []
        }
      ]
    }, null, 2);

    return {
      rawOutput: rawJSON,
      providerMetadata: {
        provider: this.providerId,
        model: "mock-model",
        promptVersion: "1.0"
      }
    };
  }
}
