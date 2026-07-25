import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getTesseraAppDataDir } from '../appData';
import { digest } from './canonical';
import type { ApprovedCapabilityCall, ProposedCapabilityCall } from './types';

interface ApprovalFile {
  version: 1;
  proposals: ProposedCapabilityCall[];
  approvals: ApprovedCapabilityCall[];
}

export class CapabilityApprovalStore {
  private readonly filePath: string;

  constructor(root = getTesseraAppDataDir()) {
    const dir = path.join(root, 'rig');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.filePath = path.join(dir, 'approvals.json');
    this.reconcileAfterRestart();
  }

  listProposals(): ProposedCapabilityCall[] {
    return this.read().proposals.filter((p) => Date.parse(p.expiresAt) > Date.now());
  }

  getProposal(proposalId: string): ProposedCapabilityCall | null {
    const found = this.read().proposals.find((p) => p.proposalId === proposalId);
    if (!found || Date.parse(found.expiresAt) <= Date.now()) return null;
    return found;
  }

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

    const file = this.read();
    file.proposals.push(proposal);
    this.writeSync(file);
    return proposal;
  }

  approve(proposalId: string): ApprovedCapabilityCall {
    const file = this.read();
    const proposal = file.proposals.find((p) => p.proposalId === proposalId);
    if (!proposal || Date.parse(proposal.expiresAt) <= Date.now()) {
      throw new Error('Proposal is missing or expired.');
    }

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

    file.approvals.push(approval);
    this.writeSync(file);
    return approval;
  }

  claim(approvalId: string, expected: {
    connectionId: string;
    capabilityId: string;
    capabilityDigest: string;
    arguments: unknown;
  }): { approval: ApprovedCapabilityCall; claimId: string } {
    const file = this.read();
    const approval = file.approvals.find((a) => a.approvalId === approvalId);
    if (!approval || Date.parse(approval.expiresAt) <= Date.now()) {
      throw new Error('Approval is missing or expired.');
    }
    if (approval.consumption.state !== 'unconsumed') {
      throw new Error('Approval has already been claimed.');
    }
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
    this.writeSync(file);
    return { approval, claimId };
  }

  consume(approvalId: string, claimId: string): ApprovedCapabilityCall {
    const file = this.read();
    const approval = file.approvals.find((a) => a.approvalId === approvalId);
    if (!approval || approval.consumption.state !== 'claimed' || approval.consumption.claimId !== claimId) {
      throw new Error('Only the active approval claim may be consumed.');
    }

    approval.consumption = { state: 'consumed', claimId, consumedAt: new Date().toISOString() };
    this.writeSync(file);
    return approval;
  }

  private read(): ApprovalFile {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as ApprovalFile;
      if (parsed.version !== 1 || !Array.isArray(parsed.proposals) || !Array.isArray(parsed.approvals)) {
        throw new Error('Invalid approval store file format.');
      }
      return parsed;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { version: 1, proposals: [], approvals: [] };
      }
      throw error;
    }
  }

  private writeSync(file: ApprovalFile): void {
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, this.filePath);
  }

  private reconcileAfterRestart(): void {
    const file = this.read();
    const now = Date.now();
    const freshProposals = file.proposals.filter((p) => Date.parse(p.expiresAt) > now);
    const freshApprovals = file.approvals.filter((a) => Date.parse(a.expiresAt) > now);

    if (freshProposals.length !== file.proposals.length || freshApprovals.length !== file.approvals.length) {
      this.writeSync({
        version: 1,
        proposals: freshProposals,
        approvals: freshApprovals,
      });
    }
  }
}
