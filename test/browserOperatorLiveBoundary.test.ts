import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  isBrowserInspectedComponent,
  isBrowserLiveFrame,
} from '../src/utils/browserOperatorBridge';

const frame = {
  sessionId: 'live-1',
  title: 'Example',
  url: 'https://example.com/',
  screenshotDataUrl: 'data:image/jpeg;base64,AAAA',
  viewport: { width: 1280, height: 800, devicePixelRatio: 2 },
  capturedAt: '2026-07-24T12:00:00.000Z',
};

const component = {
  tagName: 'button',
  id: 'launch',
  classNames: ['primary'],
  role: 'button',
  text: 'Launch',
  attributes: { 'aria-label': 'Launch' },
  path: 'html > body > button#launch',
  rect: { x: 10, y: 20, width: 100, height: 40 },
  styles: { display: 'block' },
};

describe('Browser Operator live-message boundary', () => {
  it('accepts the canonical bounded frame and component shapes', () => {
    assert.strictEqual(isBrowserLiveFrame(frame), true);
    assert.strictEqual(isBrowserInspectedComponent(component), true);
  });

  it('rejects oversized pixels, credentialed URLs, and non-canonical timestamps', () => {
    assert.strictEqual(isBrowserLiveFrame({ ...frame, screenshotDataUrl: `data:image/jpeg;base64,${'A'.repeat(8_000_000)}` }), false);
    assert.strictEqual(isBrowserLiveFrame({ ...frame, url: 'https://user:secret@example.com/' }), false);
    assert.strictEqual(isBrowserLiveFrame({ ...frame, capturedAt: '2026-02-30T00:00:00.000Z' }), false);
  });

  it('rejects unbounded component content and invalid geometry', () => {
    assert.strictEqual(isBrowserInspectedComponent({ ...component, text: 'x'.repeat(1_001) }), false);
    assert.strictEqual(isBrowserInspectedComponent({ ...component, classNames: new Array(21).fill('class') }), false);
    assert.strictEqual(isBrowserInspectedComponent({ ...component, rect: { ...component.rect, width: Number.POSITIVE_INFINITY } }), false);
  });
});
