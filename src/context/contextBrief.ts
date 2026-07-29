// src/context/contextBrief.ts
// The Context Brief: a read model answering the four questions the workstation
// contract requires.
//
//   1. What am I working on?
//   2. What is happening now?
//   3. What needs my attention?
//   4. What should happen next?
//
// This is the honest form of "a status dashboard" in a product whose contract
// lists "a dashboard showing every available metric and system" as a non-goal.
// Selectivity is what keeps it on the right side of that line, and selectivity
// is enforced here rather than left to the renderer:
//
//   - a healthy project produces nothing;
//   - collections are bounded and reported with totals, so volume cannot turn
//     the brief into a monitoring wall;
//   - at most one next action, with an explicit effect, or none;
//   - nothing is ever recommended inside a project PaneTera cannot reach.
//
// Deliberately pure. It derives a brief from state the app already holds, adds
// no backend contract, and renders wherever the caller puts it. Keeping the
// derivation out of a component is what stops it becoming a permanent panel by
// accident.

/** Why a project is asking for the person's attention. */
export type AttentionReason =
  | 'approval-pending'
  | 'ambiguity'
  | 'failure'
  | 'stale-context'
  | 'weak-evidence'
  | 'security-boundary'
  | 'missing-capability';

/**
 * Ordered by how much they block the person.
 *
 * A pending approval outranks a failure because the approval is waiting on a
 * decision only they can make, whereas a failure has already happened.
 */
const ATTENTION_RANK: Record<AttentionReason, number> = {
  'approval-pending': 0,
  'security-boundary': 1,
  failure: 2,
  ambiguity: 3,
  'missing-capability': 4,
  'stale-context': 5,
  'weak-evidence': 6,
};

/**
 * What a caller reports about a project.
 *
 * Note the absence of a project id. Attention is always read from inside a
 * `ProjectSnapshot`, so carrying an id here would let a nested item name a
 * different project and redirect an action away from the project it was
 * derived from. The id is attached during derivation instead, from the
 * containing snapshot, and cannot disagree with it.
 */
export interface AttentionInput {
  reason: AttentionReason;
  /** Plain language. Never an internal code. */
  summary: string;
  /** When the condition arose, if known. */
  since?: string;
}

/** An attention item after derivation, bound to the project it came from. */
export interface AttentionItem extends AttentionInput {
  projectId: string;
}

/**
 * Why a project is being actively tracked.
 *
 * Only tracked projects can go stale. A repository the person registered once
 * and has not opened since is not stale context, it is simply not in play, and
 * treating the two as the same floods anyone with a long project list.
 * Staleness describes retained understanding decaying, not a directory sitting
 * on disk.
 */
export type TrackingReason = 'pinned' | 'context-capsule' | 'open-objective' | 'unfinished-run';

export interface ProjectSnapshot {
  id: string;
  name: string;
  /** Last time the person did something in this project. */
  lastTouchedAt?: string;
  /** Whether PaneTera can currently reach it. */
  reachable: boolean;
  /** Bounded runs currently executing. */
  activeRuns: number;
  /** Attention conditions currently true for this project. */
  attention: AttentionInput[];
  /**
   * Present only when the project is genuinely being tracked. Absent means the
   * project is registered but dormant, and dormant projects stay silent.
   */
  trackedBecause?: TrackingReason;
}

/** A project's standing, derived rather than stored. */
export type ProjectStanding = 'active' | 'quiet' | 'needs-attention' | 'unavailable';

export interface ContextBriefInput {
  projects: readonly ProjectSnapshot[];
  /** The project the person is currently in, if any. */
  activeProjectId: string | null;
  /** Objective for the active project, when one has been stated. */
  objective?: string | null;
  /** Evaluated as "now" so the brief is testable. */
  now: Date;
  /** How long before a tracked project's context counts as stale. */
  staleAfterDays?: number;
}

/** A recommended action, with its effect stated rather than encoded in a string. */
export type NextAction =
  | { kind: 'focus-composer'; label: string; projectId?: string }
  | { kind: 'open-project-picker'; label: string }
  | { kind: 'open-surface'; surface: 'rig' | 'headroom' | 'audit'; label: string }
  | { kind: 'submit-message'; message: string; label: string; projectId?: string };

/**
 * An AI-suggested workflow, surfaced proactively based on current context.
 *
 * These sit alongside the deterministic `next` recommendation and answer
 * "What could I do next?" with domain-aware suggestions from registered
 * tools, recent conversation context, or learned patterns.
 *
 * `confidence` is a simple 1–5 score. The renderer uses it to decide visual
 * emphasis: 5 = brass accent (highly recommended), 3–4 = violet (useful),
 * 1–2 = muted (optional).
 */
export interface SuggestedWorkflow {
  label: string;
  description: string;
  action: NextAction;
  confidence: 1 | 2 | 3 | 4 | 5;
  source?: string;
}

/** A bounded view of a collection: what to show, and how much there was. */
export interface Bounded<T> {
  items: T[];
  total: number;
}

