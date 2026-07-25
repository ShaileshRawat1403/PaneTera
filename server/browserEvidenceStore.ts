import { ObservationItem, ExtractionResult } from './evidence/evidenceTypes';
import { evidenceRetentionService } from './evidence/evidenceRetentionService';

export class BrowserEvidenceStore {
  private observations: ObservationItem[] = [];
  private extractions: ExtractionResult[] = [];

  private enforceCapacityLimit<T extends { captureId?: string; parentCaptureId?: string; extractionId?: string }>(
    items: T[], 
    limit: number, 
    idExtractor: (item: T) => { captureId?: string; extractionId?: string }
  ): void {
    while (items.length >= limit) {
      // Find oldest unleased record to evict
      let indexToEvict = -1;
      for (let i = 0; i < items.length; i++) {
        const ids = idExtractor(items[i]);
        const isCaptureLeased = ids.captureId ? evidenceRetentionService.isLeased('captureId', ids.captureId) : false;
        const isExtractionLeased = ids.extractionId ? evidenceRetentionService.isLeased('extractionId', ids.extractionId) : false;
        
        if (!isCaptureLeased && !isExtractionLeased) {
          indexToEvict = i;
          break; // First one is the oldest because array is push-ordered
        }
      }

      if (indexToEvict !== -1) {
        items.splice(indexToEvict, 1);
      } else {
        throw new Error('Capacity failure: all records are actively leased');
      }
    }
  }

  public storeObservation(obs: ObservationItem): void {
    this.enforceCapacityLimit(this.observations, 50, o => ({ captureId: o.captureId }));
    this.observations.push(obs);
  }

  public storeExtraction(ext: ExtractionResult): void {
    this.enforceCapacityLimit(this.extractions, 50, e => ({ extractionId: e.extractionId, captureId: e.parentCaptureId }));
    this.extractions.push(ext);
  }

  public storeEvidenceItem(item: any): void {
    const ext = this.extractions.find(e => e.extractionId === item.extractionId);
    if (ext) {
      if (!ext.evidence) ext.evidence = { items: [], elementsMatched: 0, contentBytes: 0 };
      if (!ext.evidence.items) ext.evidence.items = [];
      ext.evidence.items.push(item);
    }
  }

  public applyRetentionPolicy(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // Evict observations
    for (let i = 0; i < this.observations.length; ) {
      const obs = this.observations[i];
      if (obs.capturedAt < oneHourAgo && !evidenceRetentionService.isLeased('captureId', obs.captureId)) {
        this.observations.splice(i, 1);
      } else {
        i++;
      }
    }

    // Evict extractions
    for (let i = 0; i < this.extractions.length; ) {
      const ext = this.extractions[i];
      if (ext.source.capturedAt < oneHourAgo && 
          !evidenceRetentionService.isLeased('extractionId', ext.extractionId) &&
          !evidenceRetentionService.isLeased('captureId', ext.parentCaptureId)) {
        this.extractions.splice(i, 1);
      } else {
        i++;
      }
    }
  }

  public getObservations(after?: string): ObservationItem[] {
    if (after) {
      return this.observations.filter(o => o.capturedAt > after);
    }
    return this.observations;
  }

  public getExtractions(after?: string): ExtractionResult[] {
    if (after) {
      return this.extractions.filter(e => e.source.capturedAt > after);
    }
    return this.extractions;
  }

  public getObservationByCaptureId(captureId: string): ObservationItem | undefined {
    return this.observations.find(o => o.captureId === captureId);
  }

  public getExtractionById(id: string): ExtractionResult | undefined {
    return this.extractions.find(e => e.parentCaptureId === id || e.extractionId === id);
  }
  
  public getPaginatedCaptures(limit: number, offset: number): ObservationItem[] {
    // Newest first ordering
    const sorted = [...this.observations].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
    return sorted.slice(offset, offset + limit);
  }

  public getRecentExtractions(limit: number = 10): ExtractionResult[] {
    // Return most recent extractions, newest first
    return this.extractions
      .slice(-limit)
      .reverse();
  }
}

// Singleton instance
export let browserEvidenceStore = new BrowserEvidenceStore();

export function setBrowserEvidenceStoreForTest(store: BrowserEvidenceStore | undefined) {
  browserEvidenceStore = store || new BrowserEvidenceStore();
}
