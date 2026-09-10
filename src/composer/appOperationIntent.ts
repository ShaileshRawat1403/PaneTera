// src/composer/appOperationIntent.ts
//
// Natural-language matcher for named operations on registered applications
// (ADR-005). It produces structured intent, never a proposal: the resolver
// decides readiness, Rig resolves the capability, and the server validates
// the arguments before anything is queued for review.
//
// Deliberately narrow. AGENTS.md records that loose matchers swallow real
// prompts, so a phrase must name the operation explicitly ("add a bevel
// modifier to Cube", "create a cube in blender"). Anything else, including a
// request with parameters this matcher cannot read, stays conversation. The
// matcher never fills in a value the person did not give.

export interface AppOperationMatch {
  appId: string;
  operation: string;
  parameters: Record<string, unknown>;
}

interface OperationSpec {
  /** Fields the capability schema requires. Mirrors the MCP tool declaration. */
  required: string[];
  prompts: Record<string, string>;
}

const OPERATIONS: Record<string, OperationSpec> = {
  'blender.add_modifier': {
    required: ['objectId', 'modifierType'],
    prompts: {
      objectId: 'Which Blender object should get the modifier? For example: "add a bevel modifier to Cube".',
      modifierType: 'Which modifier: bevel, subsurf, solidify, boolean, or mirror?',
    },
  },
  'blender.create_primitive': {
    required: ['type'],
    prompts: { type: 'Which primitive: cube, cylinder, sphere, plane, or torus?' },
  },
};

const MODIFIER_TYPES: Record<string, string> = {
  bevel: 'BEVEL',
  subsurf: 'SUBSURF',
  'subdivision surface': 'SUBSURF',
  subdivision: 'SUBSURF',
  solidify: 'SOLIDIFY',
  boolean: 'BOOLEAN',
  mirror: 'MIRROR',
};

/** A quoted name, or a single unquoted token such as Cube.001. */
const NAME = `(?:"([^"]+)"|'([^']+)'|([^\\s"']+))`;
const MODIFIER = '(bevel|subsurf|subdivision surface|subdivision|solidify|boolean|mirror)';

// Groups: 1 modifier, 2 "modifier", 3-5 object name, 6 "in blender".
const ADD_MODIFIER = new RegExp(`^add\\s+(?:an?\\s+)?${MODIFIER}(\\s+modifier)?(?:\\s+(?:to|on)\\s+${NAME})?(\\s+in\\s+blender)?$`, 'i');
// Groups: 1 primitive, 2-4 name.
const CREATE_PRIMITIVE = new RegExp(`^(?:add|create)\\s+(?:an?\\s+)?(cube|cylinder|sphere|plane|torus)(?:\\s+(?:named|called)\\s+${NAME})?\\s+in\\s+blender$`, 'i');

export function matchAppOperationPhrase(input: string): AppOperationMatch | null {
  const text = input.trim().replace(/[.!]+$/, '').replace(/\s+/g, ' ');

  const modifier = text.match(ADD_MODIFIER);
  if (modifier) {
    // "add a mirror to the hallway" names no modifier and no application.
    if (!modifier[2] && !modifier[6]) return null;
    const parameters: Record<string, unknown> = { modifierType: MODIFIER_TYPES[modifier[1].toLowerCase()] };
    const objectId = modifier[3] ?? modifier[4] ?? modifier[5];
    if (objectId) parameters.objectId = objectId;
    return { appId: 'blender', operation: 'blender.add_modifier', parameters };
  }

  const primitive = text.match(CREATE_PRIMITIVE);
  if (primitive) {
    const parameters: Record<string, unknown> = { type: primitive[1].toUpperCase() };
    const name = primitive[2] ?? primitive[3] ?? primitive[4];
    if (name) parameters.name = name;
    return { appId: 'blender', operation: 'blender.create_primitive', parameters };
  }

  return null;
}

/** Required fields the request did not supply. */
export function missingOperationFields(operation: string, parameters: Record<string, unknown>): string[] {
  const spec = OPERATIONS[operation];
  if (!spec) return [];
  return spec.required.filter((field) => parameters[field] === undefined || parameters[field] === '');
}

export function operationFieldPrompt(operation: string, field: string): string {
  return OPERATIONS[operation]?.prompts[field] ?? `What should ${field} be?`;
}
