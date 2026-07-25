process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProposedActionCard } from '../src/components/ProposedActionCard';
import { AuditLogModal } from '../src/components/workstation/AuditLogModal';

describe('ProposedActionCard multi-step & AuditLogModal provenance unit tests', () => {
  it('renders multi-step execution proposal in ProposedActionCard', () => {
    const html = renderToStaticMarkup(
      <ProposedActionCard
        workspaceName="PaneTera"
        command="pipeline execution"
        onApprove={() => {}}
        onCancel={() => {}}
        steps={[
          { id: 's1', label: 'Verify workspace status', command: 'git status', riskLevel: 'safe' },
          { id: 's2', label: 'Build production bundle', command: 'npm run build', riskLevel: 'review' },
        ]}
      />
    );

    assert.ok(html.includes('EXECUTION STEPS (2)'));
    assert.ok(html.includes('Step 1:'));
    assert.ok(html.includes('git status'));
    assert.ok(html.includes('Step 2:'));
    assert.ok(html.includes('npm run build'));
  });

  it('renders AuditLogModal with interactive provenance tree nodes and SHA-256 digests', () => {
    const html = renderToStaticMarkup(
      <AuditLogModal open={true} onClose={() => {}} />
    );

    assert.ok(html.includes('Audit &amp; Provenance Tree') || html.includes('Audit & Provenance Tree'));
    assert.ok(html.includes('rig_execute_command'));
    assert.ok(html.includes('Digest:'));
    assert.ok(html.includes('browser_observation'));
  });
});
