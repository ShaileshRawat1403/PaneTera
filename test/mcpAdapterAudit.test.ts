process.env.NODE_ENV = 'test';

import assert from 'node:assert';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { McpWorkspaceAdapter, auditWorkspaceAdapter, auditWorkspaceCaller } from '../server/mcpAdapter';

describe('legacy workspace adapter audit attribution', () => {
  it('attributes adapter lifecycle and observed failures to PaneTera', () => {
    const started = auditWorkspaceAdapter({ event: 'workspace.adapter.started', workspaceId: 'ws', outcome: 'success' });
    const failed = auditWorkspaceAdapter({ event: 'workspace.adapter.error', workspaceId: 'ws', outcome: 'error' });
    assert.strictEqual(started.actor.kind, 'system');
    assert.strictEqual(started.outcome, 'success');
    assert.strictEqual(failed.actor.kind, 'system');
    assert.strictEqual(failed.outcome, 'error');
  });

  it('keeps the caller unattributed for policy decisions', () => {
    const record = auditWorkspaceCaller({
      event: 'workspace.read.denied', workspaceId: 'ws', outcome: 'denied', policyDecision: 'denied',
    });
    assert.strictEqual(record.actor.kind, 'unknown');
    assert.strictEqual(record.actor.label, 'workspace-caller-unattributed');
    assert.strictEqual(record.outcome, 'denied');
  });

  it('enforces host policy before starting the adapter process', async () => {
    const adapter = new McpWorkspaceAdapter('policy-first', path.resolve('.'));
    let started = false;
    adapter.start = async () => { started = true; };
    await assert.rejects(
      adapter.call('workspace.readFile', { relativePath: '.env' }),
      /Access Denied/,
    );
    assert.strictEqual(started, false, 'a forbidden request must not launch a subprocess');
  });

  it('contains no legacy audit calls or raw argument logging', () => {
    const source = readFileSync(new URL('../server/mcpAdapter.ts', import.meta.url), 'utf8');
    assert.ok(!source.includes('logAudit('));
    assert.ok(!/details:\s*\{[^}]*args\b/.test(source), 'request arguments are not copied into audit details');
  });

  it('does not claim startup success before the process survives its startup check', () => {
    const source = readFileSync(new URL('../server/mcpAdapter.ts', import.meta.url), 'utf8');
    const wait = source.indexOf('await new Promise(resolve => setTimeout(resolve, 500))');
    const alive = source.indexOf('this.childProcess.exitCode !== null', wait);
    const success = source.indexOf("event: 'workspace.adapter.started'", wait);
    assert.ok(wait >= 0 && alive > wait && success > alive);
  });
});
