// chrome-extension/src/extractors/utils.js

import { redactText, sanitizeUrl } from '../../shared/redactor.js';

export const MAX_EVIDENCE_ITEMS = 5000;
export const MAX_EVIDENCE_BYTES = 1800000;

export function utf8Bytes(value) {
  return new TextEncoder().encode(String(value ?? '')).byteLength;
}

export function markTruncated(contract, warning) {
  contract.truncated = true;
  if (!contract.warnings.includes(warning)) contract.warnings.push(warning);
}

export function redactExtractionText(value, contract) {
  const result = redactText(String(value ?? ''));
  if (result.redactions.truncated) {
    markTruncated(contract, 'One or more source fields were truncated before extraction.');
  }
  return result;
}

export function appendEvidenceRecord(contract, item, content, target, record, warning = 'Extraction stopped at the evidence limit.') {
  const bytes = utf8Bytes(content);
  if (
    contract.evidence.items.length >= MAX_EVIDENCE_ITEMS ||
    contract.evidence.contentBytes + bytes > MAX_EVIDENCE_BYTES
  ) {
    markTruncated(contract, warning);
    return false;
  }

  contract.evidence.items.push(item);
  contract.evidence.elementsMatched = contract.evidence.items.length;
  contract.evidence.contentBytes += bytes;
  target.push(record);
  return true;
}

export function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  throw new Error('Cryptographic random generation unavailable (crypto.randomUUID missing)');
}

export function isVisible(elem) {
  if (!(elem instanceof Element)) return false;
  if (typeof window === 'undefined') return true;
  const style = window.getComputedStyle ? window.getComputedStyle(elem) : null;
  if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) {
    return false;
  }
  // In real browsers with layout, elements with display:none or zero dimensions are caught.
  // In JSDOM, getBoundingClientRect returns 0,0,0,0 for all elements unless explicitly stubbed.
  return true;
}

export function extractSafeText(node) {
  if (!node) return { safeText: '', redactionCount: 0 };

  let redactionCount = 0;

  // Text nodes
  if (node.nodeType === 3) {
    return { safeText: node.nodeValue || '', redactionCount: 0 };
  }

  if (node.nodeType !== 1) {
    return { safeText: '', redactionCount: 0 };
  }

  // Clone node to prevent mutating live DOM
  const clone = node.cloneNode(true);

  // 1. Remove password and hidden inputs entirely
  const sensitiveInputs = clone.querySelectorAll ? clone.querySelectorAll('input[type="password"], input[type="hidden"]') : [];
  sensitiveInputs.forEach(el => el.remove());

  // 2. Clear value-bearing content from all remaining inputs, textareas, selects, and contenteditable
  const formControls = clone.querySelectorAll ? clone.querySelectorAll('input, textarea, select, [contenteditable]') : [];
  formControls.forEach(el => {
    redactionCount++;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.value = '';
      el.setAttribute('value', '');
      el.textContent = '[FORM_VALUE_REDACTED]';
    } else if (el.tagName === 'SELECT') {
      el.selectedIndex = -1;
      el.textContent = '[FORM_VALUE_REDACTED]';
    } else {
      el.textContent = '[FORM_VALUE_REDACTED]';
    }
  });

  const safeText = (clone.textContent || '').trim();
  return { safeText, redactionCount };
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
  const rawTitle = (typeof document !== 'undefined' && document.title) ? document.title : '';
  const rawUrl = (typeof window !== 'undefined' && window.location && window.location.href) ? window.location.href : '';
  const cleanTitle = redactText(rawTitle).redactedText;
  const cleanUrl = sanitizeUrl(rawUrl);
  let cleanOrigin = '';
  try {
    cleanOrigin = cleanUrl ? new URL(cleanUrl).origin : '';
  } catch {
    cleanOrigin = '';
  }

  return {
    extractionId: generateUUID(),
    parentCaptureId: '',
    capability,
    source: {
      title: cleanTitle,
      url: cleanUrl,
      origin: cleanOrigin,
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
