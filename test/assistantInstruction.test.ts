// test/assistantInstruction.test.ts
//
// ADR-005: model instructions may not advertise tools, application state, or
// authority that the Rig capability inventory does not establish.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PANETERA_ASSISTANT_INSTRUCTION } from '../server/assistantInstruction';

describe('assistant instruction advertises only established authority', () => {
  it('names no tools that no connector provides', () => {
    for (const name of ['get_track_list', 'inspect_track', 'transport_control', 'browser.dom.observe', 'Rig MCP Tools']) {
      assert.ok(!PANETERA_ASSISTANT_INSTRUCTION.includes(name), `must not advertise ${name}`);
    }
  });

  it('describes no application state that was never observed', () => {
    for (const fabricated of ['CanisterBody', 'CanisterLid', 'PlasmaCore', 'KeyLight_Sun', 'StudioCamera', 'Kick to Bass']) {
      assert.ok(!PANETERA_ASSISTANT_INSTRUCTION.includes(fabricated), `must not describe ${fabricated}`);
    }
  });

  it('grounds application authority in the Rig inventory and review', () => {
    assert.ok(!PANETERA_ASSISTANT_INSTRUCTION.includes('full domain authority'));
    assert.match(PANETERA_ASSISTANT_INSTRUCTION, /reached only through the capabilities in the connected Rig inventory/);
    assert.match(PANETERA_ASSISTANT_INSTRUCTION, /reviews the stored proposal in Rig and approves it/);
  });
});
