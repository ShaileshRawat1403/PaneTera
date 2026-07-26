// src/components/UnifiedApprovalCard.tsx
//
// Single entry point for all approval-gated actions. Delegates to the
// appropriate specialized card based on action type.

import React from 'react';
import { ProposedActionCard } from './ProposedActionCard';
import { BrowserActionProposalCard } from './BrowserActionProposalCard';

interface ShellProposal {
  kind: 'shell';
  workspaceName: string;
  command: string;
  reason?: string;
  riskLevel?: 'safe' | 'review' | 'dangerous';
  executionMode?: 'local-shell' | 'apple-container' | 'dax' | 'dry-run';
  isDryRun?: boolean;
  description?: string;
}

interface BrowserActionProposal {
  kind: 'browser-action';
  runId: string;
  action: {
    actionId: string;
    capability: string;
    status: string;
    riskLevel: string;
    expectedOutcome: string;
    expiresAt: string;
    previewStatus?: 'queued' | 'claimed' | 'previewed' | 'stale-target' | 'failed';
    previewResult?: { message?: string };
    target: {
      expectedOrigin: string;
      role: string;
      accessibleName: string;
      elementFingerprint: string;
    };
  };
  latestEvent?: { type: string; summary: string };
}

type UnifiedProposal = ShellProposal | BrowserActionProposal;

interface UnifiedApprovalCardProps {
  proposal: UnifiedProposal;
  onApprove: () => void | Promise<void>;
  onCancel?: () => void;
  variant?: 'panel' | 'chat';
}

export const UnifiedApprovalCard: React.FC<UnifiedApprovalCardProps> = ({
  proposal,
  onApprove,
  onCancel,
  variant = 'panel',
}) => {
  if (proposal.kind === 'browser-action') {
    return (
      <BrowserActionProposalCard
        runId={proposal.runId}
        action={proposal.action}
        latestEvent={proposal.latestEvent}
        onApprove={(runId) => {
          void runId;
          return onApprove();
        }}
        onReject={() => onCancel?.()}
      />
    );
  }

  return (
    <ProposedActionCard
      workspaceName={proposal.workspaceName}
      command={proposal.command}
      reason={proposal.reason}
      riskLevel={proposal.riskLevel}
      executionMode={proposal.executionMode}
      isDryRun={proposal.isDryRun}
      description={proposal.description}
      onApprove={onApprove}
      onCancel={onCancel ?? (() => {})}
      variant={variant}
    />
  );
};
