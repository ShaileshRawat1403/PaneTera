import { randomUUID } from 'crypto';
import { browserActionStore } from '../browserActionStore';
import { browserInspectionStore } from '../browserInspectionStore';
import { browserEvidenceStore } from '../browserEvidenceStore';
import {
  getPairedBrowserInstallations,
  isBrowserInstallationPaired,
} from '../browserGateway';
import { resolveBrowserClickTargetFromEvidence } from '../browserTargetResolver';
import { logAudit } from '../audit';
import type { AgentCapability, AgentToolResult } from './types';

const objectSchema = (
  properties: Record<string, unknown>,
  required: string[],
): Record<string, unknown> => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

/**
 * Creates browser action capabilities that go through Rig governance.
 * These capabilities allow the agent to inspect and interact with
 * paired Chrome installations through the governed approval workflow.
 */
export function createBrowserActionCapabilities(): AgentCapability[] {
  return [
    {
      name: 'listBrowserSessions',
      description: 'List paired PaneTera Chrome installations. This does not expose browser credentials.',
      inputSchema: objectSchema({}, []),
      risk: 'observe',
      async execute() {
        const sessions = getPairedBrowserInstallations();
        return {
          output: { sessions },
          evidence: { source: 'browser-gateway', observedCount: sessions.length },
        };
      },
    },
    {
      name: 'discoverBrowserElements',
      description: 'Ask one paired Chrome installation to inspect the active tab and return fresh semantic interactive targets.',
      inputSchema: objectSchema({
        installationId: { type: 'string', description: 'Exact paired installation identifier.' },
      }, ['installationId']),
      risk: 'observe',
      async execute(arguments_) {
        const installationId = requiredString(arguments_, 'installationId');
        if (!isBrowserInstallationPaired(installationId)) {
          throw new Error('The requested Chrome installation is not currently paired.');
        }
        const inspection = browserInspectionStore.create(installationId);
        logAudit('browser.inspection.requested', {
          actor: 'panetera-agent',
          requestId: inspection.requestId,
          installationId,
          capability: inspection.capability,
          policyDecision: 'allowed',
          status: inspection.status,
        });
        const completed = await waitForBrowserInspection(inspection.requestId);
        if (completed.status !== 'completed' || !completed.extractionId) {
          throw new Error(completed.error || `Browser inspection ended as ${completed.status}.`);
        }
        const extraction = browserEvidenceStore.getExtractionById(completed.extractionId);
        if (!extraction || extraction.capability !== 'browser.elements.discover') {
          throw new Error('Fresh browser element evidence could not be resolved.');
        }
        const elements = Array.isArray(extraction.data?.elements) ? extraction.data.elements : [];
        const output = {
          installationId,
          captureId: completed.captureId,
          extractionId: completed.extractionId,
          source: extraction.source,
          browserTarget: extraction.data?.browserTarget,
          elements,
        };
        return {
          output,
          uiComponent: { type: 'BrowserExtraction', data: extraction },
          evidence: {
            source: 'paired-chrome-tab',
            extractionId: completed.extractionId,
            observedCount: elements.length,
            freshness: extraction.source.capturedAt,
          },
        };
      },
    },
    {
      name: 'proposeBrowserClick',
      description: 'Create an exact, expiring proposal to click one freshly discovered semantic browser target. This never clicks directly.',
      inputSchema: objectSchema({
        installationId: { type: 'string' },
        extractionId: { type: 'string', description: 'Fresh browser.elements.discover extraction identifier.' },
        evidenceId: { type: 'string', description: 'Exact semantic target evidence identifier from that extraction.' },
        expectedOutcome: { type: 'string' },
      }, ['installationId', 'extractionId', 'evidenceId', 'expectedOutcome']),
      risk: 'propose',
      async execute(arguments_) {
        const installationId = requiredString(arguments_, 'installationId');
        if (!isBrowserInstallationPaired(installationId)) {
          throw new Error('The requested Chrome installation is not currently paired.');
        }
        const extractionId = requiredString(arguments_, 'extractionId');
        const evidenceId = requiredString(arguments_, 'evidenceId');
        const extraction = browserEvidenceStore.getExtractionById(extractionId);
        if (!extraction) throw new Error('Browser element evidence was not found. Discover targets again.');
        const target = resolveBrowserClickTargetFromEvidence({
          extraction,
          installationId,
          extractionId,
          evidenceId,
        });
        const action = browserActionStore.propose({
          installationId,
          capability: 'browser.click.execute',
          target,
          expectedOutcome: requiredString(arguments_, 'expectedOutcome'),
        });
        logAudit('browser.action.proposed', {
          actor: 'panetera-agent',
          actionId: action.actionId,
          capability: action.capability,
          installationId: action.installationId,
          target: action.target,
          policyDecision: 'approval-required',
          status: action.status,
        });
        return {
          output: {
            proposed: true,
            actionId: action.actionId,
            status: action.status,
            target: action.target,
            expectedOutcome: action.expectedOutcome,
            expiresAt: action.expiresAt,
          },
          uiComponent: { type: 'BrowserActionProposal', data: { action } },
          requiresApproval: true,
          approval: {
            kind: 'browser-action',
            approvalId: action.actionId,
            capability: action.capability,
            summary: `Click ${action.target.role} "${action.target.accessibleName}" on ${action.target.expectedOrigin}`,
            expiresAt: action.expiresAt,
          },
          evidence: {
            source: 'browser-action-policy',
            actionId: action.actionId,
            policyDecision: 'approval-required',
          },
        };
      },
    },
  ];
}

function requiredString(value: Record<string, unknown>, key: string): string {
  const candidate = value[key];
  if (typeof candidate !== 'string' || !candidate.trim()) throw new Error(`Missing required tool argument: ${key}`);
  return candidate.trim();
}

async function waitForBrowserInspection(requestId: string) {
  const deadline = Date.now() + 65_000;
  while (Date.now() < deadline) {
    const request = browserInspectionStore.get(requestId);
    if (!request) throw new Error('Browser inspection request disappeared.');
    if (['completed', 'failed', 'expired'].includes(request.status)) return request;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const request = browserInspectionStore.get(requestId);
  if (!request) throw new Error('Browser inspection request disappeared.');
  return request;
}
