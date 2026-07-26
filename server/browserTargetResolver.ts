import type { ExtractionResult } from './evidence/evidenceTypes';
import type { BrowserActionTarget } from './browserActionStore';

const TARGET_FRESHNESS_MS = 60_000;

export function resolveBrowserClickTargetFromEvidence(input: {
  extraction: ExtractionResult;
  installationId: string;
  extractionId: string;
  evidenceId: string;
  now?: number;
}): BrowserActionTarget {
  const { extraction, installationId, extractionId, evidenceId } = input;
  if (extraction.extractionId !== extractionId || extraction.capability !== 'browser.elements.discover') {
    throw new Error('Browser click proposals require matching element-discovery evidence.');
  }
  if (extraction.ownership.ownerId !== installationId) {
    throw new Error('Browser evidence installation binding mismatch.');
  }
  const capturedAt = Date.parse(extraction.source.capturedAt);
  if (!Number.isFinite(capturedAt) || (input.now ?? Date.now()) - capturedAt > TARGET_FRESHNESS_MS) {
    throw new Error('Browser element evidence is stale. Discover targets again.');
  }
  const browserTarget = extraction.data?.browserTarget;
  if (
    !browserTarget
    || !Number.isInteger(browserTarget.tabId)
    || browserTarget.frameId !== 0
    || browserTarget.expectedOrigin !== extraction.source.origin
  ) {
    throw new Error('Browser evidence is missing an authoritative tab binding.');
  }
  const elements = Array.isArray(extraction.data?.elements) ? extraction.data.elements : [];
  const element = elements.find((candidate: any) => candidate?.evidenceId === evidenceId);
  if (!element) throw new Error('The selected browser target is not present in the extraction evidence.');
  const evidence = extraction.evidence?.items?.find((candidate) => candidate.evidenceId === evidenceId);
  if (!evidence || evidence.ownership.ownerId !== installationId) {
    throw new Error('The selected browser target has no matching owned evidence item.');
  }
  return {
    tabId: browserTarget.tabId,
    frameId: 0,
    expectedOrigin: browserTarget.expectedOrigin,
    role: element.role,
    accessibleName: element.accessibleName,
    elementFingerprint: element.elementFingerprint,
  };
}
