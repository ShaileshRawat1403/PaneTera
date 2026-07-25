import React, { useMemo } from 'react';
import { Stack } from '@mui/material';
import { DraftPreviewView } from './DraftPreviewView';
import { SchemaFormView } from './SchemaFormView';
import { RichSchemaFormView } from './RichSchemaFormView';
import { StatusBoardView } from './StatusBoardView';
import { UnknownNativeView } from './UnknownNativeView';
import { BrowserObservationView } from './BrowserObservationView';

interface WorkbenchView {
  id: string;
  type: string;
  label: string;
  status: 'template' | 'no-active-run' | 'awaiting-review' | 'available';
  data?: any;
  inputSchema?: any;
  actions?: any[];
}

interface NativeWorkbenchRendererProps {
  views: WorkbenchView[];
  initialValues?: Record<string, string>;
  onSubmitProposal?: (actionId: string, formValues: Record<string, string>) => void;
}

/**
 * Prioritize views based on their status field.
 * - 'awaiting-review': Primary (highest priority)
 * - 'available': Secondary
 * - 'template' / 'no-active-run': Tertiary (lowest priority)
 */
function prioritizeViews(views: WorkbenchView[]): WorkbenchView[] {
  const priority: Record<string, number> = {
    'awaiting-review': 1,
    'available': 2,
    'template': 3,
    'no-active-run': 4,
  };
  return [...views].sort((a, b) => (priority[a.status] || 5) - (priority[b.status] || 5));
}

/**
 * Check if schema has expanded field types that require RichSchemaFormView
 */
function hasExpandedFieldTypes(inputSchema: any): boolean {
  if (!inputSchema?.fields) return false;
  const expandedTypes = ['boolean', 'number', 'textarea', 'markdown', 'code', 'url', 'date', 'file', 'array'];
  return inputSchema.fields.some((field: any) => expandedTypes.includes(field.type));
}

export const NativeWorkbenchRenderer: React.FC<NativeWorkbenchRendererProps> = ({
  views,
  initialValues = {},
  onSubmitProposal
}) => {
  const sortedViews = useMemo(() => prioritizeViews(views), [views]);

  return (
    <Stack spacing={3} sx={{ width: '100%' }}>
      {sortedViews.map((view) => {
        switch (view.type) {
          case 'draft-preview':
            return <DraftPreviewView key={view.id} data={view.data || {}} />;
          case 'schema-form':
            // Use RichSchemaFormView if schema has expanded field types
            if (hasExpandedFieldTypes(view.inputSchema)) {
              return (
                <RichSchemaFormView
                  key={view.id}
                  inputSchema={view.inputSchema || { fields: [] }}
                  actions={view.actions || []}
                  initialValues={initialValues}
                  onSubmitProposal={onSubmitProposal as any}
                />
              );
            }
            return (
              <SchemaFormView
                key={view.id}
                inputSchema={view.inputSchema || { fields: [] }}
                actions={view.actions || []}
                initialValues={initialValues}
                onSubmitProposal={onSubmitProposal}
              />
            );
          case 'status-board':
            return <StatusBoardView key={view.id} data={view.data || {}} />;
          case 'browser-observation':
            return <BrowserObservationView key={view.id} data={view.data || null} />;
          default:
            return (
              <UnknownNativeView
                key={view.id}
                viewId={view.id}
                type={view.type}
                label={view.label}
              />
            );
        }
      })}
    </Stack>
  );
};
