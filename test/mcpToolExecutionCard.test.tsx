process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { McpToolExecutionCard } from '../src/components/workbench/McpToolExecutionCard';

describe('McpToolExecutionCard unit tests', () => {
  it('renders tool name, server name, latency, and formatted result', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(McpToolExecutionCard, {
        toolName: 'workspace.queryGitStatus',
        serverName: 'Workspace Stdio Adapter',
        durationMs: 42,
        result: { branch: 'dev', clean: true },
      })
    );

    assert.match(html, /workspace\.queryGitStatus/);
    assert.match(html, /Workspace Stdio Adapter/);
    assert.match(html, /42ms/);
    assert.match(html, /TOOL RESULT/);
    assert.match(html, /branch/);
  });
});
