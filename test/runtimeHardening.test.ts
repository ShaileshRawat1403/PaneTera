process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DEFAULT_GEMINI_MODEL, geminiGenerateContentUrl, geminiModelName } from '../server/modelConfig';

describe('runtime model configuration', () => {
  it('defaults to the current stable Gemini model', () => {
    assert.strictEqual(geminiModelName(undefined), DEFAULT_GEMINI_MODEL);
    assert.strictEqual(DEFAULT_GEMINI_MODEL, 'gemini-3.5-flash');
  });

  it('uses the stable v1 generateContent endpoint', () => {
    assert.strictEqual(
      geminiGenerateContentUrl('gemini-3.5-flash'),
      'https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent',
    );
  });

  it('accepts an explicit model without allowing URL injection', () => {
    assert.strictEqual(geminiModelName(' gemini-flash-latest '), 'gemini-flash-latest');
    assert.throws(() => geminiModelName('gemini/x?key=leak'), /unsupported characters/);
  });
});
