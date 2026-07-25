process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import EmptyState from '../src/components/workstation/states/EmptyState';

describe('EmptyState unit tests', () => {
  it('renders title and description correctly', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(EmptyState, {
        title: 'No Items Found',
        description: 'There are no active items available.',
      })
    );

    assert.match(html, /No Items Found/);
    assert.match(html, /There are no active items available\./);
  });
});
