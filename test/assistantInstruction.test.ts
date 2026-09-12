// test/assistantInstruction.test.ts
//
// ADR-005: model instructions may not advertise tools, application state, or
// authority that the Rig capability inventory does not establish.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PANETERA_ASSISTANT_INSTRUCTION } from '../server/assistantInstruction';

describe('assistant instruction advertises only established authority', () => {
  it('grounds application and tool access in the connected Rig inventory', () => {
    assert.match(PANETERA_ASSISTANT_INSTRUCTION, /reached only through the capabilities in the connected Rig inventory/);
    assert.match(PANETERA_ASSISTANT_INSTRUCTION, /not available unless it is in your toolset/);
  });

  it('treats application changes as proposals that run only after review', () => {
    assert.match(PANETERA_ASSISTANT_INSTRUCTION, /reviews the stored proposal in Rig and approves it/);
    assert.match(PANETERA_ASSISTANT_INSTRUCTION, /never describe a proposal as applied/);
  });

  it('claims no ambient authority and names no application tools', () => {
    assert.ok(!PANETERA_ASSISTANT_INSTRUCTION.includes('full domain authority'));
    for (const name of ['get_track_list', 'inspect_track', 'transport_control', 'browser.dom.observe', 'Rig MCP Tools']) {
      assert.ok(!PANETERA_ASSISTANT_INSTRUCTION.includes(name), `must not advertise ${name}`);
    }
  });
});
