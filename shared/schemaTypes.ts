// shared/schemaTypes.ts

export type CardWidgetType =
  | 'status-board'
  | 'metric-group'
  | 'diff'
  | 'proposal-gate'
  | 'form';

export type FieldType = 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object' | 'url' | 'date' | 'code';

export interface SchemaField {
  name: string;
  type: FieldType;
  label: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string | number }>;
  description?: string;
  placeholder?: string;
}

export type ActionType = 'approve' | 'reject' | 'navigate' | 'execute' | 'custom';

export interface SchemaAction {
  id: string;
  type: ActionType;
  label: string;
  requiresApproval?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  payload?: Record<string, unknown>;
}

export interface RenderHints {
  title?: string;
  subtitle?: string;
  layout?: 'full' | 'compact' | 'wide';
  badge?: string;
  accentColor?: string;
  icon?: string;
}

export interface PaneTeraCardSchema {
  id: string;                     // e.g. 'itops.deployment-pipeline'
  version: string;                // e.g. '1.0.0'
  domain: string;                 // e.g. 'itops' | 'healthcare' | 'finance' | 'legal'
  type: CardWidgetType;
  title: string;
  description?: string;
  fields: SchemaField[];
  actions: SchemaAction[];
  renderHints?: RenderHints;
  metadata?: Record<string, unknown>;
}

export interface CardDataPayload {
  schemaId: string;
  schemaVersion?: string;
  data: Record<string, unknown>;
  state?: 'idle' | 'running' | 'completed' | 'blocked' | 'failed';
  statusMessage?: string;
  lastUpdated?: string;
}
