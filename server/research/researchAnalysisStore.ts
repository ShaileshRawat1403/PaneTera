import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getTesseraAppDataDir } from '../appData';
import { ResearchAnalysis, AnalysisClaim, ValidatedProvenanceRef, ClaimValidationFailure } from './analysisTypes';
import { logAudit } from '../audit';
import { researchSessionStore } from './researchSessionStore';

export async function validateResearchAnalysis(
  data: any, 
  expectedSessionId: string, 
  expectedAnalysisId?: string
): Promise<void> {
  if (!data || typeof data !== 'object') throw new Error('Data is not an object');
  if (data.schemaVersion !== "1.0") throw new Error('Unsupported schemaVersion');
  
  if (typeof data.ownerId !== 'string') throw new Error('Missing or invalid ownerId');
  if (data.sessionId !== expectedSessionId) throw new Error('Session ID mismatch');
  if (expectedAnalysisId && data.analysisId !== expectedAnalysisId) throw new Error('Analysis ID mismatch');
  
  if (typeof data.snapshotId !== 'string') throw new Error('Missing snapshotId');
  if (typeof data.snapshotContentHash !== 'string') throw new Error('Missing snapshotContentHash');
  
  if (!data.generator || typeof data.generator !== 'object') throw new Error('Missing generator object');
  if (!['mock', 'llm', 'human'].includes(data.generator.type)) throw new Error('Invalid generator type');
  if (typeof data.generator.promptVersion !== 'string') throw new Error('Invalid promptVersion');
  
  if (!['completed', 'completed-with-warnings', 'rejected'].includes(data.status)) throw new Error('Invalid status');
  
  if (!Array.isArray(data.claims)) throw new Error('Claims must be an array');
  
  for (const claim of data.claims) {
    if (typeof claim.claimId !== 'string') throw new Error('Invalid claimId');
    if (typeof claim.text !== 'string') throw new Error('Invalid claim text');
    if (!['supported', 'mixed', 'insufficient', 'unsupported'].includes(claim.proposedAssessment)) throw new Error('Invalid proposedAssessment');
    if (!['validated', 'validated-with-warnings', 'blocked'].includes(claim.validationStatus)) throw new Error('Invalid validationStatus');
    if (!['resolved', 'partially-resolved', 'unresolved'].includes(claim.provenanceStatus)) throw new Error('Invalid provenanceStatus');
    
    const checkRefs = (refs: any) => {
      if (!Array.isArray(refs)) throw new Error('References must be an array');
      for (const r of refs) {
        if (typeof r.snapshotEntryId !== 'string' || typeof r.resolved !== 'boolean') throw new Error('Invalid reference');
      }
    };
    checkRefs(claim.supportingReferences);
    checkRefs(claim.counterEvidenceReferences);
    
    if (!Array.isArray(claim.limitations)) throw new Error('Limitations must be an array');
    if (!Array.isArray(claim.validationFailures)) throw new Error('ValidationFailures must be an array');
  }

  if (!data.validationSummary || typeof data.validationSummary !== 'object') throw new Error('Missing validationSummary');
  if (typeof data.validationSummary.totalReferences !== 'number') throw new Error('Invalid validationSummary');
  if (!Array.isArray(data.validationSummary.warnings)) throw new Error('validationSummary.warnings must be an array');
  if (!Array.isArray(data.warnings)) throw new Error('warnings must be an array');
  
  // Cross-reference checks
  const session = await researchSessionStore.getSession(expectedSessionId);
  if (!session) throw new Error(`Session ${expectedSessionId} not found`);
  if (session.ownerId !== data.ownerId) throw new Error('Owner ID mismatch with session');
  
  const snapshot = await researchSessionStore.getSnapshotById(expectedSessionId, data.snapshotId);
  if (!snapshot) throw new Error(`Snapshot ${data.snapshotId} not found in session`);
  if (snapshot.snapshotIntegrity.contentHash !== data.snapshotContentHash) throw new Error('Snapshot contentHash mismatch');
}

class AnalysisMutex {
  private queue: Map<string, Promise<void>> = new Map();

