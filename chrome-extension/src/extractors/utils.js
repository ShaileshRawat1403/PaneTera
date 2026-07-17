export function generateUUID() {
  return crypto.randomUUID();
}

export function isVisible(elem) {
  if (!(elem instanceof Element)) return false;
  const style = window.getComputedStyle(elem);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = elem.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return false;
  }
  return true;
}

export function createEvidenceItem(kind, recipeId, textRange = null, ordinal = undefined, row = undefined, column = undefined) {
  const locator = { recipeId };
  if (ordinal !== undefined) locator.ordinal = ordinal;
  if (row !== undefined) locator.row = row;
  if (column !== undefined) locator.column = column;
  
  const item = {
    evidenceId: generateUUID(),
    kind,
    locator
  };
  
  if (textRange) item.textRange = textRange;
  return item;
}

export function getBaseContract(capability) {
  return {
    extractionId: generateUUID(),
    parentCaptureId: '', // Filled in by background/gateway if needed, or by UI
    capability,
    source: {
      title: document.title || '',
      url: window.location.href || '',
      origin: window.location.origin || '',
      capturedAt: new Date().toISOString()
    },
    trust: {
      sourceType: "browser-dom",
      trustLevel: "untrusted",
      instructionAuthority: "none"
    },
    data: {},
    evidence: {
      items: [],
      elementsMatched: 0,
      contentBytes: 0
    },
    warnings: [],
    truncated: false
  };
}
