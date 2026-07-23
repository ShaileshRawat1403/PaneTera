import { extractArticle } from './extractors/article.js';
import { extractOutline } from './extractors/outline.js';
import { extractTables } from './extractors/table.js';
import { extractMetadata, extractStructuredData } from './extractors/metadata.js';
import { extractLinks, extractCodeBlocks } from './extractors/links.js';
import { redactText, sanitizeUrl } from '../shared/redactor.js';

window.PaneTeraExtractors = {
  "browser.article.extract": extractArticle,
  "browser.outline.extract": extractOutline,
  "browser.table.extract": extractTables,
  "browser.links.extract": extractLinks,
  "browser.metadata.extract": extractMetadata,
  "browser.structuredData.extract": extractStructuredData,
  "browser.codeBlocks.extract": extractCodeBlocks,
  
  "browser.page.observe": () => {
    const rawSel = window.getSelection ? window.getSelection().toString() : '';
    const cleanSel = redactText(rawSel).redactedText;
    const cleanTitle = redactText(document.title || '').redactedText;
    const cleanUrl = sanitizeUrl(window.location.href || '');
    return {
      title: cleanTitle,
      url: cleanUrl,
      origin: window.location.origin || '',
      selectedText: cleanSel,
      capturedAt: new Date().toISOString()
    };
  },
  "browser.selection.observe": () => {
    const rawSel = window.getSelection ? window.getSelection().toString() : '';
    const cleanSel = redactText(rawSel).redactedText;
    const cleanTitle = redactText(document.title || '').redactedText;
    const cleanUrl = sanitizeUrl(window.location.href || '');
    return {
      title: cleanTitle,
      url: cleanUrl,
      origin: window.location.origin || '',
      selectedText: cleanSel,
      capturedAt: new Date().toISOString()
    };
  }
};
