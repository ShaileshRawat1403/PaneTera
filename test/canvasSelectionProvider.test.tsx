process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { CanvasSelectionProvider, useCanvasSelection } from '../src/components/workstation/CanvasSelectionProvider';

function ConsumerComponent() {
  const { selection } = useCanvasSelection();
  return React.createElement('div', null, selection ? selection.text : 'No selection');
}

describe('CanvasSelectionProvider unit tests', () => {
  it('provides selection context to children', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(
        CanvasSelectionProvider,
        null,
        React.createElement(ConsumerComponent)
      )
    );

    assert.match(html, /No selection/);
  });
});
