process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import SuccessState from '../src/components/workstation/states/SuccessState';

describe('SuccessState unit tests', () => {
  it('renders success title and message correctly', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(SuccessState, {
        title: 'Action Approved',
        message: 'Proposal signed off by operator.',
      })
    );

    assert.match(html, /Action Approved/);
    assert.match(html, /Proposal signed off by operator\./);
  });
});