export interface ContextBrief {
  /** Question 1. */
  working: { projectId: string; name: string; objective: string | null } | null;
  /** Question 2. Bounded, because a hundred running projects is still a brief. */
  now: { activeRunCount: number; projectsWithRuns: Bounded<string> };
  /** Question 3. Bounded and prioritised. Empty when nothing needs the person. */
  attention: Bounded<AttentionItem>;
  /** Question 4. At most one. */
  next: NextAction | null;
  /** Proactive AI-suggested workflows, beyond the deterministic recommendation. */
  suggestions: Bounded<SuggestedWorkflow>;
  /** Projects that are fine. Counted, not enumerated, so silence stays silent. */
  quietProjectCount: number;
}

const DEFAULT_STALE_AFTER_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** How many attention items the brief will show at once. */
export const MAX_ATTENTION_SHOWN = 3;
/** How many running projects the brief will name at once. */
export const MAX_RUN_PROJECTS_SHOWN = 3;

/**
 * Whole days between two instants, floored, never negative.
 *
 * A clock skew or a bad import can produce a timestamp in the future. Reading
 * that as a large negative age and then as "not stale" is right by accident;
 * clamping at zero makes it right on purpose.
 */
export function daysBetween(from: string | undefined, now: Date): number | null {
  if (!from) return null;
  const then = Date.parse(from);
  if (Number.isNaN(then)) return null;
  const elapsed = now.getTime() - then;
  if (!Number.isFinite(elapsed)) return null;
  return Math.max(0, Math.floor(elapsed / DAY_MS));
}

/** A run count that cannot be negative, fractional, or non-finite. */
export function normaliseRunCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/**
 * A staleness threshold that cannot make everything instantly stale.
 *
 * The floor is one day, not zero. An earlier version guarded `value <= 0` and
 * then floored, so a fractional threshold like 0.5 passed the guard and became
 * 0, at which point every project satisfied `idle >= 0` and was reported as
 * "Not opened for 0 days." Guarding the input without constraining the output
 * is not normalisation.
 */
export function normaliseStaleAfterDays(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_STALE_AFTER_DAYS;
  }
  return Math.max(1, Math.floor(value));
}

/**
 * Whether a project is in play.
 *
 * The active project always is. Otherwise it needs a concrete reason, and if no
 * such state exists yet the honest answer is no, rather than inventing one.
 */
export function isTracked(project: ProjectSnapshot, activeProjectId: string | null): boolean {
  return project.id === activeProjectId || project.trackedBecause !== undefined;
}

/**
 * A project's standing.
 *
 * Unreachable outranks attention because a project you cannot reach cannot be
 * acted on. And a project with no attention and no runs is `quiet`, which is a
 * real state rather than a lesser one.
 *
 * `derivedAttentionCount` matters. Some attention is derived rather than
 * reported: a tracked project goes stale by the passage of time, and nothing
 * writes to its snapshot when it does. Reading `project.attention` alone made a
 * stale project count as quiet at the same moment the brief was raising
 * attention for it, so the same project appeared in both places.
 */
export function standingOf(project: ProjectSnapshot, derivedAttentionCount?: number): ProjectStanding {
  if (!project.reachable) return 'unavailable';
  const attentionCount = derivedAttentionCount ?? project.attention.length;
  if (attentionCount > 0) return 'needs-attention';
  if (normaliseRunCount(project.activeRuns) > 0) return 'active';
  return 'quiet';
}

/** Drop repeat ids, first occurrence wins, so one project cannot be counted twice. */
export function dedupeProjects(projects: readonly ProjectSnapshot[]): ProjectSnapshot[] {
  const seen = new Set<string>();
  const unique: ProjectSnapshot[] = [];
  for (const project of projects) {
    if (seen.has(project.id)) continue;
    seen.add(project.id);
    unique.push(project);
  }
  return unique;
}

/**
 * Every attention item the person can actually act on, most blocking first.
 *
 * An unreachable project contributes exactly one honest `missing-capability`
 * item standing in for whatever it was reporting, because "answer the open
 * question in X" is not a real instruction when X cannot be opened. Its own
 * items are dropped rather than surfaced as actions that would fail.
 */
export function actionableAttention(
  projects: readonly ProjectSnapshot[],
  options: { activeProjectId: string | null; now: Date; staleAfterDays?: number },
): AttentionItem[] {
  const staleAfter = normaliseStaleAfterDays(options.staleAfterDays);
  const derived: AttentionItem[] = [];

  for (const project of dedupeProjects(projects)) {
    if (!project.reachable) {
      // Only worth raising if the project was in play. An unreachable dormant
      // repository is not a problem the person needs to hear about.
      if (isTracked(project, options.activeProjectId)) {
        derived.push({
          projectId: project.id,
          reason: 'missing-capability',
          summary: `${project.name} cannot be reached right now.`,
        });
      }
      continue;
    }

    for (const item of project.attention) {
      // projectId is attached here, from the containing snapshot, so a nested
      // item cannot name a project other than the one it was found in.
      derived.push({ ...item, projectId: project.id });
    }

    if (!isTracked(project, options.activeProjectId)) continue;

    const alreadyFlagged = project.attention.some((item) => item.reason === 'stale-context');
    if (alreadyFlagged) continue;

    const idle = daysBetween(project.lastTouchedAt, options.now);
    if (idle !== null && idle >= staleAfter) {
      derived.push({
        projectId: project.id,
        reason: 'stale-context',
        summary: `Not opened for ${idle} days.`,
        since: project.lastTouchedAt,
      });
    }
  }

  return derived.sort((a, b) => ATTENTION_RANK[a.reason] - ATTENTION_RANK[b.reason]);
}

