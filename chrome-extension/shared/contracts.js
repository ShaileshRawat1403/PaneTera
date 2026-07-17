// chrome-extension/shared/contracts.js

export const PROTOCOL_VERSION = "1.0";
export const CAPABILITY_VERSION = "1.0";

export const RiskLevels = {
  OBSERVE: "observe",
  INSPECT: "inspect",
  NAVIGATE: "navigate",
  INTERACT: "interact",
  DEBUG: "debug",
  LOCAL_ACTION: "local-action",
  SENSITIVE: "sensitive"
};

export const Capabilities = {
  // Phase 1 Observation
  BROWSER_PAGE_OBSERVE: "browser.page.observe",
  BROWSER_SELECTION_OBSERVE: "browser.selection.observe",
  
  // Phase 2 Extraction (Rendered-content)
  BROWSER_ARTICLE_EXTRACT: "browser.article.extract",
  BROWSER_OUTLINE_EXTRACT: "browser.outline.extract",
  BROWSER_TABLE_EXTRACT: "browser.table.extract",
  BROWSER_LINKS_EXTRACT: "browser.links.extract",
  BROWSER_CODE_BLOCKS_EXTRACT: "browser.codeBlocks.extract",
  
  // Phase 2 Extraction (Document-metadata)
  BROWSER_METADATA_EXTRACT: "browser.metadata.extract",
  BROWSER_STRUCTURED_DATA_EXTRACT: "browser.structuredData.extract"
};

export const EvidenceCategory = {
  RENDERED_CONTENT: "rendered-content",
  DOCUMENT_METADATA: "document-metadata"
};

/**
 * Extraction Schema Notes (Reference):
 * 
 * interface ExtractionResult {
 *   extractionId: string;
 *   parentCaptureId: string;
 *   capability: string;
 *   source: { title: string, url: string, origin: string, capturedAt: string };
 *   trust: { sourceType: "browser-dom", trustLevel: "untrusted", instructionAuthority: "none" };
 *   data: unknown;
 *   evidence: { items: EvidenceItem[], elementsMatched: number, contentBytes: number };
 *   warnings: string[];
 *   truncated: boolean;
 * }
 * 
 * interface EvidenceItem {
 *   evidenceId: string;
 *   kind: "text" | "heading" | "table-cell" | "link" | "metadata" | "code";
 *   locator: { recipeId: string, ordinal?: number, row?: number, column?: number };
 *   textRange?: { start: number, end: number };
 * }
 */
