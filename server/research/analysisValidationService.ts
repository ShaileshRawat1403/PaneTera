import { auditResearchOperator, auditResearchSystem } from "./researchAudit";
import { ProvenanceValidationService } from "./provenanceValidationService";
import { ResearchSessionSnapshot, ProvenanceStatus } from "./researchTypes";
import { buildEvidencePack, serializeEvidencePackForProvider } from "./evidencePackBuilder";
import { CandidateAnalysisProvider, CandidateAnalysisRequest } from "./analysisProvider";
import { parseStructuredOutput } from "./analysisParser";
import { researchAnalysisStore, ResearchAnalysisStore } from "./researchAnalysisStore";
import {
  ResearchAnalysis,
  AnalysisClaim,
  ClaimValidationFailure,
  ValidatedProvenanceRef,
  ProvenanceValidationSummary
} from "./analysisTypes";
import crypto from "crypto";

export class AnalysisValidationService {
  private idempotencyMap = new Map<string, Promise<ResearchAnalysis>>();

  constructor(
    private provenanceService: ProvenanceValidationService,
    private provider: CandidateAnalysisProvider,
    private store: ResearchAnalysisStore = researchAnalysisStore
  ) {}

  public async generateAnalysis(
    ownerId: string,
    sessionId: string,
    snapshot: ResearchSessionSnapshot,
    transactionId: string
  ): Promise<ResearchAnalysis> {
    const operation = "generateAnalysis";
    const providerId = this.provider.providerId;
    const promptVersion = this.provider.promptVersion;

    const idempotencyKey = crypto
      .createHash("sha256")
      .update(`${ownerId}:${sessionId}:${snapshot.snapshotId}:${operation}:${providerId}:${promptVersion}`)
      .digest("hex");

    // Deterministic analysisId allows durable idempotency lookup across restarts
    const analysisId = crypto.createHash("sha256").update(idempotencyKey).digest("hex");

    // 1. Check persistent store
    const existing = await this.store.getAnalysis(sessionId, analysisId);
    if (existing) {
      auditResearchOperator({
        event: 'research.analysis.request', outcome: 'success', sessionId, ownerId,
        details: { status: 'idempotency-hit-store', analysisId },
      });
      return existing;
    }

    // 2. Check in-flight map
    if (this.idempotencyMap.has(idempotencyKey)) {
      auditResearchOperator({
        event: 'research.analysis.request', outcome: 'pending', sessionId, ownerId,
        details: { status: 'idempotency-hit-inflight', analysisId },
      });
      return this.idempotencyMap.get(idempotencyKey)!;
    }

    const analysisPromise = (async () => {
      auditResearchOperator({
        event: 'research.analysis.request', outcome: 'pending', sessionId, ownerId,
        details: { snapshotId: snapshot.snapshotId, clientTransactionId: transactionId, status: 'started' },
      });

      let pack;
      try {
        pack = buildEvidencePack(snapshot);
        auditResearchSystem({
          event: 'research.analysis.pack.build', outcome: 'success', sessionId,
          details: { snapshotId: snapshot.snapshotId },
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        auditResearchSystem({
          event: 'research.analysis.pack.build', outcome: 'error', sessionId,
          details: { snapshotId: snapshot.snapshotId, error: msg },
        });
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
      auditResearchSystem({
        event: 'research.analysis.provider.invoke', outcome: 'success', sessionId,
        details: { providerId: this.provider.providerId },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      auditResearchSystem({
        event: 'research.analysis.provider.invoke', outcome: 'error', sessionId,
        details: { providerId: this.provider.providerId, error: msg },
      });
      this.rejectAnalysis(ownerId, sessionId, snapshot, "Provider failure: " + msg, analysisId);
      throw e;
    }

    let parsedCandidate;
    try {
      parsedCandidate = parseStructuredOutput(providerResponse.rawOutput);
      auditResearchSystem({
        event: 'research.analysis.parse', outcome: 'success', sessionId,
        details: { candidateClaimCount: parsedCandidate.claims.length },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      auditResearchSystem({ event: 'research.analysis.parse', outcome: 'error', sessionId, details: { error: msg } });
      this.rejectAnalysis(ownerId, sessionId, snapshot, "Parse failure: " + msg, analysisId);
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

      const checkRefs = async (refs: { snapshotEntryId: string }[], targetList: ValidatedProvenanceRef[]) => {
        for (const ref of refs) {
          summary.totalReferences++;
          const result = await this.provenanceService.validateSnapshotReference(
            ownerId,
            sessionId,
            snapshot.snapshotId,
            ref.snapshotEntryId,
            snapshot.version
          );
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

      await checkRefs(candidate.supportingReferences, supportingRefs);
      await checkRefs(candidate.counterEvidenceReferences, counterRefs);

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
        auditResearchSystem({
          event: 'research.claim.blocked', outcome: 'success', sessionId,
          details: { claimId: candidate.candidateClaimId, validationStatus: valStatus },
        });
      } else {
        auditResearchSystem({
          event: 'research.claim.validated', outcome: 'success', sessionId,
          details: { claimId: candidate.candidateClaimId, validationStatus: valStatus },
        });
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

    await this.store.saveAnalysis(analysis);

    if (finalStatus === "rejected") {
      auditResearchSystem({
        event: 'research.analysis.completed', outcome: 'success', sessionId,
        details: { analysisId, analysisStatus: 'rejected' },
      });
    } else if (finalStatus === "completed-with-warnings") {
      auditResearchSystem({
        event: 'research.analysis.completed', outcome: 'success', sessionId,
        details: { analysisId, analysisStatus: 'completed-with-warnings' },
      });
    } else {
      auditResearchSystem({
        event: 'research.analysis.completed', outcome: 'success', sessionId,
        details: { analysisId, analysisStatus: 'completed' },
      });
    }

    return analysis;
    })();

    this.idempotencyMap.set(idempotencyKey, analysisPromise);

    // Ensure cleanup of the in-flight map once resolved/rejected
    analysisPromise.catch(() => {}).finally(() => {
      if (this.idempotencyMap.get(idempotencyKey) === analysisPromise) {
        this.idempotencyMap.delete(idempotencyKey);
      }
    });

    return analysisPromise;
  }

  private rejectAnalysis(ownerId: string, sessionId: string, snapshot: ResearchSessionSnapshot, reason: string, analysisId: string) {
    auditResearchSystem({
      event: 'research.analysis.failed', outcome: 'error', sessionId, ownerId,
      details: { snapshotId: snapshot.snapshotId, analysisId, error: reason },
    });
  }
}
