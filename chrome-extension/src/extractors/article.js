// chrome-extension/src/extractors/article.js
import { Readability } from '@mozilla/readability';
import { appendEvidenceRecord, getBaseContract, createEvidenceItem, redactExtractionText } from './utils.js';

export function extractArticle() {
  const contract = getBaseContract("browser.article.extract");
  
  try {
    const documentClone = document.cloneNode(true);

    // Strip sensitive form inputs from the document clone before Readability parse
    const sensitive = documentClone.querySelectorAll ? documentClone.querySelectorAll('input[type="password"], input[type="hidden"]') : [];
    sensitive.forEach(el => el.remove());
    
    const formControls = documentClone.querySelectorAll ? documentClone.querySelectorAll('input, textarea, select, [contenteditable]') : [];
    formControls.forEach(el => {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.value = '';
        el.setAttribute('value', '');
        el.textContent = '[FORM_VALUE_REDACTED]';
      } else {
        el.textContent = '[FORM_VALUE_REDACTED]';
      }
    });

    const reader = new Readability(documentClone, {
      maxElemsToParse: 5000,
      keepClasses: false
    });
    
    const article = reader.parse();
    
    if (article) {
      const item = createEvidenceItem('text', 'readability.document.v1');
      
      const rawText = article.textContent || '';
      const { redactedText, redactions } = redactExtractionText(rawText, contract);
      const cleanTitle = redactExtractionText(article.title || '', contract).redactedText;
      const cleanExcerpt = redactExtractionText(article.excerpt || '', contract).redactedText;
      const cleanByline = redactExtractionText(article.byline || '', contract).redactedText;
      const cleanPublishedTime = redactExtractionText(article.publishedTime || '', contract).redactedText;
      
      if (redactions.credentials > 0 || redactions.emails > 0 || redactions.creditCards > 0) {
        contract.warnings.push(`Redacted secrets/PII: ${JSON.stringify(redactions)}`);
      }

      const records = [];
      const record = {
        evidenceId: item.evidenceId,
        title: cleanTitle,
        textContent: redactedText,
        excerpt: cleanExcerpt,
        byline: cleanByline,
        publishedTime: cleanPublishedTime
      };
      const appended = appendEvidenceRecord(
        contract,
        item,
        JSON.stringify(record),
        records,
        record,
        'Article extraction exceeded the evidence limit.'
      );
      contract.data = appended ? records[0] : null;
    } else {
      contract.warnings.push("Readability failed to extract an article (page might not be article-like)");
      contract.data = null;
    }
  } catch (error) {
    contract.warnings.push(`Extraction error: ${error.message}`);
    contract.data = null;
  }
  
  return contract;
}
