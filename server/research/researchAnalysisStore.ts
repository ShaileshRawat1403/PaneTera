import fs from 'fs';
import path from 'path';
import { getTesseraAppDataDir } from '../appData';
import { ResearchAnalysis } from './analysisTypes';
import { logAudit } from '../audit';

class AnalysisMutex {
  private queue: Map<string, Promise<void>> = new Map();

  async acquire(sessionId: string): Promise<() => void> {
    let release!: () => void;
    const p = new Promise<void>(resolve => {
      release = resolve;
    });

    const previous = this.queue.get(sessionId) || Promise.resolve();
    this.queue.set(sessionId, previous.then(() => p));
    
    await previous;
    return () => {
      if (this.queue.get(sessionId) === p) {
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

  private async atomicWriteJson(filePath: string, data: any): Promise<void> {
    const tempPath = `${filePath}.${Date.now()}.tmp`;
    
    return new Promise((resolve, reject) => {
      const content = JSON.stringify(data, null, 2);
      fs.writeFile(tempPath, content, { mode: 0o400 }, (err) => { // read-only (immutable)
        if (err) return reject(err);
        
        fs.rename(tempPath, filePath, (err) => {
          if (err) {
            fs.unlink(tempPath, () => {}); // cleanup on failure
            return reject(err);
          }
          resolve();
        });
      });
    });
  }

  public async getAnalysis(sessionId: string, analysisId: string): Promise<ResearchAnalysis | null> {
    const release = await this.mutex.acquire(sessionId);
    try {
      const p = this.getAnalysisFilePath(sessionId, analysisId);
      if (!fs.existsSync(p)) return null;
      const content = fs.readFileSync(p, 'utf8');
      const analysis: ResearchAnalysis = JSON.parse(content);
      
      if (analysis.analysisId !== analysisId || analysis.sessionId !== sessionId) {
        logAudit({
          operation: 'load_analysis_failure',
          status: 'corrupted',
          details: 'ID mismatch in analysis file',
          sessionId,
          analysisId
        });
        throw new Error('Corrupted analysis record');
      }
      return analysis;
    } catch (e: any) {
      logAudit({
        operation: 'load_analysis_failure',
        status: 'error',
        details: e.message,
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
          const analysis: ResearchAnalysis = JSON.parse(content);
          if (analysis.sessionId === sessionId) {
            analyses.push(analysis);
          }
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

export const researchAnalysisStore = new ResearchAnalysisStore();
