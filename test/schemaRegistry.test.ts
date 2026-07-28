// test/schemaRegistry.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { schemaRegistry } from '../server/schema/registry';
import { validateCardSchema, validateCardData } from '../server/schema/validator';
import { getDeploymentStatusPayload, getMetricsPayload, getApprovalGatePayload, registerItOpsDomain } from '../server/domains/itops/tools';

describe('Schema Registry & Framework Unit Tests', () => {
  it('registers baseline default schemas', () => {
    const schemas = schemaRegistry.listSchemas();
    assert.strictEqual(schemas.length >= 3, true);
    assert.ok(schemaRegistry.getSchema('generic.status-board'));
    assert.ok(schemaRegistry.getSchema('generic.metric-group'));
    assert.ok(schemaRegistry.getSchema('generic.proposal-gate'));
  });

  it('validates card schema definitions correctly', () => {
    const validSchema = {
      id: 'custom.test-schema',
      version: '1.0.0',
      domain: 'custom',
      type: 'status-board',
      title: 'Test Board',
      fields: [{ name: 'items', type: 'array', label: 'Items' }],
      actions: [],
    };
    const res = validateCardSchema(validSchema);
    assert.strictEqual(res.valid, true);

    const invalidSchema = {
      id: 'invalid-schema',
      type: 'unknown-type',
      fields: 'not-an-array',
    };
    const resInv = validateCardSchema(invalidSchema);
    assert.strictEqual(resInv.valid, false);
    assert.strictEqual(resInv.errors.length > 0, true);
  });

  it('registers and retrieves IT Ops domain schemas', () => {
    registerItOpsDomain();
    const itOpsSchemas = schemaRegistry.listSchemas('itops');
    assert.strictEqual(itOpsSchemas.length >= 3, true);
    assert.ok(schemaRegistry.getSchema('itops.deployment-pipeline'));
    assert.ok(schemaRegistry.getSchema('itops.metrics-dashboard'));
    assert.ok(schemaRegistry.getSchema('itops.approval-gate'));
  });

  it('validates IT Ops card data payloads', () => {
    registerItOpsDomain();

    const deploymentSchema = schemaRegistry.getSchema('itops.deployment-pipeline')!;
    const deploymentPayload = getDeploymentStatusPayload();
    const v1 = validateCardData(deploymentSchema, deploymentPayload.data);
    assert.strictEqual(v1.valid, true);

    const metricsSchema = schemaRegistry.getSchema('itops.metrics-dashboard')!;
    const metricsPayload = getMetricsPayload();
    const v2 = validateCardData(metricsSchema, metricsPayload.data);
    assert.strictEqual(v2.valid, true);

    const gateSchema = schemaRegistry.getSchema('itops.approval-gate')!;
    const gatePayload = getApprovalGatePayload();
    const v3 = validateCardData(gateSchema, gatePayload.data);
    assert.strictEqual(v3.valid, true);
  });
});
