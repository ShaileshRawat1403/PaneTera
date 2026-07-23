import { v4 as uuidv4 } from 'uuid';
import { ResearchSession, ResearchSessionSnapshot, ResearchSessionSnapshotEntry } from './researchTypes';
import { researchSessionStore } from './researchSessionStore';
import { evidenceRetentionService } from '../evidence/evidenceRetentionService';
import { evidenceGraphResolver } from '../evidence/evidenceGraphResolver';
import { toCanonicalEvidenceText, hashCanonicalText } from '../evidence/evidenceCanonicalizer';
import { createHash } from 'crypto';
import { auditResearchOperator, auditResearchSystem } from './researchAudit';

export class ResearchSessionService {
  public async createSession(ownerId: string, title: string, description?: string): Promise<ResearchSession> {
    if (title.length > 200) throw new Error('Title exceeds 200 characters');
    if (description && description.length > 2000) throw new Error('Description exceeds 2000 characters');

    const session: ResearchSession = {
      sessionId: uuidv4(),
      ownerId,
      title,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      sourceCount: 0,
      warnings: []
    };

    await researchSessionStore.saveSession(session);
    auditResearchOperator({ event: 'research.session.create', outcome: 'success', sessionId: session.sessionId, ownerId });
    return session;
  }

  public async getSession(sessionId: string): Promise<ResearchSession | null> {
    return researchSessionStore.getSession(sessionId);
  }

  public async archiveSession(ownerId: string, sessionId: string): Promise<void> {
    const session = await researchSessionStore.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.ownerId !== ownerId) throw new Error('Unauthorised');
    
    session.status = 'archived';
    session.updatedAt = new Date().toISOString();
    await researchSessionStore.saveSession(session);
    auditResearchOperator({ event: 'research.session.archive', outcome: 'success', sessionId, ownerId });
  }

  public async deleteSession(ownerId: string, sessionId: string): Promise<void> {
    const session = await researchSessionStore.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.ownerId !== ownerId) throw new Error('Unauthorised');

    await researchSessionStore.deleteSession(sessionId);
    auditResearchOperator({ event: 'research.session.delete', outcome: 'success', sessionId, ownerId });
  }

  public async createSnapshot(
    ownerId: string, 
    sessionId: string, 
    evidenceRefs: Array<{ captureId: string, extractionId: string, evidenceId: string }>
  ): Promise<ResearchSessionSnapshot> {
    const session = await researchSessionStore.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.ownerId !== ownerId) throw new Error('Unauthorised');
    if (evidenceRefs.length > 25) throw new Error('Maximum sources per session is 25');

    // Acquire transient leases for all evidence refs
    const leaseRefs = evidenceRefs.flatMap(ref => [
      { type: 'captureId' as const, id: ref.captureId },
      { type: 'extractionId' as const, id: ref.extractionId },
      { type: 'evidenceId' as const, id: ref.evidenceId }
    ]);

    return evidenceRetentionService.withEvidenceLeases(leaseRefs, async () => {
      const entries: ResearchSessionSnapshotEntry[] = [];
      let totalBytes = 0;
      let hasBrokenEvidence = false;
      
      const seenHashes = new Map<string, string>(); // contentHash -> snapshotEntryId

      for (let i = 0; i < evidenceRefs.length; i++) {
        const ref = evidenceRefs[i];
        const resolution = evidenceGraphResolver.resolve(ownerId, ref.captureId, ref.extractionId, ref.evidenceId);
        
        if (resolution.status !== 'resolved') {
          auditResearchSystem({
            event: 'research.snapshot.evidence-rejected',
            outcome: resolution.status === 'unauthorised' ? 'denied' : 'error',
            policyDecision: resolution.status === 'unauthorised' ? 'denied' : 'allowed',
            sessionId,
            details: { status: resolution.status },
          });
          hasBrokenEvidence = true;
          continue; // Skip broken or unauthorized evidence
        }
        
        const { capture, extraction, evidence } = resolution;
        const canonicalText = toCanonicalEvidenceText(evidence!);
        const integrity = hashCanonicalText(canonicalText);
        
        if (integrity.contentBytes > 100 * 1024) {
          throw new Error(`Entry exceeds maximum excerpt size of 100KB: ${ref.evidenceId}`);
        }
        totalBytes += integrity.contentBytes;
        if (totalBytes > 1024 * 1024) {
          throw new Error('Snapshot total excerpt size exceeds 1MB');
        }

        const snapshotEntryId = uuidv4();
        let duplicateOfSnapshotEntryId: string | undefined;

        if (seenHashes.has(integrity.contentHash)) {
          duplicateOfSnapshotEntryId = seenHashes.get(integrity.contentHash);
        } else {
          seenHashes.set(integrity.contentHash, snapshotEntryId);
        }

        entries.push({
          snapshotEntryId,
          position: i,
          sourceType: 'browser-evidence',
          captureId: ref.captureId,
          extractionId: ref.extractionId,
          evidenceId: ref.evidenceId,
          sourceTitle: extraction!.source.title,
          sourceUri: extraction!.source.url,
          sourceOrigin: extraction!.source.origin,
          capturedAt: extraction!.source.capturedAt,
          excerpt: canonicalText,
          integrity,
          ownership: evidence!.ownership,
          trust: evidence!.trust,
          duplicateOfSnapshotEntryId
        });
      }

      const snapshotId = uuidv4();
      
      // We will define version using timestamp or an internal counter. For simplicity, we just increment current session version if we had one.
      // Wait, researchSessionStore uses a specific pattern: it reads the version, we can just use a simple monotonic time or a counter.
      // I will just use 1 for Phase 2B.1 or read the snapshots directory. Let's just use a simple counter attached to session.
      const version = Date.now();

      // Deterministic Manifest Hash
      const manifest = {
        schemaVersion: "1.0",
        sessionId,
        version,
        entries: entries.map(e => ({
          position: e.position,
          snapshotEntryId: e.snapshotEntryId,
          captureId: e.captureId,
          extractionId: e.extractionId,
          evidenceId: e.evidenceId,
          contentHash: e.integrity.contentHash,
          ownerId: e.ownership.ownerId,
          trust: e.trust
        }))
      };

      const manifestBuffer = Buffer.from(JSON.stringify(manifest), 'utf8');
      const manifestHash = createHash('sha256').update(manifestBuffer).digest('hex');

      const snapshot: ResearchSessionSnapshot = {
        snapshotId,
        sessionId,
        schemaVersion: "1.0",
        version,
        createdAt: new Date().toISOString(),
        entries,
        snapshotIntegrity: {
          hashAlgorithm: 'sha256',
          canonicalizationVersion: 'text-v1',
          contentHash: manifestHash,
          contentBytes: manifestBuffer.length
        }
      };

      await researchSessionStore.saveSnapshot(session, snapshot);

      session.sourceCount = entries.length;
      session.status = hasBrokenEvidence ? 'partial' : 'ready';
      await researchSessionStore.saveSession(session);

      auditResearchSystem({
        event: 'research.snapshot.create', outcome: 'success', sessionId, ownerId,
        details: { snapshotId, entryCount: entries.length, partial: hasBrokenEvidence },
      });
      return snapshot;
    });
  }
}

export const researchSessionService = new ResearchSessionService();
