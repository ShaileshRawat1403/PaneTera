process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { BrowserEvidenceCanvas } from '../src/components/workbench/BrowserEvidenceCanvas';
import type { BrowserEvidenceRecord } from '../src/components/workbench/browserEvidenceSurfaceModel';

const SAMPLE_RECORDS: BrowserEvidenceRecord[] = [
  {
    captureId: 'cap-1',
    capability: 'browser.article.extract',
    source: { title: 'First Article', url: 'https://example.com/1', capturedAt: '2026-07-25T10:00:00Z' },
    data: { textContent: 'Content of first article' },
  },
  {
    captureId: 'cap-2',
    capability: 'browser.table.extract',
    source: { title: 'Data Table', url: 'https://example.com/2', capturedAt: '2026-07-25T10:05:00Z' },
    data: { textContent: 'Content of table' },
  },
];

describe('BrowserEvidenceCanvas unit tests', () => {
  it('renders split pane with extraction list on left and active record detail on right', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(BrowserEvidenceCanvas, {
        records: SAMPLE_RECORDS,
        onReturnToPreview: () => {},
      })
    );

    assert.match(html, /Evidence History/);
    assert.match(html, /example\.com/);
  });

  it('displays empty state when no evidence records exist', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(BrowserEvidenceCanvas, {
        records: [],
        onReturnToPreview: () => {},
      })
    );

    assert.match(html, /No extractions yet/);
  });
});
