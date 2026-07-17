import { ObservationItem, ExtractionResult } from './browserGateway';

export class BrowserEvidenceStore {
  private observations: ObservationItem[] = [];
  private extractions: ExtractionResult[] = [];

  public storeObservation(obs: ObservationItem): void {
    if (this.observations.length >= 50) this.observations.shift();
    this.observations.push(obs);
  }

  public storeExtraction(ext: ExtractionResult): void {
    if (this.extractions.length >= 50) this.extractions.shift();
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
    while (this.observations.length > 0 && this.observations[0].capturedAt < oneHourAgo) {
      this.observations.shift();
    }
    while (this.extractions.length > 0 && this.extractions[0].source.capturedAt < oneHourAgo) {
      this.extractions.shift();
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
}

// Singleton instance
export let browserEvidenceStore = new BrowserEvidenceStore();

export function setBrowserEvidenceStoreForTest(store: BrowserEvidenceStore | undefined) {
  browserEvidenceStore = store || new BrowserEvidenceStore();
}
