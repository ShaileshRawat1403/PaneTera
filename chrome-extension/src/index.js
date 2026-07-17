import { extractArticle } from './extractors/article.js';
import { extractOutline } from './extractors/outline.js';
import { extractTables } from './extractors/table.js';
import { extractMetadata, extractStructuredData } from './extractors/metadata.js';
import { extractLinks, extractCodeBlocks } from './extractors/links.js';

// Expose the extractors globally for the background script to invoke
window.TesseraExtractors = {
  "browser.article.extract": extractArticle,
  "browser.outline.extract": extractOutline,
  "browser.table.extract": extractTables,
  "browser.links.extract": extractLinks,
  "browser.metadata.extract": extractMetadata,
  "browser.structuredData.extract": extractStructuredData,
  "browser.codeBlocks.extract": extractCodeBlocks,
  
  // Phase 1 legacy support
  "browser.page.observe": () => {
    return {
      title: document.title || '',
      url: window.location.href || '',
      origin: window.location.origin || '',
      selectedText: window.getSelection ? window.getSelection().toString() : '',
      capturedAt: new Date().toISOString()
    };
  }
};
