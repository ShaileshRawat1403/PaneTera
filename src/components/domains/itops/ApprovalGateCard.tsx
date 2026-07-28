// src/components/domains/itops/ApprovalGateCard.tsx
import React from 'react';
import { SchemaCardRenderer } from '../../schema/SchemaCardRenderer';

export const ApprovalGateCard: React.FC<{ data?: Record<string, unknown> }> = ({ data }) => {
  return (
    <SchemaCardRenderer
      schemaId="itops.approval-gate"
      data={data || {}}
    />
  );
};
