// server/features.ts
// Authoritative feature flags config for MyAI Portal V1 Read-Only freeze.
// Features are enabled during test executions to maintain coverage.

const isTest = process.env.NODE_ENV === 'test';

export const FEATURES = {
  proposalMode: isTest,
  commandExecution: isTest,
  browserObservation: isTest,
  dynamicManifests: false,
  resourceRegistry: false
};
