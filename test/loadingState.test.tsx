process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import LoadingState from '../src/components/workstation/states/LoadingState';

describe('LoadingState unit tests', () => {
  it('renders loading message correctly', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(LoadingState, {
        message: 'Fetching workbench evidence...',
      })
    );

    assert.match(html, /Fetching workbench evidence\.\.\./);
  });
});
