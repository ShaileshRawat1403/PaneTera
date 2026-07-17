import { Readability } from '@mozilla/readability';
import DOMPurify from 'dompurify';
import { getBaseContract, createEvidenceItem } from './utils.js';

export function extractArticle() {
  const contract = getBaseContract("browser.article.extract");
  
  try {
    // Clone document to prevent modifying the live DOM
    const documentClone = document.cloneNode(true);
    
    // Create new Readability instance
    // We enforce maxElemsToParse to prevent CPU abuse on massive pages
    const reader = new Readability(documentClone, {
      maxElemsToParse: 5000,
      keepClasses: false
    });
    
    const article = reader.parse();
    
    if (article) {
      // Create a single evidence item representing the main content text
      const item = createEvidenceItem('text', 'readability.document.v1');
      
      const plainText = article.textContent || '';
      
      contract.evidence.items.push(item);
      contract.evidence.elementsMatched++;
      contract.evidence.contentBytes += new Blob([plainText]).size;
      
      contract.data = {
        evidenceId: item.evidenceId,
        title: article.title,
        textContent: plainText,
        excerpt: article.excerpt,
        byline: article.byline,
        publishedTime: article.publishedTime,
        // Optional sanitized HTML if UI needs it. We sanitize immediately.
        sanitizedHtml: DOMPurify.sanitize(article.content)
      };
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
