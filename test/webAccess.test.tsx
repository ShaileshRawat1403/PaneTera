process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PANETERA_ASSISTANT_INSTRUCTION } from '../server/assistantInstruction';

describe('Web Access & Assistant Instruction unit tests', () => {
  it('PANETERA_ASSISTANT_INSTRUCTION includes active web access capabilities', () => {
    assert.ok(PANETERA_ASSISTANT_INSTRUCTION.includes('active web access'));
    assert.ok(PANETERA_ASSISTANT_INSTRUCTION.includes('web-preview probes'));
    assert.ok(PANETERA_ASSISTANT_INSTRUCTION.includes('public URL loading'));
  });
});
