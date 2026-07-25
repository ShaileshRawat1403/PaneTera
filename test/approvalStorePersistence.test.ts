process.env.NODE_ENV = 'test';

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CapabilityApprovalStore } from '../server/rig/approval';

describe('CapabilityApprovalStore persistence and reconciliation tests', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-approval-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('persists proposals and approvals across store instances', () => {
    const store1 = new CapabilityApprovalStore(tempDir);
    const proposal = store1.propose({
      connectionId: 'conn-1',
      capabilityId: 'tool-read',
      capabilityDigest: 'dig-1',
      arguments: { file: 'index.ts' },
      displayArguments: { file: 'index.ts' },
    });

    const approval = store1.approve(proposal.proposalId);
    assert.strictEqual(approval.proposalId, proposal.proposalId);

    // Instantiate store2 with same tempDir
    const store2 = new CapabilityApprovalStore(tempDir);
    const retrievedProposal = store2.getProposal(proposal.proposalId);
    assert.ok(retrievedProposal);
    assert.strictEqual(retrievedProposal.proposalId, proposal.proposalId);
  });

  it('reconciles expired proposals on startup', () => {
    const store1 = new CapabilityApprovalStore(tempDir);
    const now = new Date();
    const expiredProposal = {
      proposalId: 'expired-id',
      connectionId: 'conn-1',
      capabilityId: 'tool-read',
      capabilityDigest: 'dig-1',
      argumentsDigest: 'arg-dig',
      arguments: {},
      displayArguments: {},
      createdAt: new Date(now.getTime() - 10 * 60_000).toISOString(),
      expiresAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
      approvalRequired: true as const,
    };

    // Manually write file with expired proposal
    const filePath = path.join(tempDir, 'rig', 'approvals.json');
    fs.mkdirSync(path.join(tempDir, 'rig'), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ version: 1, proposals: [expiredProposal], approvals: [] }));

    // Instantiate store2 which runs reconcileAfterRestart
    const store2 = new CapabilityApprovalStore(tempDir);
    const proposals = store2.listProposals();
    assert.strictEqual(proposals.length, 0);
  });
});
