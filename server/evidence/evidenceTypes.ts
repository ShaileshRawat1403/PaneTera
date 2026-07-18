export interface EvidenceOwnership {
  ownerId: string;
  createdBy: {
    type: "browser-extension" | "workbench" | "import";
    actorId: string;
  };
  sourceSessionId?: string;
}

export interface BrowserTrust {
  sourceType: "browser-dom";
  trustLevel: "untrusted";
  instructionAuthority: "none";
}

export interface ObservationItem {
  captureId: string;
  ownership: EvidenceOwnership;
  trust: BrowserTrust;
  captureType: "page-selection";
  title: string;
  url: string;
  origin: string;
  selectedText: string;
  capturedAt: string;
}

export interface EvidenceItem {
  evidenceId: string;
  extractionId: string;
  ownership: EvidenceOwnership;
  trust: BrowserTrust;
  kind: string;
  locator?: any;
  content: string;
  contentBytes: number;
}

export interface ExtractionResult {
  extractionId: string;
  parentCaptureId: string;
  capability: string;
  ownership: EvidenceOwnership;
  trust: BrowserTrust;
  source: {
    title: string;
    url: string;
    origin: string;
    capturedAt: string;
  };
  data: any;
  evidence: {
    items: EvidenceItem[];
    elementsMatched: number;
    contentBytes: number;
  };
  warnings: string[];
  truncated: boolean;
}
