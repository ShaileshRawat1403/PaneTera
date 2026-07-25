process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import ExtractionCard from '../src/components/workbench/ExtractionCard';

describe('ExtractionCard unit tests', () => {
  it('renders code block extraction type', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ExtractionCard, {
        data: {
          type: 'code-block',
          code: 'const x = 42;',
          language: 'typescript',
        },
      })
    );

    assert.match(html, /Code Block/);
    assert.match(html, /const x = 42;/);
  });

  it('renders article extraction type', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ExtractionCard, {
        data: {
          type: 'article',
          textContent: 'Sample article body content.',
        },
      })
    );

    assert.match(html, /Article/);
    assert.match(html, /Sample article body content\./);
  });
});
