import { browserEvidenceStore } from '../browserEvidenceStore';
import { ObservationItem, ExtractionResult, EvidenceItem } from './evidenceTypes';
import { toCanonicalEvidenceText } from './evidenceCanonicalizer';

export type ResolutionStatus = 
  | 'resolved'
  | 'missing'
  | 'unauthorised'
  | 'expired' // Hard to differentiate from missing without tombstones, but explicit logic can apply
  | 'broken-parent'
  | 'trust-mismatch'
  | 'unsupported-source'
  | 'integrity-failure';

export interface GraphResolution {
  status: ResolutionStatus;
  capture?: ObservationItem;
  extraction?: ExtractionResult;
  evidence?: EvidenceItem;
}

export class EvidenceGraphResolver {
  public resolve(
    principalOwnerId: string, 
    captureId: string, 
    extractionId: string, 
    evidenceId: string
  ): GraphResolution {
    const capture = browserEvidenceStore.getObservationByCaptureId(captureId);
    if (!capture) return { status: 'missing' };
    
    // Authorization
    if (capture.ownership.ownerId !== principalOwnerId) return { status: 'unauthorised' };

    const extraction = browserEvidenceStore.getExtractionById(extractionId);
    if (!extraction) return { status: 'missing' };
    if (extraction.ownership.ownerId !== principalOwnerId) return { status: 'unauthorised' };
    
    // Lineage check
    if (extraction.parentCaptureId !== captureId) return { status: 'broken-parent' };

    const evidence = extraction.evidence.items.find(e => e.evidenceId === evidenceId);
    if (!evidence) return { status: 'missing' };
    if (evidence.ownership.ownerId !== principalOwnerId) return { status: 'unauthorised' };
    
    // Broken parent
    if (evidence.extractionId !== extractionId) return { status: 'broken-parent' };

    // Trust mismatch check
    if (capture.trust.trustLevel !== extraction.trust.trustLevel ||
        capture.trust.trustLevel !== evidence.trust.trustLevel) {
      return { status: 'trust-mismatch' };
    }

    // Supported source check
    try {
      toCanonicalEvidenceText(evidence); // Will throw if unsupported
    } catch (e) {
      return { status: 'unsupported-source' };
    }

    return { status: 'resolved', capture, extraction, evidence };
  }
}

export const evidenceGraphResolver = new EvidenceGraphResolver();
