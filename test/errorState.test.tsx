process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import ErrorState from '../src/components/workstation/states/ErrorState';

describe('ErrorState unit tests', () => {
  it('renders error title and message correctly', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ErrorState, {
        title: 'Connection Error',
        message: 'Failed to connect to the MCP server.',
      })
    );

    assert.match(html, /Connection Error/);
    assert.match(html, /Failed to connect to the MCP server\./);
  });
});