  async acquire(sessionId: string): Promise<() => void> {
    let release!: () => void;
    const p = new Promise<void>(resolve => {
      release = resolve;
    });

    const previous = this.queue.get(sessionId) || Promise.resolve();
    const next = previous.then(() => p);
    this.queue.set(sessionId, next);
    
    await previous;
    return () => {
      if (this.queue.get(sessionId) === next) {
        this.queue.delete(sessionId);
      }
      release();
    };
  }
}

export class ResearchAnalysisStore {
  private baseDir: string;
  private mutex = new AnalysisMutex();

  constructor() {
    const appData = getTesseraAppDataDir();
    this.baseDir = path.join(appData, 'research', 'sessions');
  }

  private getSessionDir(sessionId: string): string {
    if (!/^[a-zA-Z0-9-]+$/.test(sessionId)) {
      throw new Error('Invalid session ID');
    }
    return path.join(this.baseDir, sessionId);
  }

  private getAnalysisDir(sessionId: string): string {
    return path.join(this.getSessionDir(sessionId), 'analyses');
  }

  private getAnalysisFilePath(sessionId: string, analysisId: string): string {
    if (!/^[a-zA-Z0-9-]+$/.test(analysisId)) {
      throw new Error('Invalid analysis ID');
    }
    return path.join(this.getAnalysisDir(sessionId), `${analysisId}.json`);
  }

  private async atomicWriteJson<T>(filePath: string, data: T): Promise<void> {
    const tempPath = `${filePath}.${crypto.randomBytes(8).toString('hex')}.tmp`;
    
    const content = JSON.stringify(data, null, 2);
    // 0o400 is meant to be read-only (immutable). On Windows this may not be fully enforced,
    // but the logical check in saveAnalysis prevents overwriting anyway.
    await fs.promises.writeFile(tempPath, content, { mode: 0o400 });
    
    try {
      await fs.promises.rename(tempPath, filePath);
    } catch (err: unknown) {
      await fs.promises.unlink(tempPath).catch(() => {}); // cleanup on failure
      throw err;
    }
  }

  public async getAnalysis(sessionId: string, analysisId: string): Promise<ResearchAnalysis | null> {
    const release = await this.mutex.acquire(sessionId);
    try {
      const p = this.getAnalysisFilePath(sessionId, analysisId);
      if (!fs.existsSync(p)) return null;
      const content = fs.readFileSync(p, 'utf8');
      const analysisData = JSON.parse(content);
      
      await validateResearchAnalysis(analysisData, sessionId, analysisId);
      
      return analysisData as ResearchAnalysis;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logAudit({
        operation: 'load_analysis_failure',
        status: 'error',
        details: msg,
        sessionId,
        analysisId
      });
      throw e;
    } finally {
      release();
    }
  }

  public async saveAnalysis(analysis: ResearchAnalysis): Promise<void> {
    const release = await this.mutex.acquire(analysis.sessionId);
    try {
      const dir = this.getAnalysisDir(analysis.sessionId);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      
      const p = this.getAnalysisFilePath(analysis.sessionId, analysis.analysisId);
      if (fs.existsSync(p)) {
        throw new Error('Analysis record is immutable and already exists');
      }

      await this.atomicWriteJson(p, analysis);
    } finally {
      release();
    }
  }

  public async getAnalysesForSession(sessionId: string): Promise<ResearchAnalysis[]> {
    const release = await this.mutex.acquire(sessionId);
    try {
      const dir = this.getAnalysisDir(sessionId);
      if (!fs.existsSync(dir)) return [];
      
      const files = fs.readdirSync(dir);
      const analyses: ResearchAnalysis[] = [];
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const p = path.join(dir, file);
        try {
          const content = fs.readFileSync(p, 'utf8');
          const analysisData = JSON.parse(content);
          await validateResearchAnalysis(analysisData, sessionId);
          analyses.push(analysisData as ResearchAnalysis);
        } catch (e) {
          // Skip corrupted ones, log it
          logAudit({
            operation: 'load_analysis_failure',
            status: 'corrupted',
            details: `Failed to parse ${file}`,
            sessionId
          });
        }
      }
      return analyses;
    } finally {
      release();
    }
  }
}

export let researchAnalysisStore = new ResearchAnalysisStore();

export function resetResearchAnalysisStoreForTest(): void {
  researchAnalysisStore = new ResearchAnalysisStore();
}
