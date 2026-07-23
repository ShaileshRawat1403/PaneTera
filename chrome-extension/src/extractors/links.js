// chrome-extension/src/extractors/links.js
import { appendEvidenceRecord, getBaseContract, isVisible, createEvidenceItem, extractSafeText, redactExtractionText } from './utils.js';
import { sanitizeUrl } from '../../shared/redactor.js';

export function extractLinks() {
  const contract = getBaseContract("browser.links.extract");
  const links = Array.from(document.querySelectorAll('a[href]'));
  
  const data = [];
  
  for (let index = 0; index < links.length; index++) {
    const link = links[index];
    if (!isVisible(link)) continue;
    
    const { safeText } = extractSafeText(link);
    const cleanText = redactExtractionText(safeText, contract).redactedText;
    const cleanHref = sanitizeUrl(link.href);
    
    if (!cleanHref || cleanHref.startsWith('javascript:')) continue;
    
    const item = createEvidenceItem('link', 'links.visible.v1', null, index);
    
    const appended = appendEvidenceRecord(contract, item, cleanText + cleanHref, data, {
      evidenceId: item.evidenceId,
      text: cleanText,
      href: cleanHref
    }, 'Link collection stopped at the evidence limit.');
    if (!appended) break;
  }

  contract.data = { links: data };
  return contract;
}

export function extractCodeBlocks() {
  const contract = getBaseContract("browser.codeBlocks.extract");
  const preElements = Array.from(document.querySelectorAll('pre'));
  
  const data = [];
  
  for (let index = 0; index < preElements.length; index++) {
    const pre = preElements[index];
    if (!isVisible(pre)) continue;
    
    const codeElem = pre.querySelector('code');
    const { safeText } = extractSafeText(codeElem || pre);
    const { redactedText } = redactExtractionText(safeText, contract);
    
    let language = 'unknown';
    const classes = Array.from(pre.classList).concat(codeElem ? Array.from(codeElem.classList) : []);
    const langClass = classes.find(c => c.startsWith('language-') || c.startsWith('lang-') || c.startsWith('hljs-'));
    if (langClass) {
      language = langClass.replace(/^(language-|lang-|hljs-)/, '');
    }
    
    const item = createEvidenceItem('code', 'code.visible.v1', null, index);
    
    const appended = appendEvidenceRecord(contract, item, redactedText, data, {
      evidenceId: item.evidenceId,
      language,
      code: redactedText
    }, 'Code-block collection stopped at the evidence limit.');
    if (!appended) break;
  }

  contract.data = { codeBlocks: data };
  return contract;
}
