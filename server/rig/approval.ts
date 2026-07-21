import { randomUUID } from 'crypto';
import { digest } from './canonical';
import type { ApprovedCapabilityCall, ProposedCapabilityCall } from './types';

export class CapabilityApprovalStore {
  private proposals = new Map<string, ProposedCapabilityCall>();
  private approvals = new Map<string, ApprovedCapabilityCall>();

  propose(input: Omit<ProposedCapabilityCall, 'proposalId' | 'argumentsDigest' | 'createdAt' | 'expiresAt' | 'approvalRequired'>): ProposedCapabilityCall {
    const createdAt = new Date();
    const proposal: ProposedCapabilityCall = {
      ...input,
      proposalId: randomUUID(),
      argumentsDigest: digest(input.arguments),
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + 5 * 60_000).toISOString(),
      approvalRequired: true,
    };
    this.proposals.set(proposal.proposalId, proposal);
    return proposal;
  }

  approve(proposalId: string): ApprovedCapabilityCall {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || Date.parse(proposal.expiresAt) <= Date.now()) throw new Error('Proposal is missing or expired.');
    const approval: ApprovedCapabilityCall = {
      approvalId: randomUUID(),
      proposalId,
      connectionId: proposal.connectionId,
      capabilityId: proposal.capabilityId,
      capabilityDigest: proposal.capabilityDigest,
      argumentsDigest: proposal.argumentsDigest,
      approvedAt: new Date().toISOString(),
      expiresAt: proposal.expiresAt,
      consumption: { state: 'unconsumed' },
    };
    this.approvals.set(approval.approvalId, approval);
    return approval;
  }

  claim(approvalId: string, expected: {
    connectionId: string;
    capabilityId: string;
    capabilityDigest: string;
    arguments: unknown;
  }): { approval: ApprovedCapabilityCall; claimId: string } {
    const approval = this.approvals.get(approvalId);
    if (!approval || Date.parse(approval.expiresAt) <= Date.now()) throw new Error('Approval is missing or expired.');
    if (approval.consumption.state !== 'unconsumed') throw new Error('Approval has already been claimed.');
    if (
      approval.connectionId !== expected.connectionId
      || approval.capabilityId !== expected.capabilityId
      || approval.capabilityDigest !== expected.capabilityDigest
      || approval.argumentsDigest !== digest(expected.arguments)
    ) {
      throw new Error('Connection, capability, or arguments changed after approval.');
    }
    const claimId = randomUUID();
    approval.consumption = { state: 'claimed', claimId, claimedAt: new Date().toISOString() };
    this.approvals.set(approvalId, approval);
    return { approval, claimId };
  }

  consume(approvalId: string, claimId: string): ApprovedCapabilityCall {
    const approval = this.approvals.get(approvalId);
    if (!approval || approval.consumption.state !== 'claimed' || approval.consumption.claimId !== claimId) {
      throw new Error('Only the active approval claim may be consumed.');
    }
    approval.consumption = { state: 'consumed', claimId, consumedAt: new Date().toISOString() };
    this.approvals.set(approvalId, approval);
    return approval;
  }
}
