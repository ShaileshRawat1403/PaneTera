import { createHash } from 'crypto';
import type { CapabilityCard, CapabilitySnapshot } from './types';

const PROSE_FIELDS = new Set(['description', 'title', '$comment', 'examples', 'default']);
const MAX_SCHEMA_DEPTH = 8;
const MAX_SCHEMA_NODES = 400;
const MAX_IDENTIFIER = 64;

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

export function digest(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

export function structuralSchema(value: unknown): Record<string, unknown> | null {
  let nodes = 0;
  const visit = (input: unknown, depth: number): unknown => {
    nodes += 1;
    if (nodes > MAX_SCHEMA_NODES || depth > MAX_SCHEMA_DEPTH) return null;
    if (Array.isArray(input)) return input.slice(0, 100).map((item) => visit(item, depth + 1));
    if (!input || typeof input !== 'object') return input;
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(input as Record<string, unknown>)) {
      if (PROSE_FIELDS.has(key)) continue;
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      output[key] = visit(child, depth + 1);
    }
    return output;
  };
  const result = visit(value, 0);
  return result && typeof result === 'object' && !Array.isArray(result)
    ? result as Record<string, unknown>
    : null;
}

function identifier(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_IDENTIFIER || /[.!?]\s/.test(trimmed)) return fallback;
  return trimmed.replace(/[^a-zA-Z0-9_.:/-]/g, '_');
}

export function derivedDescription(name: string, schema: Record<string, unknown> | null): string {
  const safeName = identifier(name, 'capability');
  const properties = schema?.properties;
  const params = properties && typeof properties === 'object' && !Array.isArray(properties)
    ? Object.keys(properties as Record<string, unknown>).slice(0, 30)
      .map((key, index) => identifier(key, `parameter_${index + 1}`))
    : [];
  return params.length > 0
    ? `${safeName} accepts ${params.join(', ')}.`
    : `${safeName} accepts no declared parameters.`;
}

export function capabilityCard(
  connectionId: string,
  kind: CapabilityCard['kind'],
  declaration: Record<string, unknown>,
): CapabilityCard {
  const rawName = typeof declaration.name === 'string' ? declaration.name : 'unnamed';
  const name = identifier(rawName, 'unnamed');
  const schema = kind === 'tool' ? structuralSchema(declaration.inputSchema) : null;
  const structural = { kind, name, schema, uri: declaration.uri, uriTemplate: declaration.uriTemplate };
  const presentation = {
    name: declaration.name,
    title: declaration.title,
    description: declaration.description,
  };
  return {
    capabilityId: kind === 'tool' ? `${connectionId}.${name}` : `${connectionId}.${kind}.${name}`,
    kind,
    name,
    label: name,
    description: { source: 'schema-derived', text: derivedDescription(name, schema) },
    inputSchema: schema,
    rawDeclaration: declaration,
    permission: 'denied',
    enabled: false,
    structuralDigest: digest(structural),
    presentationDigest: digest(presentation),
  };
}

export function snapshotDigest(snapshot: Pick<CapabilitySnapshot, 'tools' | 'resources' | 'prompts'>): {
  structuralDigest: string;
  presentationDigest: string;
} {
  const cards = [...snapshot.tools, ...snapshot.resources, ...snapshot.prompts];
  return {
    structuralDigest: digest(cards.map(({ capabilityId, structuralDigest }) => ({ capabilityId, structuralDigest }))),
    presentationDigest: digest(cards.map(({ capabilityId, presentationDigest }) => ({ capabilityId, presentationDigest }))),
  };
}
