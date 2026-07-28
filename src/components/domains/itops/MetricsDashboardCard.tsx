// src/components/domains/itops/MetricsDashboardCard.tsx
import React from 'react';
import { SchemaCardRenderer } from '../../schema/SchemaCardRenderer';

export const MetricsDashboardCard: React.FC<{ data?: Record<string, unknown> }> = ({ data }) => {
  return (
    <SchemaCardRenderer
      schemaId="itops.metrics-dashboard"
      data={data || {}}
    />
  );
};
