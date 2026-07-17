import { getBaseContract, isVisible, createEvidenceItem } from './utils.js';

export function extractLinks() {
  const contract = getBaseContract("browser.links.extract");
  const links = Array.from(document.querySelectorAll('a[href]'));
  
  const data = [];
  
  links.forEach((link, index) => {
    if (!isVisible(link)) return;
    
    const text = link.textContent.trim();
    const href = link.href;
    
    if (!href || href.startsWith('javascript:')) return;
    
    const item = createEvidenceItem('link', 'links.visible.v1', null, index);
    
    contract.evidence.items.push(item);
    contract.evidence.elementsMatched++;
    contract.evidence.contentBytes += new Blob([text + href]).size;
    
    data.push({
      evidenceId: item.evidenceId,
      text,
      href
    });
  });

  contract.data = { links: data };
  return contract;
}

export function extractCodeBlocks() {
  const contract = getBaseContract("browser.codeBlocks.extract");
  // Can be <pre><code> or just <pre> or element with specific class
  const preElements = Array.from(document.querySelectorAll('pre'));
  
  const data = [];
  
  preElements.forEach((pre, index) => {
    if (!isVisible(pre)) return;
    
    const codeElem = pre.querySelector('code');
    const text = codeElem ? codeElem.textContent : pre.textContent;
    
    // Attempt to guess language from class (e.g., language-javascript, hljs-json)
    let language = 'unknown';
    const classes = Array.from(pre.classList).concat(codeElem ? Array.from(codeElem.classList) : []);
    const langClass = classes.find(c => c.startsWith('language-') || c.startsWith('lang-') || c.startsWith('hljs-'));
    if (langClass) {
      language = langClass.replace(/^(language-|lang-|hljs-)/, '');
    }
    
    const item = createEvidenceItem('code', 'code.visible.v1', null, index);
    
    contract.evidence.items.push(item);
    contract.evidence.elementsMatched++;
    contract.evidence.contentBytes += new Blob([text]).size;
    
    data.push({
      evidenceId: item.evidenceId,
      language,
      code: text
    });
  });

  contract.data = { codeBlocks: data };
  return contract;
}
