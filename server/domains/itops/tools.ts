// server/domains/itops/tools.ts
import { schemaRegistry } from '../../schema/registry';
import itOpsSchemas from './schemas.json';
import { PaneTeraCardSchema } from '../../schema/types';

export function registerItOpsDomain(): void {
  for (const s of itOpsSchemas as PaneTeraCardSchema[]) {
    schemaRegistry.registerSchema(s);
  }
}

export function getDeploymentStatusPayload() {
  return {
    schemaId: 'itops.deployment-pipeline',
    data: {
      columns: [
        { id: 'build', name: 'Build & Test', color: '#a1a1aa' },
        { id: 'staging', name: 'Staging Env', color: '#0ea5e9' },
        { id: 'canary', name: 'Canary (10%)', color: '#7c3aed' },
        { id: 'prod', name: 'Production', color: '#10b981' },
      ],
      items: [
        { id: 'dep-101', columnId: 'canary', title: 'Payment API v2.4.1', subtitle: 'Commit sha256:7f91a', status: 'ok', metadata: { cluster: 'us-east-1', tests: '142/142' } },
        { id: 'dep-102', columnId: 'staging', title: 'Auth Service v1.9', subtitle: 'Commit sha256:3b82c', status: 'warn', metadata: { cluster: 'eu-west-1', tests: '98/98' } },
        { id: 'dep-103', columnId: 'prod', title: 'Gateway Ingress v3.0', subtitle: 'Commit sha256:90a1e', status: 'ok', metadata: { cluster: 'global', uptime: '99.99%' } },
      ],
    },
  };
}

export function getMetricsPayload() {
  return {
    schemaId: 'itops.metrics-dashboard',
    data: {
      metrics: [
        { id: 'm1', label: 'HTTP P99 Latency', value: 138, unit: 'ms', change: '-12ms', trend: 'down', status: 'ok' },
        { id: 'm2', label: 'Error Rate (5xx)', value: 0.01, unit: '%', change: '0.00%', trend: 'neutral', status: 'ok' },
        { id: 'm3', label: 'CPU Utilization', value: 74, unit: '%', change: '+8%', trend: 'up', status: 'warn' },
        { id: 'm4', label: 'Active Pods', value: 32, unit: 'units', change: 'Stable', trend: 'neutral', status: 'ok' },
      ],
    },
  };
}

export function getApprovalGatePayload() {
  return {
    schemaId: 'itops.approval-gate',
    data: {
      proposalId: 'rel_2026_07_28_01',
      proposalTitle: 'Production Release · Gateway Ingress v3.1',
      summary: 'Promote release candidate v3.1 across all 4 production edge clusters.',
      checkList: [
        { id: 'c1', rule: 'Unit & Integration Test Suite', status: 'pass', detail: '384 tests passed across 4 worker nodes' },
        { id: 'c2', rule: 'Security Vulnerability Scan (CVE)', status: 'pass', detail: 'Zero critical or high severity CVEs detected' },
        { id: 'c3', rule: 'Canary Latency Baseline Delta', status: 'warn', detail: '+4ms latency delta detected during 10% canary traffic' },
        { id: 'c4', rule: 'Database Migration Idempotency', status: 'pass', detail: 'Schema migration verified as backwards-compatible' },
      ],
    },
  };
}
