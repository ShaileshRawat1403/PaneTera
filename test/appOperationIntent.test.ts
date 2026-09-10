// test/appOperationIntent.test.ts
//
// ADR-005: a named application operation resolves to structured intent, a
// missing required value produces a clarification rather than an invented
// default, and ordinary conversation is not captured.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchAppOperationPhrase } from '../src/composer/appOperationIntent';
import { resolveIntent, DEFAULT_RESOLVER_CONTEXT, type ResolverContext } from '../src/composer/intentResolver';
import { planSubmission } from '../src/composer/submissionPlan';
import { capabilitiesFrom, executePlan } from '../src/composer/capabilities';

const PROPOSING: ResolverContext = { ...DEFAULT_RESOLVER_CONTEXT, supportedCapabilities: ['converse', 'proposal:propose'] };

describe('matchAppOperationPhrase', () => {
  it('reads the modifier and object the person named', () => {
    assert.deepEqual(matchAppOperationPhrase('add a bevel modifier to CanisterBody'), {
      appId: 'blender',
      operation: 'blender.add_modifier',
      parameters: { modifierType: 'BEVEL', objectId: 'CanisterBody' },
    });
    assert.deepEqual(matchAppOperationPhrase('Add a subdivision surface to "Lid Top" in Blender.')?.parameters, {
      modifierType: 'SUBSURF',
      objectId: 'Lid Top',
    });
  });

  it('leaves a missing object missing instead of choosing one', () => {
    assert.deepEqual(matchAppOperationPhrase('add a bevel modifier')?.parameters, { modifierType: 'BEVEL' });
  });

  it('reads a primitive only when Blender is named', () => {
    assert.deepEqual(matchAppOperationPhrase('create a cylinder named Pipe in blender'), {
      appId: 'blender',
      operation: 'blender.create_primitive',
      parameters: { type: 'CYLINDER', name: 'Pipe' },
    });
    assert.equal(matchAppOperationPhrase('create a cube'), null);
  });

  it('does not capture ordinary conversation or parameters it cannot read', () => {
    for (const input of [
      'add a mirror to the hallway',
      'how do I add a bevel modifier in blender?',
      'add a bevel modifier to Cube with width 0.1',
      'add a mirror modifier to the hallway',
      'please add a bevel modifier to Cube',
      'what does a boolean modifier do',
    ]) {
      assert.equal(matchAppOperationPhrase(input), null, input);
    }
  });
});

describe('application operations through the resolver and planner', () => {
  it('a complete request is ready and plans a proposal, never an execution', () => {
    const intent = resolveIntent('add a bevel modifier to CanisterBody', PROPOSING);
    assert.equal(intent.family, 'proposal');
    assert.equal(intent.readiness, 'ready');
    assert.deepEqual(intent.args, {
      action: 'propose',
      appId: 'blender',
      operation: 'blender.add_modifier',
      parameters: { modifierType: 'BEVEL', objectId: 'CanisterBody' },
    });
    assert.deepEqual(planSubmission({ intent, context: [], material: [] } as never), {
      kind: 'propose-app-operation',
      appId: 'blender',
      operation: 'blender.add_modifier',
      parameters: { modifierType: 'BEVEL', objectId: 'CanisterBody' },
    });
  });

  it('a missing required value asks and plans nothing', () => {
    const intent = resolveIntent('add a bevel modifier', PROPOSING);
    assert.equal(intent.readiness, 'needs-clarification');
    assert.match(intent.missing[0].prompt, /Which Blender object/);
    const plan = planSubmission({ intent, context: [], material: [] } as never);
    assert.equal(plan.kind, 'blocked');
  });

  it('is needs-capability when no proposal executor exists', () => {
    const intent = resolveIntent('add a bevel modifier to Cube');
    assert.equal(intent.readiness, 'needs-capability');
  });

  it('claims proposal:propose only with an executor, and dispatches to it', async () => {
    assert.ok(!capabilitiesFrom({}).includes('proposal:propose'));
    const seen: unknown[] = [];
    const executors = { proposeAppOperation: (plan: unknown) => { seen.push(plan); } };
    assert.ok(capabilitiesFrom(executors).includes('proposal:propose'));
    const plan = { kind: 'propose-app-operation' as const, appId: 'blender', operation: 'blender.create_primitive', parameters: { type: 'CUBE' } };
    assert.deepEqual(await executePlan(plan, executors), { kind: 'executed', planKind: 'propose-app-operation' });
    assert.deepEqual(seen, [plan]);
  });
});
