process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { McpResourceInspector } from '../src/components/workbench/McpResourceInspector';

describe('McpResourceInspector unit tests', () => {
  it('renders resource name, URI, server badge, and text content', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(McpResourceInspector, {
        resource: {
          uri: 'file:///workspace/config.json',
          name: 'Project Configuration',
          mimeType: 'application/json',
          text: '{\n  "version": "1.0.0"\n}',
        },
        serverName: 'Local Stdio Server',
      })
    );

    assert.match(html, /Project Configuration/);
    assert.match(html, /file:\/\/\/workspace\/config\.json/);
    assert.match(html, /Local Stdio Server/);
    assert.match(html, /version/);
  });
});
