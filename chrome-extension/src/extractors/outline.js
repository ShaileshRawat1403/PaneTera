// chrome-extension/src/extractors/outline.js
import { appendEvidenceRecord, getBaseContract, isVisible, createEvidenceItem, extractSafeText, redactExtractionText } from './utils.js';

export function extractOutline() {
  const contract = getBaseContract("browser.outline.extract");
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  
  const data = [];
  let currentStart = 0;

  for (let index = 0; index < headings.length; index++) {
    const heading = headings[index];
    if (!isVisible(heading)) continue;
    
    const { safeText } = extractSafeText(heading);
    const cleanText = redactExtractionText(safeText, contract).redactedText;
    if (!cleanText) continue;
    
    const level = parseInt(heading.tagName.substring(1), 10);
    
    const textLength = cleanText.length;
    const textRange = { start: currentStart, end: currentStart + textLength };
    currentStart += textLength + 1;
    
    const item = createEvidenceItem('heading', 'outline.visible.v1', textRange, index);
    
    const appended = appendEvidenceRecord(contract, item, cleanText, data, {
      evidenceId: item.evidenceId,
      level,
      text: cleanText
    }, 'Outline collection stopped at the evidence limit.');
    if (!appended) break;
  }

  contract.data = { outline: data };
  return contract;
}
