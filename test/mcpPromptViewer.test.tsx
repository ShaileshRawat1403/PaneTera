process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { McpPromptViewer } from '../src/components/workbench/McpPromptViewer';

describe('McpPromptViewer unit tests', () => {
  it('renders prompt title, description, and template arguments', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(McpPromptViewer, {
        prompt: {
          name: 'code_review_prompt',
          description: 'Generates a focused security review prompt.',
          arguments: [
            { name: 'targetFile', description: 'Path to source file', required: true },
          ],
        },
        serverName: 'Security MCP Server',
      })
    );

    assert.match(html, /code_review_prompt/);
    assert.match(html, /Generates a focused security review prompt\./);
    assert.match(html, /targetFile/);
    assert.match(html, /Attach Prompt to Conversation/);
  });
});
