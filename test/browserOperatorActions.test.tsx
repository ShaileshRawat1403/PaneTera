process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BrowserLiveSurface } from '../src/components/workbench/BrowserLiveSurface';

describe('Browser Operator Agentic Real-Time Actions unit tests', () => {
  it('renders BrowserLiveSurface with Click Mode and Scroll controls', () => {
    const mockFrame = {
      sessionId: 'session-123',
      title: 'GitHub Test Tab',
      url: 'https://github.com/ShaileshRawat1403',
      screenshotDataUrl: 'data:image/jpeg;base64,1234567890',
      viewport: { width: 1280, height: 800, devicePixelRatio: 1 },
      capturedAt: new Date().toISOString(),
    };

    const html = renderToStaticMarkup(
      <BrowserLiveSurface initialFrame={mockFrame} onClose={() => {}} />
    );

    assert.ok(html.includes('Click Mode'));
    assert.ok(html.includes('Scroll Down'));
    assert.ok(html.includes('Scroll Up'));
    assert.ok(html.includes('Inspect elements'));
  });
});
