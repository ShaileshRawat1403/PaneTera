// src/components/domains/itops/DeploymentPipelineCard.tsx
import React from 'react';
import { SchemaCardRenderer } from '../../schema/SchemaCardRenderer';

export const DeploymentPipelineCard: React.FC<{ data?: Record<string, unknown> }> = ({ data }) => {
  return (
    <SchemaCardRenderer
      schemaId="itops.deployment-pipeline"
      data={data || {}}
    />
  );
};
