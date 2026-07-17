import { getBaseContract, createEvidenceItem } from './utils.js';

export function extractMetadata() {
  const contract = getBaseContract("browser.metadata.extract");
  // Document-metadata, not visible
  contract.trust.sourceType = "browser-dom"; // but explicitly marked metadata
  
  const metadata = {
    title: document.title,
    metaTags: [],
    openGraph: {},
    twitter: {}
  };
  
  const metaTags = Array.from(document.querySelectorAll('meta'));
  
  metaTags.forEach((meta, index) => {
    const name = meta.getAttribute('name') || meta.getAttribute('property');
    const content = meta.getAttribute('content');
    
    if (name && content) {
      const item = createEvidenceItem('metadata', 'metadata.document.v1', null, index);
      
      contract.evidence.items.push(item);
      contract.evidence.elementsMatched++;
      contract.evidence.contentBytes += new Blob([content]).size;
      
      metadata.metaTags.push({
        evidenceId: item.evidenceId,
        name,
        content
      });
      
      if (name.startsWith('og:')) {
        metadata.openGraph[name.substring(3)] = content;
      }
      if (name.startsWith('twitter:')) {
        metadata.twitter[name.substring(8)] = content;
      }
    }
  });

  contract.data = { metadata };
  return contract;
}

export function extractStructuredData() {
  const contract = getBaseContract("browser.structuredData.extract");
  
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const structuredData = [];
  
  scripts.forEach((script, index) => {
    try {
      // Basic limits on JSON-LD
      const content = script.textContent;
      if (new Blob([content]).size > 500000) { // Skip if > 500KB
        contract.warnings.push(`Skipped large JSON-LD block (index ${index})`);
        return;
      }
      
      const parsed = JSON.parse(content);
      const item = createEvidenceItem('metadata', 'jsonld.document.v1', null, index);
      
      contract.evidence.items.push(item);
      contract.evidence.elementsMatched++;
      contract.evidence.contentBytes += new Blob([content]).size;
      
      structuredData.push({
        evidenceId: item.evidenceId,
        data: parsed
      });
    } catch (e) {
      contract.warnings.push(`Failed to parse JSON-LD block (index ${index})`);
    }
  });

  contract.data = { jsonLd: structuredData };
  return contract;
}
