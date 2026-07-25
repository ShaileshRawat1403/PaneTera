process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { BrowserLiveSurface } from '../src/components/workbench/BrowserLiveSurface';
import type { BrowserLiveFrame } from '../src/utils/browserOperatorBridge';

const FRAME: BrowserLiveFrame = {
  sessionId: 'live-1',
  title: 'Example page',
  url: 'https://example.com/',
  screenshotDataUrl: 'data:image/jpeg;base64,AAAA',
  viewport: { width: 1280, height: 800, devicePixelRatio: 2 },
  capturedAt: '2026-07-24T12:00:00.000Z',
};

describe('Browser Operator real Chrome surface', () => {
  it('renders real pixels with inspection and session controls', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(BrowserLiveSurface, { initialFrame: FRAME, onClose: () => {} }),
    );
    assert.match(html, /Real Chrome · untrusted/);
    assert.match(html, /data:image\/jpeg;base64,AAAA/);
    assert.match(html, /Live Chrome view of Example page/);
    assert.match(html, /Inspect elements/);
    assert.match(html, /Open Chrome tab/);
    assert.match(html, /End live view/);
    assert.match(html, /Page scripts run in Chrome, not in PaneTera/);
  });

  it('does not present the live frame as extracted evidence or an iframe', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(BrowserLiveSurface, { initialFrame: FRAME, onClose: () => {} }),
    );
    assert.ok(!/Extracted text/.test(html));
    assert.ok(!/<iframe/i.test(html));
    assert.ok(!/cannot be interacted with/.test(html));
  });
});
