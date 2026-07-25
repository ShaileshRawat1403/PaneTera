// server/tessera/evidenceResolver.ts
// Single source of truth for Tessera Evidence & Provenance Graph resolution
// per PHASE_2B_EVIDENCE_PROVENANCE_ARCHITECTURE.md.

import crypto from 'crypto';

export interface EvidenceItem {
  evidenceId: string;
  sourceType: 'browser-evidence' | 'workspace-evidence';
  title: string;
  urlOrPath: string;
  snippet: string;
  contentHash: string;
  lineRange?: { start: number; end: number };
  timestamp: string;
}

export interface ResearchSession {
  sessionId: string;
  title: string;
  workspaceId?: string;
  createdAt: string;
  updatedAt: string;
  evidenceItems: EvidenceItem[];
}

export interface AnalysisClaim {
  claimId: string;
  statement: string;
  status: 'verified' | 'conflicting' | 'unverified';
  evidenceRefs: string[];
  conflictReason?: string;
}

export interface ResearchAnalysis {
  analysisId: string;
  sessionId: string;
  title: string;
  claims: AnalysisClaim[];
  synthesizedMarkdown: string;
  contentHash: string;
  createdAt: string;
}

export class EvidenceGraphResolver {
  private sessions = new Map<string, ResearchSession>();
  private analyses = new Map<string, ResearchAnalysis>();

  createSession(title: string, workspaceId?: string): ResearchSession {
    const sessionId = `session_${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();
    const session: ResearchSession = {
      sessionId,
      title,
      workspaceId,
      createdAt: timestamp,
      updatedAt: timestamp,
      evidenceItems: [],
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): ResearchSession | undefined {
    return this.sessions.get(sessionId);
  }

  addEvidence(sessionId: string, item: Omit<EvidenceItem, 'evidenceId' | 'contentHash' | 'timestamp'>): EvidenceItem {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`ResearchSession ${sessionId} not found`);

    const timestamp = new Date().toISOString();
    const contentHash = crypto.createHash('sha256').update(`${item.urlOrPath}:${item.snippet}`).digest('hex');
    const evidenceId = `ev_${crypto.randomUUID()}`;

    const evidenceItem: EvidenceItem = {
      ...item,
      evidenceId,
      contentHash,
      timestamp,
    };

    session.evidenceItems.push(evidenceItem);
    session.updatedAt = timestamp;
    return evidenceItem;
  }

  detectConflictingClaims(session: ResearchSession): AnalysisClaim[] {
    const claims: AnalysisClaim[] = [];
    const webItems = session.evidenceItems.filter(e => e.sourceType === 'browser-evidence');
    const workspaceItems = session.evidenceItems.filter(e => e.sourceType === 'workspace-evidence');

    for (const webItem of webItems) {
      for (const wsItem of workspaceItems) {
        const webText = webItem.snippet.toLowerCase();
        const wsText = wsItem.snippet.toLowerCase();

        const commonWords = webText.split(/\s+/).filter(w => w.length >= 4 && wsText.includes(w));
        const isConflict = (webText.includes('not') || webText.includes('deprecated') || webText.includes('disabled')) &&
                           (wsText.includes('active') || wsText.includes('production') || wsText.includes('enabled'));

        if (commonWords.length >= 1) {
          claims.push({
            claimId: `claim_${crypto.randomUUID()}`,
            statement: `Web observation "${webItem.title}" references repository file "${wsItem.urlOrPath}".`,
            status: isConflict ? 'conflicting' : 'verified',
            evidenceRefs: [webItem.evidenceId, wsItem.evidenceId],
            ...(isConflict ? { conflictReason: 'Statement polarity mismatch between web source and workspace file' } : {}),
          });
        }
      }
    }

    if (claims.length === 0 && session.evidenceItems.length > 0) {
      for (const item of session.evidenceItems) {
        claims.push({
          claimId: `claim_${crypto.randomUUID()}`,
          statement: `Extracted fact from ${item.sourceType === 'browser-evidence' ? 'web' : 'workspace'}: ${item.title}`,
          status: 'verified',
          evidenceRefs: [item.evidenceId],
        });
      }
    }

    return claims;
  }

  synthesizeAnalysis(sessionId: string): ResearchAnalysis {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`ResearchSession ${sessionId} not found`);

    const claims = this.detectConflictingClaims(session);
    const createdAt = new Date().toISOString();
    const analysisId = `analysis_${crypto.randomUUID()}`;

    let md = `# Research Analysis Report: ${session.title}\n\n`;
    md += `**Session ID:** \`${session.sessionId}\`  \n`;
    md += `**Generated At:** ${createdAt}  \n`;
    md += `**Total Evidence Sources:** ${session.evidenceItems.length}\n\n`;

    md += `## 🔍 Key Findings & Verified Claims\n\n`;
    for (const claim of claims) {
      const badge = claim.status === 'verified' ? '✅ Verified' : claim.status === 'conflicting' ? '⚠️ Conflict Detected' : '❓ Unverified';
      md += `### ${badge}: ${claim.statement}\n`;
      if (claim.conflictReason) {
        md += `> **Conflict Reason:** ${claim.conflictReason}\n\n`;
      }
      md += `**Evidence References:**\n`;
      for (const refId of claim.evidenceRefs) {
        const item = session.evidenceItems.find(e => e.evidenceId === refId);
        if (item) {
          md += `- [${item.title}](${item.urlOrPath}) (SHA-256: \`${item.contentHash.slice(0, 16)}...\`)\n`;
        }
      }
      md += `\n`;
    }

    const contentHash = crypto.createHash('sha256').update(md).digest('hex');

    const analysis: ResearchAnalysis = {
      analysisId,
      sessionId,
      title: session.title,
      claims,
      synthesizedMarkdown: md,
      contentHash,
      createdAt,
    };

    this.analyses.set(analysisId, analysis);
    return analysis;
  }

  getAnalysis(analysisId: string): ResearchAnalysis | undefined {
    return this.analyses.get(analysisId);
  }
}
