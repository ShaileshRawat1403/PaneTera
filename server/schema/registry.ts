// server/schema/registry.ts
import { PaneTeraCardSchema } from './types';
import { validateCardSchema } from './validator';

class SchemaRegistryStore {
  private schemas: Map<string, PaneTeraCardSchema> = new Map();

  constructor() {
    this.seedDefaultSchemas();
  }

  public registerSchema(schema: PaneTeraCardSchema): { success: boolean; errors?: string[] } {
    const validation = validateCardSchema(schema);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    this.schemas.set(schema.id, { ...schema });
    return { success: true };
  }

  public getSchema(id: string): PaneTeraCardSchema | undefined {
    return this.schemas.get(id);
  }

  public listSchemas(domain?: string): PaneTeraCardSchema[] {
    const all = Array.from(this.schemas.values());
    if (!domain) return all;
    return all.filter((s) => s.domain.toLowerCase() === domain.toLowerCase());
  }

  public deleteSchema(id: string): boolean {
    return this.schemas.delete(id);
  }

  private seedDefaultSchemas(): void {
    // Seed generic baseline schemas
    const defaultSchemas: PaneTeraCardSchema[] = [
      {
        id: 'generic.status-board',
        version: '1.0.0',
        domain: 'generic',
        type: 'status-board',
        title: 'Status Pipeline Board',
        description: 'Multi-stage workflow visualizer',
        fields: [
          { name: 'columns', type: 'array', label: 'Pipeline Columns', required: true },
          { name: 'items', type: 'array', label: 'Board Items', required: true },
        ],
        actions: [
          { id: 'move_item', type: 'execute', label: 'Advance Stage' },
        ],
      },
      {
        id: 'generic.metric-group',
        version: '1.0.0',
        domain: 'generic',
        type: 'metric-group',
        title: 'Performance & KPI Metrics',
        fields: [
          { name: 'metrics', type: 'array', label: 'Metrics', required: true },
        ],
        actions: [
          { id: 'refresh_metrics', type: 'execute', label: 'Refresh Data' },
        ],
      },
      {
        id: 'generic.proposal-gate',
        version: '1.0.0',
        domain: 'generic',
        type: 'proposal-gate',
        title: 'Governed Approval Gate',
        fields: [
          { name: 'checkList', type: 'array', label: 'Pre-flight Rule Checks', required: true },
          { name: 'proposalId', type: 'string', label: 'Proposal Identifier', required: true },
        ],
        actions: [
          { id: 'approve', type: 'approve', label: 'Approve & Execute', requiresApproval: true, variant: 'primary' },
          { id: 'reject', type: 'reject', label: 'Reject Proposal', requiresApproval: false, variant: 'danger' },
        ],
      },
    ];

    for (const schema of defaultSchemas) {
      this.registerSchema(schema);
    }
  }
}

export const schemaRegistry = new SchemaRegistryStore();
