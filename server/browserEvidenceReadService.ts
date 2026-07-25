import { browserEvidenceStore } from './browserEvidenceStore';
import { ObservationItem, ExtractionResult, EvidenceItem } from './evidence/evidenceTypes';
import { McpClientPrincipal } from './mcp/browserMcpAuth';

export class UnauthorizedAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedAccessError";
  }
}

export class BrowserEvidenceReadService {
  private authorizeEvidenceRead(principal: McpClientPrincipal, resource: any): void {
    if (!resource || !resource.ownership) {
      throw new Error("Resource missing ownership");
    }
    // Simplest boundary for V0: subjectId must match the evidence ownerId
    if (principal.subjectId !== resource.ownership.ownerId) {
      throw new UnauthorizedAccessError(`Client ${principal.clientId} subject ${principal.subjectId} is not authorized to read resource owned by ${resource.ownership.ownerId}`);
    }
  }

  public getObservations(principal: McpClientPrincipal, after?: string): ObservationItem[] {
    return browserEvidenceStore.getObservations(after).filter(obs => {
      try {
        this.authorizeEvidenceRead(principal, obs);
        return true;
      } catch (e) {
        return false;
      }
    });
  }

  public getExtractions(principal: McpClientPrincipal, after?: string): ExtractionResult[] {
    return browserEvidenceStore.getExtractions(after).filter(ext => {
      try {
        this.authorizeEvidenceRead(principal, ext);
        return true;
      } catch (e) {
        return false;
      }
    });
  }

  public getCapture(principal: McpClientPrincipal, captureId: string): ObservationItem | undefined {
    const obs = browserEvidenceStore.getObservationByCaptureId(captureId);
    if (!obs) return undefined;
    this.authorizeEvidenceRead(principal, obs);
    return obs;
  }

  public getExtraction(principal: McpClientPrincipal, id: string): ExtractionResult | undefined {
    const ext = browserEvidenceStore.getExtractionById(id);
    if (!ext) return undefined;
    this.authorizeEvidenceRead(principal, ext);
    return ext;
  }
  
  public getEvidenceItem(principal: McpClientPrincipal, evidenceId: string): EvidenceItem | undefined {
    const extractions = browserEvidenceStore.getExtractions();
    for (const ext of extractions) {
      if (ext.evidence?.items) {
        const item = ext.evidence.items.find((i: any) => i.evidenceId === evidenceId);
        if (item) {
          this.authorizeEvidenceRead(principal, item);
          return item;
        }
      }
    }
    return undefined;
  }
  
  public getPaginatedCaptures(principal: McpClientPrincipal, limit: number, offset: number): ObservationItem[] {
    const sorted = [...browserEvidenceStore.getObservations()].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
    const filtered = sorted.filter(obs => {
      try {
        this.authorizeEvidenceRead(principal, obs);
        return true;
      } catch (e) {
        return false;
      }
    });
    return filtered.slice(offset, offset + limit);
  }
  
  public getStats(principal: McpClientPrincipal) {
    const obs = this.getObservations(principal);
    const ext = this.getExtractions(principal);
    return {
      captureCount: obs.length,
      extractionCount: ext.length
    };
  }

  public getRecentExtractions(principal: McpClientPrincipal, limit: number = 10): ExtractionResult[] {
    const allExtractions = this.getExtractions(principal);
    // Return most recent, newest first
    return allExtractions
      .slice(-limit)
      .reverse();
  }
}

export const browserEvidenceReadService = new BrowserEvidenceReadService();
