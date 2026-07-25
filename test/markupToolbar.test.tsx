process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import MarkupToolbar from '../src/components/workstation/MarkupToolbar';
import { CanvasSelectionProvider } from '../src/components/workstation/CanvasSelectionProvider';

describe('MarkupToolbar unit tests', () => {
  it('renders without throwing when wrapped in CanvasSelectionProvider', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(
        CanvasSelectionProvider,
        null,
        React.createElement(MarkupToolbar, {
          onAnnotate: () => {},
          onExplain: () => {},
          onSearch: () => {},
        })
      )
    );

    assert.ok(typeof html === 'string');
  });
});
