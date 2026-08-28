// src/components/workstation/approvalsWaiting.ts
//
// How many governed actions are actually waiting on the person right now.
//
// The cockpit previously reported this as `waiting-approval ? 1 : 0`, which was
// a status flag wearing a count's clothing: two pending approvals displayed as
// one. Approvals are the one number in the product a person must be able to act
// on, so it has to be counted rather than inferred.
//
// This counts only what the shell can observe truthfully today. It deliberately
// does not reach into Rig or the run store — those remain authoritative, and a
// count assembled from a second source would be a duplicate store, not a
// projection. Everything here is already in App state:
//
//   1. Feed items of type 'ProposedAction'. The feed labels these
//      "AWAITING APPROVAL"; each one is a distinct pending decision.
//   2. The active run, when it is an AgentRun sitting in 'waiting-approval'.
//      This is the governed Rig capability path.
//
// The active run occupies its own slot (setActiveComponent) rather than living
// in the feed, so the two sources cannot double-count each other.
//
// Undercounting is possible and is the intended failure direction: a pending
// approval the shell genuinely cannot see is better shown as absent than
// invented. Overcounting is not acceptable, because it would send a person
// looking for a decision that does not exist.

/** The shape this module reads from a feed item. Structural, not a re-declaration. */
export interface ApprovalCountableFeedItem {
  type: string;
}

/** The shape this module reads from the active canvas component. */
export interface ApprovalCountableActiveComponent {
  type: string;
  data?: unknown;
}

/** The feed item type the preview panel renders as "AWAITING APPROVAL". */
const PROPOSED_ACTION = 'ProposedAction';

/** The run status that means the run has stopped and is waiting on a person. */
const WAITING_APPROVAL = 'waiting-approval';

/**
 * Whether the active canvas component is a run stopped on a human decision.
 *
 * Exported so the cockpit's run status and its approvals count are derived
 * from one predicate rather than two hand-written checks that can drift.
 */
export function isRunAwaitingApproval(
  activeComponent: ApprovalCountableActiveComponent | null | undefined,
): boolean {
  if (!activeComponent || activeComponent.type !== 'AgentRun') return false;
  const status = (activeComponent.data as { status?: unknown } | undefined)?.status;
  return status === WAITING_APPROVAL;
}

/**
 * Count the governed actions waiting on the person.
 *
 * Pure and total: tolerates a missing feed, a null active component, and feed
 * entries whose shape is not fully known.
 */
export function countApprovalsWaiting(
  previewFeed: readonly ApprovalCountableFeedItem[] | null | undefined,
  activeComponent: ApprovalCountableActiveComponent | null | undefined,
): number {
  const proposed = (previewFeed ?? []).filter((item) => item?.type === PROPOSED_ACTION).length;
  return proposed + (isRunAwaitingApproval(activeComponent) ? 1 : 0);
}
