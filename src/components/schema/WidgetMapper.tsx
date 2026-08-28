// src/components/schema/WidgetMapper.tsx
import React from 'react';
import { PaneTeraCardSchema } from '../../../shared/schemaTypes';
import { StatusBoardWidget } from './widgets/StatusBoardWidget';
import { MetricGroupWidget } from './widgets/MetricGroupWidget';
import { DiffWidget } from './widgets/DiffWidget';
import { ProposalGateWidget } from './widgets/ProposalGateWidget';
import { FormWidget } from './widgets/FormWidget';
import { ink } from '../../theme/cssTokens';

interface WidgetMapperProps {
  schema: PaneTeraCardSchema;
  data: Record<string, unknown>;
  onAction?: (actionId: string, payload: Record<string, unknown>) => void;
}

export const WidgetMapper: React.FC<WidgetMapperProps> = ({ schema, data, onAction }) => {
  switch (schema.type) {
    case 'status-board':
      return <StatusBoardWidget schema={schema} data={data as unknown as Parameters<typeof StatusBoardWidget>[0]['data']} onAction={onAction} />;
    case 'metric-group':
      return <MetricGroupWidget schema={schema} data={data as unknown as Parameters<typeof MetricGroupWidget>[0]['data']} onAction={onAction} />;
    case 'diff':
      return <DiffWidget schema={schema} data={data as unknown as Parameters<typeof DiffWidget>[0]['data']} onAction={onAction} />;
    case 'proposal-gate':
      return <ProposalGateWidget schema={schema} data={data as unknown as Parameters<typeof ProposalGateWidget>[0]['data']} onAction={onAction} />;
    case 'form':
      return <FormWidget schema={schema} data={data} onAction={onAction} />;
    default:
      return (
        <div style={{ padding: 16, borderRadius: 12, backgroundColor: 'rgba(28,26,24,0.7)', border: '1px solid rgba(51,46,40,0.8)', color: ink.muted, fontSize: 12 }}>
          Unsupported widget type: <span style={{ fontFamily: 'monospace', color: ink.primary }}>{schema.type}</span>
        </div>
      );
  }
};
