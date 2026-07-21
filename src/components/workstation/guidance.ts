export type WorkstationGuidance = {
  kind: 'attention' | 'now' | 'next';
  text: string;
};

/**
 * One compact line near the composer answers the most relevant workstation
 * question. Healthy systems stay quiet; attention replaces next-step advice
 * only when a required capability is actually unavailable.
 */
export function workstationGuidance(input: {
  gatewayConnected: boolean;
  loading: boolean;
  hasProject: boolean;
  objective: string;
}): WorkstationGuidance {
  if (!input.gatewayConnected) {
    return { kind: 'attention', text: 'PaneTera’s local gateway is unavailable.' };
  }
  if (input.loading) {
    return { kind: 'now', text: 'PaneTera is working on your request.' };
  }
  if (!input.hasProject) {
    return { kind: 'next', text: 'Choose a project above or describe a goal.' };
  }
  if (!input.objective.trim()) {
    return { kind: 'next', text: 'Set the outcome you want to reach.' };
  }
  return { kind: 'next', text: 'Describe the next result you want to see.' };
}
