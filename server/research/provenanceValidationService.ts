import { researchSessionStore } from './researchSessionStore';
import { ProvenanceValidationResult } from './researchTypes';
import { hashCanonicalText } from '../evidence/evidenceCanonicalizer';
import { auditResearchSystem } from './researchAudit';

export class ProvenanceValidationService {
  public async validateSnapshotReference(
    principalOwnerId: string,
    sessionId: string,
    snapshotId: string,
    snapshotEntryId: string,
    version: number
  ): Promise<ProvenanceValidationResult> {
    const session = await researchSessionStore.getSession(sessionId);
    if (!session) {
      return { valid: false, status: 'missing', warnings: [] };
    }

    if (session.ownerId !== principalOwnerId) {
      auditResearchSystem({
        event: 'research.provenance.validation', outcome: 'denied', policyDecision: 'denied', sessionId,
        ownerId: principalOwnerId, details: { status: 'ownership-denied' },
      });
      return { valid: false, status: 'unauthorised', warnings: [] };
    }

    const snapshot = await researchSessionStore.getSnapshot(sessionId, snapshotId, version);
    if (!snapshot) {
      return { valid: false, status: 'missing', warnings: [] };
    }

    const entry = snapshot.entries.find(e => e.snapshotEntryId === snapshotEntryId);
    if (!entry) {
      return { valid: false, status: 'missing', warnings: [] };
    }

    // Recompute excerpt hash
    const currentHash = hashCanonicalText(entry.excerpt);
    if (currentHash.contentHash !== entry.integrity.contentHash) {
      auditResearchSystem({
        event: 'research.provenance.validation', outcome: 'error', sessionId,
        details: { status: 'integrity-failure', snapshotEntryId },
      });
      return { valid: false, status: 'integrity-failure', warnings: ['Excerpt integrity check failed'] };
    }

    if (entry.duplicateOfSnapshotEntryId) {
      return { 
        valid: true, 
        status: 'resolved', 
        snapshotEntry: entry, 
        warnings: ['Reference points to a duplicate entry'] 
      };
    }

    return { valid: true, status: 'resolved', snapshotEntry: entry, warnings: [] };
  }
}

export const provenanceValidationService = new ProvenanceValidationService();
