import assert from 'node:assert';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { buildBrowserEvidenceBlock, firstAttachedWebContext, shouldInspectActiveWebPreview } from '../src/utils/browserEvidenceContext';

describe('browser web context integration', () => {
  it('selects the first attached web reference', () => {
    assert.deepStrictEqual(firstAttachedWebContext([
      { kind: 'file', locator: '/tmp/a', label: 'a' },
      { kind: 'web', locator: 'https://example.com/', label: 'example.com' },
    ]), { kind: 'web', locator: 'https://example.com/', label: 'example.com' });
  });

  it('labels browser evidence as untrusted and bounded', () => {
    const block = buildBrowserEvidenceBlock({
      source: { title: 'Example <news>', url: 'https://example.com/' },
      capability: 'browser.article.extract',
      data: { textContent: 'x'.repeat(200_000) },
    }, 2_000);
    assert.match(block, /trust="untrusted" authority="none"/);
    assert.ok(!block.includes('label="Example <news>"'));
    assert.match(block, /TRUNCATED_BY_HEADROOM/);
    assert.ok(new TextEncoder().encode(block).byteLength < 3_000);
  });

  it('opens the preview before waiting for Browser Operator evidence', () => {
    const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
    const integration = app.slice(app.indexOf('const attachedWebContext = firstAttachedWebContext'), app.indexOf('const requestBody = useWorkspaceOrchestrator'));
    assert.ok(integration.indexOf('setWebPreview') < integration.indexOf('await requestWebObservation'));
    assert.ok(integration.includes('buildBrowserEvidenceBlock(evidence)'));
    assert.ok(integration.includes('shouldInspectActiveWebPreview(plan.rawInput)'));

    // The failure branch must disclose that no inspection happened. This
    // previously asserted the exact phrase "did not inspect its contents",
    // which was part of a message that also claimed "I opened <url> in the
    // preview" on a path where the preview may never have rendered. Asserting
    // the disclosure rather than the wording keeps the guard while allowing the
    // false half of the sentence to be removed.
    assert.ok(/did not inspect/.test(integration), 'the failure branch must say so');
    assert.ok(
      !/`I opened \$\{webContext\.locator\}/.test(integration),
      'the failure branch must not claim the preview opened',
    );
  });
});

describe('Active web preview follow-ups', () => {
  it('recognises direct references to the open page and Browser Operator', () => {
    assert.strictEqual(shouldInspectActiveWebPreview('What is this website all about?'), true);
    assert.strictEqual(shouldInspectActiveWebPreview('Use the Chrome extension to inspect this page'), true);
    assert.strictEqual(shouldInspectActiveWebPreview('Summarize it'), true);
  });

  it('does not inspect the open page for unrelated conversation', () => {
    assert.strictEqual(shouldInspectActiveWebPreview('Help me plan tomorrow'), false);
  });
});