/**
 * The single recommended next action.
 *
 * One, or none. A list of suggestions is a menu, and a menu is a decision
 * handed back to the person rather than help.
 *
 * Callers pass already-derived attention, which is what guarantees the
 * recommendation cannot point into an unreachable project: those never reach
 * this function as anything other than `missing-capability`.
 */
export function recommendNext(
  attention: readonly AttentionItem[],
  context: {
    projects: readonly ProjectSnapshot[];
    activeProjectId: string | null;
    objective?: string | null;
  },
): NextAction | null {
  const top = attention[0];

  if (top) {
    const project = context.projects.find((candidate) => candidate.id === top.projectId);
    const where = project ? ` in ${project.name}` : '';
    switch (top.reason) {
      case 'approval-pending':
        return {
          kind: 'submit-message',
          label: `Review what is waiting for approval${where}`,
          message: 'show me what is waiting for my approval',
          projectId: top.projectId,
        };
      case 'security-boundary':
      case 'failure':
        return {
          kind: 'submit-message',
          label: `Look at what failed${where}`,
          message: `what went wrong${where}`,
          projectId: top.projectId,
        };
      case 'ambiguity':
        return {
          kind: 'submit-message',
          label: `Answer the open question${where}`,
          message: top.summary,
          projectId: top.projectId,
        };
      case 'missing-capability':
        return { kind: 'open-surface', surface: 'rig', label: 'Connect what is missing' };
      case 'stale-context':
        return {
          kind: 'submit-message',
          label: `Catch up on ${project?.name ?? 'this project'}`,
          message: `what changed in ${project?.name ?? 'this project'}`,
          projectId: top.projectId,
        };
      case 'weak-evidence':
        return { kind: 'open-surface', surface: 'audit', label: 'Check the evidence behind that' };
    }
  }

  if (context.activeProjectId) {
    const active = context.projects.find((p) => p.id === context.activeProjectId);
    if (active && !context.objective) {
      return {
        kind: 'focus-composer',
        label: `Say what you are trying to do in ${active.name}`,
        projectId: active.id,
      };
    }
    return null;
  }

  if (context.projects.length > 0) {
    return { kind: 'open-project-picker', label: 'Choose a project' };
  }

  return null;
}

/** Keep the first `limit`, and say how many there were. */
function bound<T>(items: T[], limit: number): Bounded<T> {
  return { items: items.slice(0, limit), total: items.length };
}

/**
 * Derive the brief.
 *
 * Everything here answers one of the four questions. Nothing is included
 * because it happened to be available.
 */
export function buildContextBrief(input: ContextBriefInput): ContextBrief {
  const projects = dedupeProjects(input.projects);

  const attention = actionableAttention(projects, {
    activeProjectId: input.activeProjectId,
    now: input.now,
    staleAfterDays: input.staleAfterDays,
  });

  const attentionCountByProject = new Map<string, number>();
  for (const item of attention) {
    attentionCountByProject.set(item.projectId, (attentionCountByProject.get(item.projectId) ?? 0) + 1);
  }

  const active = input.activeProjectId
    ? projects.find((project) => project.id === input.activeProjectId) ?? null
    : null;

  const withRuns = projects.filter((project) => normaliseRunCount(project.activeRuns) > 0);

  return {
    working: active
      ? { projectId: active.id, name: active.name, objective: input.objective ?? null }
      : null,
    now: {
      activeRunCount: withRuns.reduce(
        (total, project) => total + normaliseRunCount(project.activeRuns),
        0,
      ),
      projectsWithRuns: bound(
        withRuns.map((project) => project.name),
        MAX_RUN_PROJECTS_SHOWN,
      ),
    },
    attention: bound(attention, MAX_ATTENTION_SHOWN),
    next: recommendNext(attention, {
      projects,
      activeProjectId: input.activeProjectId,
      objective: input.objective,
    }),
    // Suggestions start empty. The server injects AI-suggested workflows
    // based on conversation context and registered tool capabilities.
    suggestions: { items: [], total: 0 },
    // Counted, not listed. Enumerating healthy projects is how a brief turns
    // into the dashboard the contract rules out.
    //
    // Counted against *derived* attention, so a project cannot be quiet and
    // in the attention list at the same time.
    quietProjectCount: projects.filter(
      (project) => standingOf(project, attentionCountByProject.get(project.id) ?? 0) === 'quiet',
    ).length,
  };
}

/** Whether the brief has anything worth interrupting for. */
export function briefNeedsAttention(brief: ContextBrief): boolean {
  return brief.attention.total > 0;
}
