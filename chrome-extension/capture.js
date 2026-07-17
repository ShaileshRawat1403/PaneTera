import { Readability } from '@mozilla/readability';
import DOMPurify from 'dompurify';

function generateCaptureId() {
  return 'cap_' + Math.random().toString(36).substring(2) + Date.now();
}

function getSourceReference() {
  return {
    url: window.location.href,
    title: document.title,
    origin: window.location.origin,
    capturedAt: new Date().toISOString()
  };
}

function getTrustMetadata() {
  return {
    origin: window.location.origin,
    isTopFrame: window === window.top,
    hasCsp: true // Simplification for now
  };
}

function createResult(capability, data, evidenceItems = []) {
  const extractionId = 'ext_' + Math.random().toString(36).substring(2) + Date.now();
  
  // Calculate size roughly
  const contentBytes = new Blob([JSON.stringify(data)]).size;
  let truncated = false;
  
  // Cap at 2MB limit (roughly)
  if (contentBytes > 1800000) {
    truncated = true;
    // In a real app we'd actually truncate the data string here
  }

  return {
    extractionId,
    parentCaptureId: generateCaptureId(),
    capability,
    source: getSourceReference(),
    trust: getTrustMetadata(),
    data,
    evidence: {
      items: evidenceItems,
      elementsMatched: evidenceItems.length,
      contentBytes
    },
    warnings: [],
    truncated
  };
}

export function extractArticle() {
  // Clone document to avoid mutating the live page
  const documentClone = document.cloneNode(true);
  
  // Clean up some stuff before Readability
  // Example: remove scripts
  const scripts = documentClone.getElementsByTagName('script');
  for(let i = scripts.length - 1; i >= 0; i--) {
      scripts[i].parentNode.removeChild(scripts[i]);
  }

  const article = new Readability(documentClone, {
    maxElemsToParse: 5000
  }).parse();

  if (!article) {
    return createResult('browser.article.extract', { error: 'Failed to extract article' });
  }

  // Sanitize the HTML content
  const cleanHtml = DOMPurify.sanitize(article.content);

  const data = {
    title: article.title,
    byline: article.byline,
    dir: article.dir,
    lang: article.lang,
    textContent: article.textContent,
    htmlContent: cleanHtml,
    excerpt: article.excerpt
  };

  const evidenceItem = {
    evidenceId: 'ev_' + Math.random().toString(36).substring(2),
    kind: 'text',
    locator: { recipeId: 'readability-article' }
  };

  return createResult('browser.article.extract', data, [evidenceItem]);
}

export function extractOutline() {
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  const data = headings.map(h => ({
    text: h.textContent?.trim() || '',
    level: parseInt(h.tagName.substring(1))
  })).filter(h => h.text.length > 0);

  const evidenceItems = headings.map((h, i) => ({
    evidenceId: 'ev_' + i,
    kind: 'heading',
    locator: { recipeId: 'dom-heading', ordinal: i }
  }));

  return createResult('browser.outline.extract', data, evidenceItems);
}

export function extractTable() {
  const tables = Array.from(document.querySelectorAll('table'));
  const data = tables.map(table => {
    const rows = Array.from(table.querySelectorAll('tr'));
    return rows.map(row => {
      const cells = Array.from(row.querySelectorAll('td, th'));
      return cells.map(cell => cell.textContent?.trim() || '');
    });
  });

  const evidenceItems = tables.map((t, i) => ({
    evidenceId: 'ev_' + i,
    kind: 'table-cell',
    locator: { recipeId: 'dom-table', ordinal: i }
  }));

  return createResult('browser.table.extract', data, evidenceItems);
}

export function extractLinks() {
  const links = Array.from(document.querySelectorAll('a[href]'));
  const data = links.map(link => ({
    text: link.textContent?.trim() || '',
    href: link.href
  })).filter(l => l.href && l.href.startsWith('http'));

  const evidenceItems = links.map((l, i) => ({
    evidenceId: 'ev_' + i,
    kind: 'link',
    locator: { recipeId: 'dom-link', ordinal: i }
  }));

  return createResult('browser.links.extract', data, evidenceItems);
}

export function extractMetadata() {
  const metas = Array.from(document.querySelectorAll('meta'));
  const data = {};
  
  metas.forEach(meta => {
    const name = meta.getAttribute('name') || meta.getAttribute('property');
    const content = meta.getAttribute('content');
    if (name && content) {
      data[name] = content;
    }
  });

  const evidenceItem = {
    evidenceId: 'ev_meta',
    kind: 'metadata',
    locator: { recipeId: 'dom-meta' }
  };

  return createResult('browser.metadata.extract', data, [evidenceItem]);
}

export function extractStructuredData() {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const data = scripts.map(script => {
    try {
      return JSON.parse(script.textContent || '{}');
    } catch (e) {
      return null;
    }
  }).filter(Boolean);

  const evidenceItems = scripts.map((s, i) => ({
    evidenceId: 'ev_' + i,
    kind: 'metadata',
    locator: { recipeId: 'json-ld', ordinal: i }
  }));

  return createResult('browser.structuredData.extract', data, evidenceItems);
}

export function extractCodeBlocks() {
  const blocks = Array.from(document.querySelectorAll('pre code, code'));
  const data = blocks.map(block => ({
    language: block.className.replace('language-', '').trim() || 'unknown',
    code: block.textContent || ''
  })).filter(b => b.code.length > 0);

  const evidenceItems = blocks.map((b, i) => ({
    evidenceId: 'ev_' + i,
    kind: 'code',
    locator: { recipeId: 'dom-code', ordinal: i }
  }));

  return createResult('browser.codeBlocks.extract', data, evidenceItems);
}

// Global registry for injection
window.TesseraExtractors = {
  'browser.article.extract': extractArticle,
  'browser.outline.extract': extractOutline,
  'browser.table.extract': extractTable,
  'browser.links.extract': extractLinks,
  'browser.metadata.extract': extractMetadata,
  'browser.structuredData.extract': extractStructuredData,
  'browser.codeBlocks.extract': extractCodeBlocks,
  // Fallback for Phase 1
  'browser.page.observe': () => {
    return {
      title: document.title || '',
      url: window.location.href || '',
      origin: window.location.origin || '',
      selectedText: window.getSelection ? window.getSelection().toString() : '',
      capturedAt: new Date().toISOString()
    };
  },
  'browser.selection.observe': () => {
    return {
      title: document.title || '',
      url: window.location.href || '',
      origin: window.location.origin || '',
      selectedText: window.getSelection ? window.getSelection().toString() : '',
      capturedAt: new Date().toISOString()
    };
  }
};
