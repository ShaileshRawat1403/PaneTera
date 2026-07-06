import React from 'react';
import { Stack } from '@mui/material';
import { DraftPreviewView } from './DraftPreviewView';
import { SchemaFormView } from './SchemaFormView';
import { StatusBoardView } from './StatusBoardView';
import { UnknownNativeView } from './UnknownNativeView';

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

export const NativeWorkbenchRenderer: React.FC<NativeWorkbenchRendererProps> = ({
  views,
  initialValues = {},
  onSubmitProposal
}) => {
  return (
    <Stack spacing={3} sx={{ width: '100%' }}>
      {views.map((view) => {
        switch (view.type) {
          case 'draft-preview':
            return <DraftPreviewView key={view.id} data={view.data || {}} />;
          case 'schema-form':
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
