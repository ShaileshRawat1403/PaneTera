// chrome-extension/src/extractors/metadata.js
import { appendEvidenceRecord, getBaseContract, createEvidenceItem, redactExtractionText } from './utils.js';
import { redactObject } from '../../shared/redactor.js';

export function extractMetadata() {
  const contract = getBaseContract("browser.metadata.extract");
  contract.trust.sourceType = "browser-dom";
  
  const metadata = {
    title: redactExtractionText(document.title || '', contract).redactedText,
    metaTags: [],
    openGraph: {},
    twitter: {}
  };
  
  const metaTags = Array.from(document.querySelectorAll('meta'));
  const sensitiveMeta = ['csrf', 'token', 'password', 'secret', 'auth', 'key', 'session'];
  
  for (let index = 0; index < metaTags.length; index++) {
    const meta = metaTags[index];
    const name = meta.getAttribute('name') || meta.getAttribute('property');
    const content = meta.getAttribute('content');
    
    if (name && content) {
      if (sensitiveMeta.some(s => name.toLowerCase().includes(s))) {
        continue;
      }

      const cleanContent = /^https?:\/\//i.test(content.trim())
        ? redactObject(content)
        : redactExtractionText(content, contract).redactedText;
      const item = createEvidenceItem('metadata', 'metadata.document.v1', null, index);

      const appended = appendEvidenceRecord(contract, item, cleanContent, metadata.metaTags, {
        evidenceId: item.evidenceId,
        name,
        content: cleanContent
      }, 'Metadata collection stopped at the evidence limit.');
      if (!appended) break;
      
      if (name.startsWith('og:')) {
        metadata.openGraph[name.substring(3)] = cleanContent;
      }
      if (name.startsWith('twitter:')) {
        metadata.twitter[name.substring(8)] = cleanContent;
      }
    }
  }

  contract.data = { metadata };
  return contract;
}

export function extractStructuredData() {
  const contract = getBaseContract("browser.structuredData.extract");
  
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const structuredData = [];
  
  for (let index = 0; index < scripts.length; index++) {
    const script = scripts[index];
    try {
      const content = script.textContent || '';
      if (new Blob([content]).size > 500000) {
        contract.warnings.push(`Skipped large JSON-LD block (index ${index})`);
        continue;
      }
      
      const parsed = JSON.parse(content);
      const cleanData = redactObject(parsed);

      const item = createEvidenceItem('metadata', 'jsonld.document.v1', null, index);
      
      const appended = appendEvidenceRecord(contract, item, JSON.stringify(cleanData), structuredData, {
        evidenceId: item.evidenceId,
        data: cleanData
      }, 'Structured-data collection stopped at the evidence limit.');
      if (!appended) break;
    } catch (e) {
      contract.warnings.push(`Failed to parse JSON-LD block (index ${index})`);
    }
  }

  contract.data = { jsonLd: structuredData };
  return contract;
}
