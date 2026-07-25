process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ChatInput from '../src/components/ChatInput';

describe('ChatInput unit tests', () => {
  it('renders ChatInput with studio variant without hardcoded hex colors', () => {
    const html = renderToStaticMarkup(
      <ChatInput onSend={() => {}} variant="studio" />
    );

    // 1. Token usage verification (no hardcoded hex)
    assert.ok(!html.includes('#171d27'), 'Should not contain #171d27');
    assert.ok(!html.includes('#a78bfa'), 'Should not contain #a78bfa');
    assert.ok(!html.includes('#0f131a'), 'Should not contain #0f131a');
    assert.ok(!html.includes('#7f8998'), 'Should not contain #7f8998');
    assert.ok(!html.includes('#626b78'), 'Should not contain #626b78');

    // 2. Accessibility: form role and aria-label
    // The paper has component="form" which should render as <form>
    assert.ok(html.includes('<form'), 'Should contain <form element');
    assert.ok(html.includes('aria-label="Message PaneTera"'), 'Should have aria-label on input');

    // 3. Send button aria-label
    assert.ok(html.includes('aria-label="Send message"'), 'Should have Send message aria-label');
  });
});
