process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PreviewPanel } from '../src/components/PreviewPanel';

describe('PreviewPanel keyboard a11y & font size floor unit tests', () => {
  it('renders card headers with role="button", tabIndex={0}, aria-expanded, and 12px font size floors', () => {
    const html = renderToStaticMarkup(
      <PreviewPanel
        onClose={() => {}}
        onAction={() => {}}
        onRemoveItem={() => {}}
        onClearFeed={() => {}}
        onApproveAction={() => {}}
        token=""
        history={[
          {
            id: 'test-item-1',
            type: 'WorkspaceList',
            timestamp: '10:45 AM',
            data: {
              workspaces: [{ name: 'PaneTera', path: '/path/to/panetera' }],
            },
          },
          {
            id: 'test-item-2',
            type: 'ExecutionLogs',
            timestamp: '10:46 AM',
            data: {
              logs: ['Build started...', 'Build completed successfully.'],
              status: 'success',
            },
          },
        ]}
      />
    );

    // 1. Collapsible card header keyboard accessibility
    assert.ok(html.includes('role="button"'), 'Card header should have role="button"');
    assert.ok(html.includes('tabindex="0"'), 'Card header should have tabindex="0"');
    assert.ok(html.includes('aria-expanded="true"'), 'Card header should have aria-expanded');

    // 2. Technical output button
    assert.ok(html.includes('aria-expanded="false"'), 'Technical output button should have aria-expanded');

    // 3. Minimum font size floor verification (no < 12px / 0.75rem font sizes)
    assert.ok(!html.includes('font-size:0.55rem'), 'Should not contain font-size:0.55rem');
    assert.ok(!html.includes('font-size:0.65rem'), 'Should not contain font-size:0.65rem');
    assert.ok(!html.includes('font-size:0.68rem'), 'Should not contain font-size:0.68rem');
  });
});
