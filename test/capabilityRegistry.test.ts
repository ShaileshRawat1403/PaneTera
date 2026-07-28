// test/capabilityRegistry.test.ts
//
// Tests for the capability registry.

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityRegistry } from '../server/agent/capabilityRegistry.js';

describe('CapabilityRegistry', () => {
  let registry: CapabilityRegistry;

  beforeEach(() => {
    registry = new CapabilityRegistry();
  });

  it('registers a capability', () => {
    registry.register({
      id: 'cap-1',
      name: 'Test Capability',
      description: 'A test capability',
      version: '1.0.0',
      category: 'core',
      source: 'test',
      healthCheckInterval: 0,
      tags: ['test'],
    });

    const cap = registry.get('cap-1');
    assert.ok(cap);
    assert.equal(cap.name, 'Test Capability');
    assert.equal(cap.health, 'healthy');
  });

  it('unregisters a capability', () => {
    registry.register({
      id: 'cap-1',
      name: 'Test',
      description: 'Test',
      version: '1.0.0',
      category: 'core',
      source: 'test',
      healthCheckInterval: 0,
      tags: [],
    });

    const unregistered = registry.unregister('cap-1');
    assert.ok(unregistered);

    const cap = registry.get('cap-1');
    assert.equal(cap, undefined);
  });

  it('filters by category', () => {
    registry.register({
      id: 'cap-core',
      name: 'Core',
      description: 'Core',
      version: '1.0.0',
      category: 'core',
      source: 'test',
      healthCheckInterval: 0,
      tags: [],
    });

    registry.register({
      id: 'cap-browser',
      name: 'Browser',
      description: 'Browser',
      version: '1.0.0',
      category: 'browser',
      source: 'test',
      healthCheckInterval: 0,
      tags: [],
    });

    const core = registry.getAll({ category: 'core' });
    const browser = registry.getAll({ category: 'browser' });

    assert.equal(core.length, 1);
    assert.equal(browser.length, 1);
  });

  it('filters by tag', () => {
    registry.register({
      id: 'cap-1',
      name: 'Tagged',
      description: 'Tagged',
      version: '1.0.0',
      category: 'core',
      source: 'test',
      healthCheckInterval: 0,
      tags: ['important'],
    });

    registry.register({
      id: 'cap-2',
      name: 'Untagged',
      description: 'Untagged',
      version: '1.0.0',
      category: 'core',
      source: 'test',
      healthCheckInterval: 0,
      tags: [],
    });

    const tagged = registry.getAll({ tag: 'important' });
    assert.equal(tagged.length, 1);
    assert.equal(tagged[0].id, 'cap-1');
  });

  it('runs health check', async () => {
    registry.register(
      {
        id: 'cap-1',
        name: 'Health Check',
        description: 'Health Check',
        version: '1.0.0',
        category: 'core',
        source: 'test',
        healthCheckInterval: 0,
        tags: [],
      },
      async () => ({ healthy: true, message: 'OK' })
    );

    const result = await registry.checkHealth('cap-1');
    assert.ok(result.healthy);
    assert.equal(result.message, 'OK');
  });

  it('returns stats', () => {
    registry.register({
      id: 'cap-1',
      name: 'Cap 1',
      description: 'Cap 1',
      version: '1.0.0',
      category: 'core',
      source: 'test',
      healthCheckInterval: 0,
      tags: [],
    });

    registry.register({
      id: 'cap-2',
      name: 'Cap 2',
      description: 'Cap 2',
      version: '1.0.0',
      category: 'browser',
      source: 'test',
      healthCheckInterval: 0,
      tags: [],
    });

    const stats = registry.getStats();
    assert.equal(stats.total, 2);
    assert.equal(stats.healthy, 2);
    assert.equal(stats.byCategory['core'], 1);
    assert.equal(stats.byCategory['browser'], 1);
  });

  it('emits events', () => {
    const events: string[] = [];
    registry.on('registered', () => events.push('registered'));
    registry.on('unregistered', () => events.push('unregistered'));

    registry.register({
      id: 'cap-1',
      name: 'Test',
      description: 'Test',
      version: '1.0.0',
      category: 'core',
      source: 'test',
      healthCheckInterval: 0,
      tags: [],
    });

    registry.unregister('cap-1');

    assert.deepEqual(events, ['registered', 'unregistered']);
  });

  it('returns capabilities in agent format', () => {
    registry.register({
      id: 'cap-1',
      name: 'Agent Cap',
      description: 'Agent capability',
      version: '1.0.0',
      category: 'core',
      source: 'test',
      healthCheckInterval: 0,
      tags: [],
    });

    const caps = registry.getAsCapabilities();
    assert.equal(caps.length, 1);
    assert.equal(caps[0].id, 'cap-1');
    assert.equal(caps[0].name, 'Agent Cap');
  });
});
