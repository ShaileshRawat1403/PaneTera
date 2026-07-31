// test/operatorCapabilities.test.ts
// Covers the capability -> provider tool conversion and risk-aware dispatch that
// let the chat operator use Rig/browser capabilities safely.

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  toGeminiParameters,
  capabilityToGeminiTool,
  capabilityToOpenAITool,
  dispatchCapability,
  indexCapabilities,
} from '../server/operatorCapabilities';
import type { AgentCapability } from '../server/agent/types';

function cap(partial: Partial<AgentCapability> & { name: string }): AgentCapability {
  return {
    name: partial.name,
    description: partial.description ?? 'desc',
    inputSchema: partial.inputSchema ?? {},
    risk: partial.risk ?? 'observe',
    execute: partial.execute ?? (async () => ({ output: { ok: true } })),
  };
}

describe('JSON Schema to Gemini parameter conversion', () => {
  it('uppercases types and preserves properties, required, enum, nesting', () => {
    const schema = {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'the query' },
        limit: { type: 'integer' },
        mode: { type: 'string', enum: ['fast', 'slow'] },
        filters: { type: 'array', items: { type: 'string' } },
        nested: { type: 'object', properties: { flag: { type: 'boolean' } } },
      },
      required: ['query'],
    };
    const g = toGeminiParameters(schema) as any;
    assert.strictEqual(g.type, 'OBJECT');
    assert.strictEqual(g.properties.query.type, 'STRING');
    assert.strictEqual(g.properties.query.description, 'the query');
    assert.strictEqual(g.properties.limit.type, 'INTEGER');
    assert.deepStrictEqual(g.properties.mode.enum, ['fast', 'slow']);
    assert.strictEqual(g.properties.filters.type, 'ARRAY');
    assert.strictEqual(g.properties.filters.items.type, 'STRING');
    assert.strictEqual(g.properties.nested.properties.flag.type, 'BOOLEAN');
    assert.deepStrictEqual(g.required, ['query']);
  });

  it('returns undefined for schemas with no usable type', () => {
    assert.strictEqual(toGeminiParameters({}), undefined);
    assert.strictEqual(toGeminiParameters(null), undefined);
    assert.strictEqual(toGeminiParameters({ type: 'weird' }), undefined);
  });
});

describe('capability to provider tool declarations', () => {
  it('Gemini omits parameters for a no-argument tool', () => {
    const decl = capabilityToGeminiTool(cap({ name: 'ping' })) as any;
    assert.strictEqual(decl.name, 'ping');
    assert.ok(!('parameters' in decl), 'no parameters key when schema is empty');
  });

  it('Gemini includes converted parameters when a schema is present', () => {
    const decl = capabilityToGeminiTool(cap({
      name: 'search', inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
    })) as any;
    assert.strictEqual(decl.parameters.type, 'OBJECT');
    assert.strictEqual(decl.parameters.properties.q.type, 'STRING');
  });

  it('OpenAI wraps in a function tool and passes JSON Schema through', () => {
    const schema = { type: 'object', properties: { q: { type: 'string' } } };
    const tool = capabilityToOpenAITool(cap({ name: 'search', inputSchema: schema })) as any;
    assert.strictEqual(tool.type, 'function');
    assert.strictEqual(tool.function.name, 'search');
    assert.deepStrictEqual(tool.function.parameters, schema);
  });

  it('OpenAI omits parameters for a no-argument tool', () => {
    const tool = capabilityToOpenAITool(cap({ name: 'ping' })) as any;
    assert.ok(!('parameters' in tool.function));
  });
});

describe('risk-aware dispatch', () => {
  it('executes observe-risk capabilities and returns output + uiComponent', async () => {
    let called = false;
    const c = cap({
      name: 'readThing', risk: 'observe',
      execute: async (args) => { called = true; return { output: { echoed: args }, uiComponent: { type: 'Card' } }; },
    });
    const r = await dispatchCapability(c, { a: 1 });
    assert.ok(called, 'observe capability executed');
    assert.deepStrictEqual(r.output, { echoed: { a: 1 } });
    assert.deepStrictEqual(r.uiComponent, { type: 'Card' });
  });

  it('does NOT execute propose-risk capabilities; returns an approval card', async () => {
    let called = false;
    const c = cap({
      name: 'writeThing', risk: 'propose',
      execute: async () => { called = true; return { output: 'should not run' }; },
    });
    const r = await dispatchCapability(c, { path: '/x' }) as any;
    assert.strictEqual(called, false, 'propose capability must not execute');
    assert.strictEqual(r.output.proposed, true);
    assert.strictEqual(r.uiComponent.type, 'ProposedAction');
    assert.strictEqual(r.uiComponent.data.requiresApproval, true);
    assert.strictEqual(r.uiComponent.data.capability, 'writeThing');
  });
});

describe('indexCapabilities', () => {
  it('maps by name, last-wins on duplicates', () => {
    const a = cap({ name: 'dup', description: 'first' });
    const b = cap({ name: 'dup', description: 'second' });
    const map = indexCapabilities([a, b]);
    assert.strictEqual(map.get('dup')!.description, 'second');
    assert.strictEqual(map.size, 1);
  });
});
