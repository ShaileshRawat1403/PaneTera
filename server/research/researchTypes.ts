import { EvidenceOwnership, BrowserTrust } from "../evidence/evidenceTypes";

export interface ContentIntegrity {
  hashAlgorithm: "sha256";
  canonicalizationVersion: "text-v1";
  contentHash: string;
  contentBytes: number;
}

export interface ResearchSessionSnapshotEntry {
  snapshotEntryId: string;
  position: number;

  sourceType: "browser-evidence";

  captureId: string;
  extractionId: string;
  evidenceId: string;

  sourceTitle: string;
  sourceUri: string;
  sourceOrigin: string;
  capturedAt: string;

  excerpt: string;
  integrity: ContentIntegrity;

  ownership: EvidenceOwnership;
  trust: BrowserTrust;

  duplicateOfSnapshotEntryId?: string;
}

export interface ResearchWarning {
  message: string;
  code?: string;
}

export interface ResearchSession {
  sessionId: string;
  ownerId: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  status: "draft" | "ready" | "partial" | "archived";
  currentSnapshotId?: string;
  sourceCount: number;
  warnings: ResearchWarning[];
}

export interface ResearchSessionSnapshot {
  snapshotId: string;
  sessionId: string;
  schemaVersion: "1.0";
  version: number;
  createdAt: string;
  entries: ResearchSessionSnapshotEntry[];
  snapshotIntegrity: ContentIntegrity;
}

export type ProvenanceStatus =
  | "resolved"
  | "missing"
  | "unauthorised"
  | "integrity-failure"
  | "broken-lineage"
  | "trust-mismatch";

export interface ProvenanceValidationResult {
  valid: boolean;
  status: ProvenanceStatus;
  snapshotEntry?: ResearchSessionSnapshotEntry;
  warnings: string[];
}
