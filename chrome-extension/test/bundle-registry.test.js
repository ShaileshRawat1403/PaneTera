import assert from 'node:assert';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

console.log('Running production bundle registry tests...');

const bundle = fs.readFileSync(new URL('../dist/capture.bundle.js', import.meta.url), 'utf8');
assert.doesNotMatch(
  bundle,
  /^\s*var PaneTeraExtractors\s*=/m,
  'the bundler must not assign the registry name around an entry that installs that registry itself'
);
const dom = new JSDOM(
  '<!doctype html><html><head><title>Public fixture</title></head><body><article><h1>Visible article</h1><p>Evidence text for extraction.</p></article></body></html>',
  {
    url: 'https://example.com/public',
    runScripts: 'outside-only'
  }
);

dom.window.eval(bundle);

const registry = dom.window.PaneTeraExtractors;
assert.ok(registry && typeof registry === 'object', 'the production bundle must install its extractor registry');
assert.strictEqual(
  typeof registry['browser.article.extract'],
  'function',
  'the production bundle must retain the article extractor after evaluation'
);
assert.strictEqual(
  typeof registry['browser.page.observe'],
  'function',
  'the production bundle must retain the page observer after evaluation'
);

const observation = registry['browser.page.observe']();
assert.strictEqual(observation.title, 'Public fixture');
assert.strictEqual(observation.url, 'https://example.com/public');

const article = registry['browser.article.extract']();
assert.ok(article && typeof article === 'object', 'article extraction must return an evidence contract');
assert.strictEqual(article.capability, 'browser.article.extract');

dom.window.close();
console.log('✅ production bundle registry tests passed.');
