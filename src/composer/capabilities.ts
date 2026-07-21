// src/composer/capabilities.ts
// Capability declaration derived from handler existence.
//
// The previous design took `readonly string[]`, so a typo or an aspirational
// entry made the resolver report ready for something nothing could perform.
// That is exactly how `live-app` came to be declared while its handler was
// passing an application name where an application id was required.
//
// Here the declaration is computed from the executor registry. A capability
// cannot be claimed without supplying the function that carries it out, and a
// misspelled key fails the type check rather than the user.

import type { SubmissionPlan } from './submissionPlan';

export type CapabilityKey =
  | 'converse'
  | 'artifact'
  | 'web-surface'
  | 'project'
  | 'live-app'
  | 'headroom'
  | 'headroom:clear'
  | 'run'
  | 'proposal'
  | 'rig'
  | 'evidence';

/** Plan kinds that represent work to do, as opposed to a refusal. */
export type ExecutablePlan = Exclude<SubmissionPlan, { kind: 'blocked' }>;
export type ExecutablePlanKind = ExecutablePlan['kind'];

type PlanOf<K extends ExecutablePlanKind> = Extract<ExecutablePlan, { kind: K }>;

/**
 * Handlers a consumer supplies. Every executable plan kind has a slot, and all
 * are optional; what is supplied determines what may be claimed.
 */
export interface PlanExecutors {
  webOpen?: (plan: PlanOf<'web-open'>) => void | Promise<void>;
  webClose?: (plan: PlanOf<'web-close'>) => void | Promise<void>;
  webReload?: (plan: PlanOf<'web-reload'>) => void | Promise<void>;
  selectProject?: (plan: PlanOf<'select-project'>) => void | Promise<void>;
  openLiveApp?: (plan: PlanOf<'open-live-app'>) => void | Promise<void>;
  clearContext?: (plan: PlanOf<'clear-context'>) => void | Promise<void>;
  openHeadroom?: (plan: PlanOf<'open-headroom'>) => void | Promise<void>;
  openRig?: (plan: PlanOf<'open-rig'>) => void | Promise<void>;
  chat?: (plan: PlanOf<'chat'>) => void | Promise<void>;
}

/**
 * Compute what the consumer may claim.
 *
 * `web-surface` requires all three of its handlers. Claiming the family while
 * only opening pages would let `close the website` resolve to ready and then
 * find nothing to run it.
 */
export function capabilitiesFrom(executors: PlanExecutors): CapabilityKey[] {
  const claimed: CapabilityKey[] = [];

  if (executors.webOpen && executors.webClose && executors.webReload) {
    claimed.push('web-surface');
  }
  if (executors.selectProject) claimed.push('project');
  if (executors.openLiveApp) claimed.push('live-app');
  if (executors.clearContext) claimed.push('headroom:clear');
  if (executors.openHeadroom) claimed.push('headroom');
  if (executors.openRig) claimed.push('rig');
  if (executors.chat) {
    // One handler serves both, since the plan carries the endpoint.
    claimed.push('converse', 'artifact');
  }

  return claimed;
}

export type ExecutionOutcome =
  | { kind: 'executed'; planKind: ExecutablePlanKind }
  | { kind: 'unhandled'; planKind: ExecutablePlanKind };

/**
 * Dispatch a plan to its handler.
 *
 * 'unhandled' should be unreachable when the resolver was given
 * `capabilitiesFrom(executors)`, because a plan of that kind could not have
 * become ready. It is reported rather than thrown so the caller can surface an
 * honest failure instead of a blank canvas.
 */
export async function executePlan(
  plan: ExecutablePlan,
  executors: PlanExecutors,
): Promise<ExecutionOutcome> {
  const run = async (handler: ((p: never) => void | Promise<void>) | undefined) => {
    if (!handler) return { kind: 'unhandled' as const, planKind: plan.kind };
    await (handler as (p: ExecutablePlan) => void | Promise<void>)(plan);
    return { kind: 'executed' as const, planKind: plan.kind };
  };

  switch (plan.kind) {
    case 'web-open':
      return run(executors.webOpen);
    case 'web-close':
      return run(executors.webClose);
    case 'web-reload':
      return run(executors.webReload);
    case 'select-project':
      return run(executors.selectProject);
    case 'open-live-app':
      return run(executors.openLiveApp);
    case 'clear-context':
      return run(executors.clearContext);
    case 'open-headroom':
      return run(executors.openHeadroom);
    case 'open-rig':
      return run(executors.openRig);
    case 'chat':
      return run(executors.chat);
  }
}
