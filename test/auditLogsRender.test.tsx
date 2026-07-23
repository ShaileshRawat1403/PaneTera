// test/auditLogsRender.test.tsx
//
// Render tests for the Audit row the panel uses. They render the real
// AuditRecordRow from a model view to static markup and assert what a person
// would actually see: the distinct actor kind, an outcome shown separately from
// a policy decision, scannable correlations, a preserved redaction boundary, and
// that a legacy or unknown record is never dressed up as a human or a system.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { AuditRecordRow, FilterSelect } from '../src/components/workbench/AuditLogsView';
import { toAuditRecordView, AUDIT_ACTOR_KIND_OPTIONS, type RawAuditRecord } from '../src/components/workbench/auditRecordViewModel';

function renderRow(raw: RawAuditRecord): string {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(AuditRecordRow, { view: toAuditRecordView(raw) }),
  );
}

const base: RawAuditRecord = {
  recordId: 'audit-1',
  schemaVersion: 2,
  timestamp: '2026-07-23T10:00:00.000Z',
  event: 'rig.invocation.completed',
  actor: { kind: 'connector', id: 'conn-1', label: 'Filesystem' },
  outcome: 'success',
  policyDecision: 'allowed',
  correlation: {},
  details: {},
};

describe('the audit row renders the typed model distinctly', () => {
  it('shows a human as label and fingerprint, never a raw operator id', () => {
    const markup = renderRow({ ...base, actor: { kind: 'human', id: 'a1b2c3d4e5f6a7b8', label: 'Local owner' } });
    assert.ok(markup.includes('Human operator'), 'human kind is labelled');
    assert.ok(markup.includes('Local owner'), 'the configured label is shown');
    assert.ok(markup.includes('a1b2c3d4e5f6a7b8'), 'the fingerprint is shown');
    assert.ok(!markup.includes('local-owner'), 'no raw operator id appears');
  });

  it('renders each actor kind with its own label', () => {
    assert.ok(renderRow({ ...base, actor: { kind: 'system', id: null, label: 's' } }).includes('PaneTera system'));
    assert.ok(renderRow({ ...base, actor: { kind: 'browser-extension', id: 'e', label: 'x' } }).includes('Browser Operator'));
    assert.ok(renderRow({ ...base, actor: { kind: 'mcp-client', id: 'm', label: 'x' } }).includes('MCP client'));
  });

  it('never promotes a legacy record to a human or system', () => {
    const markup = renderRow({ timestamp: '2026-07-23T10:00:00.000Z', event: 'workspace.enabled', details: { ownerId: 'alice' } });
    assert.ok(markup.includes('Unknown / unattributed'), 'legacy actor is unknown');
    assert.ok(markup.includes('Unattributed legacy record'), 'legacy is stated plainly');
    assert.ok(!markup.includes('PaneTera system'), 'not promoted to system');
    assert.ok(!markup.includes('Human operator'), 'not promoted to human');
  });

  it('shows outcome and policy as two separate chips', () => {
    const markup = renderRow({ ...base, outcome: 'error', policyDecision: 'allowed' });
    assert.ok(markup.includes('Outcome: Failed'), 'the outcome is shown');
    assert.ok(markup.includes('Policy: Allowed'), 'the policy is shown separately');
    assert.ok(!markup.includes('Outcome: Denied'), 'an error is not rendered as denied');
  });

  it('renders correlations with their identifier type', () => {
    const markup = renderRow({ ...base, correlation: { proposalId: 'prop-1', approvalId: 'appr-1', parentRecordId: 'rec-9' } });
    assert.ok(markup.includes('Proposal: prop-1'));
    assert.ok(markup.includes('Approval: appr-1'));
    assert.ok(markup.includes('Provenance: rec-9'));
  });

  it('preserves the redaction boundary and reconstructs no secret', () => {
    const markup = renderRow({ ...base, details: { authorization: '[redacted]', note: 'ok' } });
    assert.ok(markup.includes('[redacted]'), 'the redaction marker is shown');
    assert.ok(!markup.includes('Bearer '), 'no secret is reconstructed');
    assert.ok(markup.includes('already redacted'), 'the boundary is stated to the reader');
  });

  it('keeps the default row compact: the four summary facts are present', () => {
    const markup = renderRow(base);
    assert.ok(markup.includes('Connector'), 'actor');
    assert.ok(markup.includes('rig.invocation.completed'), 'event');
    assert.ok(markup.includes('Outcome: Succeeded'), 'outcome');
    assert.ok(markup.includes('Policy: Allowed'), 'policy');
  });

  it('discloses an agent record as an unverified claim, never a clean Agent', () => {
    const markup = renderRow({ ...base, actor: { kind: 'agent', id: 'a', label: 'bot' } });
    assert.ok(markup.includes('Unverified agent claim'), 'the claim is disclosed in words');
    assert.ok(!/>Agent<|: Agent</.test(markup), 'not shown as a plain Agent');
  });
});

describe('the filter controls carry accessible names', () => {
  it('gives each filter select an aria-label', () => {
    const markup = ReactDOMServer.renderToStaticMarkup(
      React.createElement(FilterSelect, {
        value: 'all',
        onChange: () => {},
        options: AUDIT_ACTOR_KIND_OPTIONS,
        allLabel: 'All actors',
        ariaLabel: 'Filter by actor kind',
      }),
    );
    assert.ok(markup.includes('aria-label="Filter by actor kind"'), 'the control is named for assistive tech');
  });
});
