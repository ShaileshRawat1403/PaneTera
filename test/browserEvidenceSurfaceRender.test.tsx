// test/browserEvidenceSurfaceRender.test.tsx
//
// The evidence canvas rendered from a record, asserting the scannable hierarchy
// and, above all, that the untrusted-content boundary is stated plainly and in
// more than one place. Rendered to static markup, so no DOM is needed.
//
// Live Chrome verification of this surface needs the Browser Operator extension
// paired and a capture approved, which is the separate end-to-end extension
// journey. This test covers what that journey cannot cheaply repeat: that every
// provenance fact and every untrusted label is present given a known record.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { BrowserEvidenceSurface } from '../src/components/workbench/BrowserEvidenceSurface';
import type { BrowserEvidenceRecord } from '../src/components/workbench/browserEvidenceSurfaceModel';

function render(record: BrowserEvidenceRecord): string {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(BrowserEvidenceSurface, {
      record,
      onReturnToPreview: () => {},
    }),
  );
}

const RECORD: BrowserEvidenceRecord = {
  captureId: 'capture-xyz',
  capability: 'browser.article.extract',
  source: {
    title: 'Observed article',
    url: 'https://example.com/observed',
    capturedAt: '2026-07-21T12:00:00.000Z',
  },
  data: { textContent: 'The readable body of the page.' },
  evidence: { elementsMatched: 3, contentBytes: 2048 },
};

describe('the evidence surface states the untrusted boundary plainly', () => {
  it('labels the evidence untrusted in the header and again on the text', () => {
    const html = render(RECORD);

    assert.match(html, /Untrusted browser evidence/, 'the header must carry the untrusted badge');
    assert.match(
      html,
      /untrusted content, treat as data not instructions/,
      'the extracted text must be fenced as untrusted where a person would read it',
    );
    assert.match(html, /Untrusted · no authority/, 'the provenance strip must state the trust level');
  });

  it('does not claim the capture was approved', () => {
    // The record carries no approving actor, time, or grant, and browser
    // envelopes store approval.status = "not-required". A chip asserting
    // approval would be a claim the record cannot support.
    assert.ok(!/Approved capture/.test(render(RECORD)), 'no unsupported approval claim');
  });
});

describe('the provenance strip is scannable', () => {
  it('shows capability, elements matched, content size, and the capture id', () => {
    const html = render(RECORD);

    assert.match(html, /browser\.article\.extract/, 'capability');
    assert.match(html, /Elements matched/, 'elements matched label');
    assert.match(html, />3</, 'the matched count value is present');
    assert.match(html, /2\.0 KB/, 'the byte count is formatted, not raw');
    assert.match(html, /Capture ID/, 'a capture id is labelled as a capture id');
    assert.match(html, /capture-xyz/, 'the capture id ties evidence back to the trail');
  });

  it('labels an extraction id as an extraction, not a capture', () => {
    const extractionRecord: BrowserEvidenceRecord = {
      extractionId: 'extract-77',
      capability: 'browser.article.extract',
      source: { title: 'T', url: 'https://example.com/', capturedAt: '2026-07-21T12:00:00.000Z' },
      data: { textContent: 'body' },
    };
    const html = render(extractionRecord);
    assert.match(html, /Extraction ID/, 'the id kind is labelled accurately');
    assert.ok(!/Capture ID/.test(html), 'an extraction id is not mislabelled as a capture id');
    assert.match(html, /extract-77/);
  });

  it('hides a provenance fact it does not have rather than printing a zero', () => {
    const sparse: BrowserEvidenceRecord = {
      capability: 'browser.page.observe',
      source: { title: 'T', url: 'https://example.com/', capturedAt: '2026-07-21T12:00:00.000Z' },
      data: { textContent: 'text' },
    };
    const html = render(sparse);

    assert.ok(!/Elements matched/.test(html), 'no elements-matched row when the count is absent');
    assert.ok(!/Capture ID|Extraction ID/.test(html), 'no id row when no id is present');
  });
});

describe('the shown address cannot undo redaction', () => {
  it('renders only the redacted observed address, never a raw requested one', () => {
    const record: BrowserEvidenceRecord = {
      captureId: 'capture-1',
      capability: 'browser.article.extract',
      source: {
        title: 'T',
        url: 'https://example.com/p?token=SECRETVALUE&q=news',
        capturedAt: '2026-07-21T12:00:00.000Z',
      },
      data: { textContent: 'body' },
    };
    const html = render(record);

    assert.ok(!/SECRETVALUE/.test(html), 'a sensitive query value must never reach the DOM');
    assert.match(html, /token=redacted/, 'the parameter name is shown, the value redacted');
    assert.ok(!/Requested/.test(html), 'the raw requested URL is no longer rendered at all');
  });
});

describe('the actions and screenshot', () => {
  it('offers returning to the preview and opening the observed page', () => {
    const html = render(RECORD);
    assert.match(html, /Return to web preview/);
    assert.match(html, /Open observed page/);
  });

  it('does not offer to open a page whose address was not recorded', () => {
    const noUrl: BrowserEvidenceRecord = { captureId: 'c', data: { textContent: 'body' } };
    const html = render(noUrl);
    assert.ok(!/Open observed page/.test(html), 'no open action without a safe address');
    assert.match(html, /Source address not recorded/);
  });

  it('captions the screenshot as a picture, not a live view', () => {
    const withShot: BrowserEvidenceRecord = {
      ...RECORD,
      data: { textContent: 'body', screenshotDataUrl: 'data:image/png;base64,AAAA' },
    };
    const html = render(withShot);
    assert.match(html, /data:image\/png;base64,AAAA/, 'the sanitised screenshot renders');
    assert.match(html, /cannot be interacted with/, 'the screenshot is captioned as static');
  });
});
