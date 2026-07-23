import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { MAX_EVIDENCE_BYTES, MAX_EVIDENCE_ITEMS } from '../src/extractors/utils.js';
import { extractArticle } from '../src/extractors/article.js';
import { extractOutline } from '../src/extractors/outline.js';
import { extractTables } from '../src/extractors/table.js';
import { extractLinks, extractCodeBlocks } from '../src/extractors/links.js';
import { extractMetadata, extractStructuredData } from '../src/extractors/metadata.js';

console.log('Running production extractor limit tests...');

function installDom(html, url = 'https://user:pass@example.com/page?token=raw-secret') {
  const dom = new JSDOM(html, { url });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;
  return dom;
}

function assertBounded(result, name) {
  assert.ok(result.evidence.items.length <= MAX_EVIDENCE_ITEMS, `${name} must respect the item ceiling`);
  assert.ok(result.evidence.contentBytes <= MAX_EVIDENCE_BYTES, `${name} must respect the byte ceiling`);
  assert.strictEqual(result.evidence.elementsMatched, result.evidence.items.length, `${name} metrics must agree`);
  assert.ok(!JSON.stringify(result).includes('raw-secret'), `${name} must not expose URL secrets`);
  assert.ok(!JSON.stringify(result).includes('user:pass'), `${name} must not expose URL credentials`);
}

const large = 'x'.repeat(100_000);

installDom(`<article><h1>Large article</h1><p>${'x'.repeat(2_100_000)}</p></article>`);
const article = extractArticle();
assertBounded(article, 'article');
assert.strictEqual(article.truncated, true, 'article must report redactor truncation');

installDom(Array.from({ length: 25 }, (_, index) => `<h2>${index}${large}</h2>`).join(''));
assertBounded(extractOutline(), 'outline');

installDom(`<table><thead><tr>${Array.from({ length: 4 }, () => `<th>${large}</th>`).join('')}</tr></thead><tbody><tr>${Array.from({ length: 25 }, () => `<td>${large}</td>`).join('')}</tr></tbody></table>`);
const table = extractTables();
assertBounded(table, 'table');
assert.strictEqual(table.truncated, true, 'table must stop before exceeding its byte ceiling');

installDom(Array.from({ length: 25 }, (_, index) => `<a href="https://example.com/${index}?token=raw-secret">${large}</a>`).join(''));
assertBounded(extractLinks(), 'links');

installDom(Array.from({ length: 25 }, () => `<pre><code>${large}</code></pre>`).join(''));
assertBounded(extractCodeBlocks(), 'code blocks');

installDom(`<head>${Array.from({ length: 25 }, (_, index) => `<meta name="field-${index}" content="${large}">`).join('')}</head>`);
assertBounded(extractMetadata(), 'metadata');

installDom(Array.from({ length: 25 }, () => `<script type="application/ld+json">${JSON.stringify({ url: 'https://example.com/?token=raw-secret', value: large })}</script>`).join(''));
const structured = extractStructuredData();
assertBounded(structured, 'structured data');
assert.ok(JSON.stringify(structured).includes('%5BREDACTED%5D'), 'structured-data URLs must be sanitized');

console.log('✅ production extractor limit tests passed.');
