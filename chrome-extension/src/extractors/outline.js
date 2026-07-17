import { getBaseContract, isVisible, createEvidenceItem } from './utils.js';

export function extractOutline() {
  const contract = getBaseContract("browser.outline.extract");
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  
  const data = [];
  let currentStart = 0;

  headings.forEach((heading, index) => {
    if (!isVisible(heading)) return;
    
    const text = heading.textContent.trim();
    if (!text) return;
    
    const level = parseInt(heading.tagName.substring(1), 10);
    
    // Simulate text range if we were building a full text blob, but for outline we just store the items
    const textLength = text.length;
    const textRange = { start: currentStart, end: currentStart + textLength };
    currentStart += textLength + 1; // +1 for newline or space if concatenated
    
    const item = createEvidenceItem('heading', 'outline.visible.v1', textRange, index);
    
    contract.evidence.items.push(item);
    contract.evidence.elementsMatched++;
    contract.evidence.contentBytes += new Blob([text]).size;
    
    data.push({
      evidenceId: item.evidenceId,
      level,
      text
    });
  });

  contract.data = { outline: data };
  return contract;
}
