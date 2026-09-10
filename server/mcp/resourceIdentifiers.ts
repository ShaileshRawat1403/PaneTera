// server/mcp/resourceIdentifiers.ts
//
// MCP resource-template variables arrive percent-encoded: the SDK's
// UriTemplate.match returns the raw path segment, so a REAPER GUID such as
// {8F2A-11} arrives as %7B8F2A-11%7D and a Blender object named "My Cube"
// arrives as My%20Cube. Lookups must use the decoded identifier.

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import type { Variables } from '@modelcontextprotocol/sdk/shared/uriTemplate.js';

/**
 * Returns the decoded value of one resource-template variable.
 *
 * Missing, repeated, or malformed identifiers are rejected with an
 * InvalidParams protocol error rather than being looked up verbatim.
 */
export function decodeResourceVariable(variables: Variables, name: string): string {
  const raw = variables[name];
  const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  if (values.length !== 1 || values[0].length === 0) {
    throw new McpError(ErrorCode.InvalidParams, `Resource identifier "${name}" must be a single non-empty value.`);
  }
  try {
    return decodeURIComponent(values[0]);
  } catch {
    throw new McpError(ErrorCode.InvalidParams, `Resource identifier "${name}" has malformed percent-encoding.`);
  }
}
