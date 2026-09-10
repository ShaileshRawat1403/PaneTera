// test/mcpResourceIdentifiers.test.ts

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { UriTemplate } from '@modelcontextprotocol/sdk/shared/uriTemplate.js';
import { decodeResourceVariable } from '../server/mcp/resourceIdentifiers';

function variablesFor(template: string, uri: string) {
  const variables = new UriTemplate(template).match(new URL(uri).toString());
  assert.ok(variables, `${uri} should match ${template}`);
  return variables;
}

function assertInvalidParams(fn: () => unknown, pattern: RegExp) {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof McpError);
    assert.equal(error.code, ErrorCode.InvalidParams);
    assert.match(error.message, pattern);
    return true;
  });
}

describe('decodeResourceVariable', () => {
  it('decodes a REAPER GUID with braces', () => {
    const variables = variablesFor('reaper://track/{guid}', 'reaper://track/{8F2A-11}');
    assert.equal(variables.guid, '%7B8F2A-11%7D');
    assert.equal(decodeResourceVariable(variables, 'guid'), '{8F2A-11}');
  });

  it('decodes a Blender object name with spaces', () => {
    const variables = variablesFor('blender://object/{objectId}', 'blender://object/My Cube.001');
    assert.equal(decodeResourceVariable(variables, 'objectId'), 'My Cube.001');
  });

  it('leaves plain identifiers unchanged', () => {
    assert.equal(decodeResourceVariable({ objectId: 'Cube' }, 'objectId'), 'Cube');
  });

  it('rejects malformed percent-encoding with a controlled error', () => {
    assertInvalidParams(() => decodeResourceVariable({ guid: '%E0%A4%A' }, 'guid'), /malformed percent-encoding/);
    assertInvalidParams(() => decodeResourceVariable({ guid: '%' }, 'guid'), /malformed percent-encoding/);
  });

  it('rejects missing, empty, or repeated identifiers', () => {
    assertInvalidParams(() => decodeResourceVariable({}, 'guid'), /single non-empty value/);
    assertInvalidParams(() => decodeResourceVariable({ guid: '' }, 'guid'), /single non-empty value/);
    assertInvalidParams(() => decodeResourceVariable({ guid: ['a', 'b'] }, 'guid'), /single non-empty value/);
  });
});
