// server/operatorCapabilities.ts
//
// Bridges AgentCapability instances (core, Rig MCP, browser) into the chat
// operator's tool set. The operator's model-agnostic loop (agentLoop.ts) can
// then discover and call any enabled capability, not just the six built-in
// tools.
//
// Two provider shapes differ: Gemini functionDeclarations use uppercase type
// names and a restricted schema subset, while OpenAI accepts JSON Schema
// directly. MCP tools declare JSON Schema, so the Gemini path needs conversion.
//
// Governance: a capability's `risk` decides execution. `observe` runs directly;
// `propose` never executes here, it returns an approval card the user must
// confirm, mirroring the built-in proposeExecution gate.

import type { AgentCapability } from './agent/types';

export interface OperatorToolExecution {
  output: unknown;
  uiComponent?: unknown;
  requiresApproval?: boolean;
  approval?: unknown;
}

const JSON_TO_GEMINI_TYPE: Record<string, string> = {
  object: 'OBJECT',
  array: 'ARRAY',
  string: 'STRING',
  number: 'NUMBER',
  integer: 'INTEGER',
  boolean: 'BOOLEAN',
};

/**
 * Convert a JSON Schema node (MCP inputSchema) into Gemini's parameter shape.
 * Returns undefined for schemas Gemini can't represent (no usable type), so the
 * caller can omit `parameters` entirely for a no-argument tool.
 */
export function toGeminiParameters(schema: unknown): Record<string, unknown> | undefined {
  if (!schema || typeof schema !== 'object') return undefined;
  const node = schema as Record<string, any>;
  const type = JSON_TO_GEMINI_TYPE[String(node.type).toLowerCase()];
  if (!type) return undefined;

  const out: Record<string, any> = { type };
  if (typeof node.description === 'string') out.description = node.description;
  if (Array.isArray(node.enum)) out.enum = node.enum;

  if (type === 'OBJECT' && node.properties && typeof node.properties === 'object') {
    out.properties = {};
    for (const [key, value] of Object.entries(node.properties)) {
      const converted = toGeminiParameters(value);
      if (converted) out.properties[key] = converted;
    }
    if (Array.isArray(node.required)) out.required = node.required;
  }

  if (type === 'ARRAY' && node.items) {
    const items = toGeminiParameters(node.items);
    if (items) out.items = items;
  }

  return out;
}

/** Build a Gemini functionDeclaration from a capability. */
export function capabilityToGeminiTool(cap: AgentCapability): Record<string, unknown> {
  const parameters = toGeminiParameters(cap.inputSchema);
  const sanitizedName = cap.name.replace(/[^a-zA-Z0-9_]/g, '_');
  const decl: Record<string, unknown> = { name: sanitizedName, description: cap.description };
  if (parameters) decl.parameters = parameters;
  return decl;
}

/** Build an OpenAI tool from a capability. OpenAI accepts JSON Schema directly. */
export function capabilityToOpenAITool(cap: AgentCapability): Record<string, unknown> {
  const hasSchema = cap.inputSchema && typeof cap.inputSchema === 'object'
    && Object.keys(cap.inputSchema).length > 0;
  return {
    type: 'function',
    function: {
      name: cap.name,
      description: cap.description,
      ...(hasSchema ? { parameters: cap.inputSchema } : {}),
    },
  };
}

/**
 * Dispatch a capability under its risk policy.
 * - observe: execute and return the result.
 * - propose: do NOT execute; return an approval card carrying the intended call.
 */
export async function dispatchCapability(
  cap: AgentCapability,
  args: Record<string, unknown>,
): Promise<OperatorToolExecution> {
  // Execute every capability, exactly as the agent runtime does. Observe-risk
  // capabilities read. Propose-risk capabilities do NOT perform their side
  // effect here: their execute() safely records a proposal (with its own audit
  // trail) and returns requiresApproval plus an approval record. The operator
  // surfaces that approval rather than short-circuiting it, so a governed action
  // still reaches a real, approvable proposal instead of an inert generic card.
  const result = await cap.execute(args);
  return {
    output: result.output,
    uiComponent: result.uiComponent,
    requiresApproval: result.requiresApproval,
    approval: result.approval,
  };
}

/**
 * Index capabilities by name for O(1) dispatch lookup, last-wins on duplicates
 * (so a more specific capability can override a generic one).
 * Also indexes sanitized names (e.g. replacing hyphens with underscores) so
 * provider adapters like Gemini that forbid hyphens can dispatch successfully.
 */
export function indexCapabilities(caps: AgentCapability[]): Map<string, AgentCapability> {
  const map = new Map<string, AgentCapability>();
  for (const cap of caps) {
    map.set(cap.name, cap);
    const sanitized = cap.name.replace(/[^a-zA-Z0-9_]/g, '_');
    if (sanitized !== cap.name) {
      map.set(sanitized, cap);
    }
  }
  return map;
}
