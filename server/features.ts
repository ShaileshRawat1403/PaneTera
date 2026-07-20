// server/features.ts
// Authoritative feature flags for PaneTera's governed capability boundaries.
// Features are enabled during test executions to maintain coverage.

const isTest = process.env.NODE_ENV === 'test';

export const FEATURES = {
  proposalMode: isTest,
  commandExecution: isTest,
  browserObservation: isTest,
  dynamicManifests: false,
  resourceRegistry: false
};
