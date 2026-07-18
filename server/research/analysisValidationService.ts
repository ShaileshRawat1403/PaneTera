import { logAudit } from "../audit";
import { ProvenanceValidationService } from "./provenanceValidationService";
import { ResearchSessionSnapshot, ProvenanceStatus } from "./researchTypes";
import { buildEvidencePack, serializeEvidencePackForProvider } from "./evidencePackBuilder";
import { CandidateAnalysisProvider, CandidateAnalysisRequest } from "./analysisProvider";
import { parseStructuredOutput } from "./analysisParser";
import { researchAnalysisStore } from "./researchAnalysisStore";
import { 
  ResearchAnalysis, 
  AnalysisClaim, 
  ClaimValidationFailure, 
  ValidatedProvenanceRef,
  ProvenanceValidationSummary
} from "./analysisTypes";
import crypto from "crypto";

export class AnalysisValidationService {
  constructor(
    private provenanceService: ProvenanceValidationService,
    private provider: CandidateAnalysisProvider
  ) {}

  public async generateAnalysis(
    ownerId: string,
    sessionId: string,
    snapshot: ResearchSessionSnapshot,
    transactionId: string
  ): Promise<ResearchAnalysis> {
    const analysisId = crypto.randomUUID();

    logAudit({
      operation: "research.analysis.request",
      ownerId,
      sessionId,
      snapshotId: snapshot.snapshotId,
      transactionId,
      status: "started"
    });

    let pack;
    try {
      pack = buildEvidencePack(snapshot);
      logAudit({ operation: "research.analysis.pack.build", sessionId, snapshotId: snapshot.snapshotId, status: "success" });
    } catch (e: any) {
      logAudit({ operation: "research.analysis.pack.build", sessionId, snapshotId: snapshot.snapshotId, status: "error", details: e.message });
      throw e;
    }

    const serializedPack = serializeEvidencePackForProvider(pack);
    const request: CandidateAnalysisRequest = {
      transactionId,
      ownerId,
      sessionId,
      snapshotId: snapshot.snapshotId,
      evidencePack: pack,
      serializedEvidencePack: serializedPack,
      outputSchemaVersion: "1.0"
    };

    let providerResponse;
    try {
      providerResponse = await this.provider.generateCandidate(request);
      logAudit({ operation: "research.analysis.provider.invoke", sessionId, providerId: this.provider.providerId, status: "success" });
    } catch (e: any) {
      logAudit({ operation: "research.analysis.provider.invoke", sessionId, providerId: this.provider.providerId, status: "error", details: e.message });
      this.rejectAnalysis(ownerId, sessionId, snapshot, "Provider failure: " + e.message, analysisId);
      throw e;
    }

    let parsedCandidate;
    try {
      parsedCandidate = parseStructuredOutput(providerResponse.rawOutput);
      logAudit({ operation: "research.analysis.parse", sessionId, status: "success", candidateClaimCount: parsedCandidate.claims.length });
    } catch (e: any) {
      logAudit({ operation: "research.analysis.parse", sessionId, status: "error", details: e.message });
      this.rejectAnalysis(ownerId, sessionId, snapshot, "Parse failure: " + e.message, analysisId);
      throw e;
    }

    const validatedClaims: AnalysisClaim[] = [];
    const summary: ProvenanceValidationSummary = {
      totalReferences: 0,
      resolvedReferences: 0,
      unresolvedReferences: 0,
      claimsBlocked: 0,
      warnings: []
    };

    for (const candidate of parsedCandidate.claims) {
      const failures: ClaimValidationFailure[] = [];
      const supportingRefs: ValidatedProvenanceRef[] = [];
      const counterRefs: ValidatedProvenanceRef[] = [];

      let claimResolvedRefs = 0;
      let claimUnresolvedRefs = 0;

      const checkRefs = (refs: { snapshotEntryId: string }[], targetList: ValidatedProvenanceRef[]) => {
        for (const ref of refs) {
          summary.totalReferences++;
          const result = this.provenanceService.validateReference(ownerId, snapshot, ref.snapshotEntryId);
          if (result.valid) {
            targetList.push({ snapshotEntryId: ref.snapshotEntryId, resolved: true });
            claimResolvedRefs++;
            summary.resolvedReferences++;
          } else {
            targetList.push({ snapshotEntryId: ref.snapshotEntryId, resolved: false });
            claimUnresolvedRefs++;
            summary.unresolvedReferences++;
            failures.push({
              type: "provenance_failure",
              message: `Reference ${ref.snapshotEntryId} is invalid: ${result.status}`,
              snapshotEntryId: ref.snapshotEntryId
            });
          }
        }
      };

      checkRefs(candidate.supportingReferences, supportingRefs);
      checkRefs(candidate.counterEvidenceReferences, counterRefs);

      let provStatus: "resolved" | "partially-resolved" | "unresolved" = "resolved";
      if (claimUnresolvedRefs > 0) {
        provStatus = claimResolvedRefs > 0 ? "partially-resolved" : "unresolved";
      }

      let valStatus: "validated" | "validated-with-warnings" | "blocked" = "validated";
      const totalRefs = claimResolvedRefs + claimUnresolvedRefs;

      if (claimUnresolvedRefs > 0) {
        valStatus = "blocked";
        failures.push({ type: "structural_failure", message: "Claim contains unresolved references." });
      }

      if (valStatus !== "blocked") {
        if (candidate.proposedAssessment === "supported") {
          if (supportingRefs.length === 0) {
            valStatus = "blocked";
            failures.push({ type: "structural_failure", message: "Supported claim requires at least one resolved supporting reference." });
          } else if (counterRefs.length > 0 && candidate.limitations.length === 0) {
            valStatus = "validated-with-warnings";
            summary.warnings.push(`Claim ${candidate.candidateClaimId} has counter-evidence but no explicit limitations.`);
          }
        } else if (candidate.proposedAssessment === "mixed") {
          if (supportingRefs.length === 0 || counterRefs.length === 0) {
            valStatus = "blocked";
            failures.push({ type: "structural_failure", message: "Mixed claim requires both supporting and counter references." });
          }
        } else if (candidate.proposedAssessment === "insufficient") {
          if (totalRefs === 0 && candidate.limitations.length === 0) {
            valStatus = "blocked";
            failures.push({ type: "structural_failure", message: "Insufficient claim with zero references requires an explicit limitation." });
          }
        }
      }

      if (valStatus === "blocked") {
        summary.claimsBlocked++;
        logAudit({ operation: "research.claim.block", sessionId, claimId: candidate.candidateClaimId });
      } else {
        logAudit({ operation: "research.claim.validate", sessionId, claimId: candidate.candidateClaimId, validationStatus: valStatus });
      }

      validatedClaims.push({
        claimId: candidate.candidateClaimId,
        text: candidate.text,
        proposedAssessment: candidate.proposedAssessment,
        validationStatus: valStatus,
        provenanceStatus: provStatus,
        supportingReferences: supportingRefs,
        counterEvidenceReferences: counterRefs,
        limitations: candidate.limitations,
        validationFailures: failures
      });
    }

    let finalStatus: "completed" | "completed-with-warnings" | "rejected" = "completed";
    const nonBlockedClaims = validatedClaims.filter(c => c.validationStatus !== "blocked");
    
    if (nonBlockedClaims.length === 0) {
      finalStatus = "rejected";
    } else if (summary.claimsBlocked > 0 || nonBlockedClaims.some(c => c.validationStatus === "validated-with-warnings") || summary.warnings.length > 0) {
      finalStatus = "completed-with-warnings";
    }

    const analysis: ResearchAnalysis = {
      analysisId,
      ownerId,
      sessionId,
      snapshotId: snapshot.snapshotId,
      snapshotContentHash: snapshot.snapshotIntegrity.contentHash,
      schemaVersion: "1.0",
      createdAt: new Date().toISOString(),
      generator: {
        type: providerResponse.providerMetadata.provider === "mock-provider-v1" ? "mock" : "llm",
        provider: providerResponse.providerMetadata.provider,
        model: providerResponse.providerMetadata.model,
        promptVersion: providerResponse.providerMetadata.promptVersion
      },
      status: finalStatus,
      claims: validatedClaims,
      validationSummary: summary,
      warnings: summary.warnings.map(w => ({ type: "validation_warning", message: w }))
    };

    await researchAnalysisStore.saveAnalysis(analysis);

    if (finalStatus === "rejected") {
      logAudit({ operation: "research.analysis.reject", sessionId, analysisId, status: "rejected" });
    } else if (finalStatus === "completed-with-warnings") {
      logAudit({ operation: "research.analysis.complete_with_warnings", sessionId, analysisId, status: "completed-with-warnings" });
    } else {
      logAudit({ operation: "research.analysis.complete", sessionId, analysisId, status: "completed" });
    }

    return analysis;
  }

  private rejectAnalysis(ownerId: string, sessionId: string, snapshot: ResearchSessionSnapshot, reason: string, analysisId: string) {
    logAudit({
      operation: "research.analysis.reject",
      ownerId,
      sessionId,
      snapshotId: snapshot.snapshotId,
      analysisId,
      status: "rejected",
      details: reason
    });
  }
}
