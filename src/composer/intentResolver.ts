// src/composer/intentResolver.ts
// The single intent resolver. Natural language and `/` actions are two front
// doors onto one readiness evaluator.
//
// Structural invariant, enforced by test/composerIntent.test.ts:
//   for every (family, action) pair listed in DUAL_DOOR_FAMILIES, the slash form
//   and the natural-language form produce identical decisions.
//
// This holds because neither front door decides readiness. Each resolves only
// (family, action, args); evaluateReadiness owns everything else.
//
// Families reachable by slash only are documented rather than implied. Adding a
// natural-language matcher is a deliberate act, not a side effect, because
// loose matchers swallow real work prompts.

import { extractWebPreviewRequest, resolveWebPreviewIntent } from '../utils/webPreviewIntent';
import { resolveConversationRoute } from '../utils/paneteraIntent';
import { findSlashCommand, parseSlashInput } from './slashCommands';
import {
  matchInspectPhrase,
  matchProjectPhrase,
  matchRunPhrase,
} from './naturalLanguageSelectors';
import type { CapabilityKey } from './capabilities';
import type {
  AssertedBy,
  CanvasSurface,
  IntentArgs,
  IntentEnvelope,
  IntentFamily,
  MissingRequirement,
  Readiness,
} from './intentTypes';

export interface ResolverContext {
  hasWorkspace: boolean;
  hasSelectedFile: boolean;
  /** Context items currently marked for inclusion. Count only: the resolver
   *  never reads their contents. */
  includedContextCount: number;
  /** Whether a web preview is currently open, for close and reload intents. */
  hasOpenWebPreview: boolean;
  /**
   * What the consumer can actually do, as `family` or `family:action` entries.
   *
   * This exists so that `ready` means "a handler exists", not "the arguments
   * parsed". Without it the resolver can report ready for a family whose
   * consumer silently falls through to a generic chat call, which is how
   * `/rig` ends up looking like it worked.
   */
  supportedCapabilities: readonly CapabilityKey[];
}

/**
 * The composer alone can satisfy only context clearing. Every other family
 * needs a host handler, so the default deliberately claims almost nothing.
 */
export const DEFAULT_RESOLVER_CONTEXT: ResolverContext = {
  hasWorkspace: false,
  hasSelectedFile: false,
  includedContextCount: 0,
  hasOpenWebPreview: false,
  supportedCapabilities: ['converse', 'headroom:clear'],
};

/** `family:action` wins over `family`, so a family can support one action only. */
function supports(context: ResolverContext, family: IntentFamily, action?: string): boolean {
  const capabilities = context.supportedCapabilities as readonly string[];
  if (action && capabilities.includes(`${family}:${action}`)) return true;
  return capabilities.includes(family);
}

/** What a front door produces before readiness is evaluated. */
interface FamilySelection {
  family: IntentFamily;
  args: IntentArgs;
}

const SURFACE_BY_FAMILY: Record<IntentFamily, CanvasSurface | null> = {
  converse: 'conversation',
  project: 'conversation',
  'web-surface': 'web-preview',
  'live-app': 'live-app',
  artifact: 'artifact',
  evidence: 'evidence',
  run: 'proposal',
  proposal: 'proposal',
  rig: 'rig',
  headroom: 'headroom',
};

/**
 * The sole readiness authority. Both front doors call this and neither may
 * shortcut it. A slash command asserts a family, never a readiness.
 */
function evaluateReadiness(
  selection: FamilySelection,
  context: ResolverContext,
): { readiness: Readiness; missing: MissingRequirement[]; surface: CanvasSurface | null } {
  const { family, args } = selection;
  const missing: MissingRequirement[] = [];

  // Capability is checked before anything else. A family with no handler is
  // needs-capability regardless of how well its arguments parsed, because
  // reporting ready would promise an action nothing performs.
  if (!supports(context, family, args.action)) {
    missing.push({
      kind: 'capability',
      prompt: UNSUPPORTED_PROMPTS[family] ?? 'That capability is not connected yet.',
    });
    return { readiness: 'needs-capability', missing, surface: null };
  }

  switch (family) {
    case 'web-surface': {
      if (args.action === 'close' || args.action === 'reload') {
        if (!context.hasOpenWebPreview) {
          missing.push({ kind: 'target', prompt: 'There is no web preview open.' });
          return { readiness: 'needs-context', missing, surface: null };
        }
        return { readiness: 'ready', missing, surface: SURFACE_BY_FAMILY[family] };
      }
      if (!args.url) {
        missing.push({ kind: 'url', prompt: 'Which page should I open?' });
        return { readiness: 'needs-context', missing, surface: null };
      }
      return { readiness: 'ready', missing, surface: SURFACE_BY_FAMILY[family] };
    }

    case 'project': {
      if (!args.target) {
        missing.push({ kind: 'project', prompt: 'Which project?' });
        return { readiness: 'needs-clarification', missing, surface: null };
      }
      return { readiness: 'ready', missing, surface: SURFACE_BY_FAMILY[family] };
    }

    case 'artifact': {
      // An active workspace is itself sufficient context: the orchestrator
      // answers repository questions from the workspace alone. Requiring a
      // named target here would block ordinary questions like "what does the
      // git history show", which worked before the composer existed.
      const hasSomethingToInspect =
        Boolean(args.target) ||
        context.hasSelectedFile ||
        context.includedContextCount > 0 ||
        context.hasWorkspace;

      if (!hasSomethingToInspect) {
        missing.push({ kind: 'context-item', prompt: 'What should I inspect?' });
        return { readiness: 'needs-context', missing, surface: null };
      }
      return { readiness: 'ready', missing, surface: SURFACE_BY_FAMILY[family] };
    }

    case 'run': {
      // Never 'ready'. A run is a proposal until an operator approves it, and
      // that is true whether the user typed `/run` or asked in prose.
      if (!args.target) {
        missing.push({ kind: 'target', prompt: 'What should I propose running?' });
        return { readiness: 'needs-clarification', missing, surface: null };
      }
      missing.push({ kind: 'approval', prompt: 'This needs your approval before it runs.' });
      return { readiness: 'needs-approval', missing, surface: SURFACE_BY_FAMILY[family] };
    }

    case 'proposal': {
      missing.push({ kind: 'approval', prompt: 'This needs your approval before it runs.' });
      return { readiness: 'needs-approval', missing, surface: SURFACE_BY_FAMILY[family] };
    }

    case 'live-app': {
      if (!args.target) {
        missing.push({ kind: 'target', prompt: 'Which application?' });
        return { readiness: 'needs-clarification', missing, surface: null };
      }
      return { readiness: 'ready', missing, surface: SURFACE_BY_FAMILY[family] };
    }

    case 'headroom': {
      if (args.action === 'clear' && context.includedContextCount === 0) {
        missing.push({ kind: 'context-item', prompt: 'There is no context to clear.' });
        return { readiness: 'needs-context', missing, surface: null };
      }
      return { readiness: 'ready', missing, surface: SURFACE_BY_FAMILY[family] };
    }

    case 'rig':
    case 'evidence':
    case 'converse':
    default:
      return { readiness: 'ready', missing, surface: SURFACE_BY_FAMILY[family] };
  }
}

/** Specific enough to be useful, honest enough not to imply a workaround. */
const UNSUPPORTED_PROMPTS: Partial<Record<IntentFamily, string>> = {
  run: 'Governed runs are not connected yet, so nothing was proposed or run.',
  proposal: 'The approval surface is not connected yet.',
  rig: 'Rig is not connected to this surface yet.',
  headroom: 'Headroom is not connected to this surface yet.',
  evidence: 'Evidence browsing is not connected yet.',
  'live-app': 'No live application is connected yet.',
  project: 'Project selection is not connected yet.',
};

/**
 * Whether an argument was meant as an address, regardless of whether it is an
 * acceptable one.
 *
 * This exists to keep rejection and reinterpretation apart. `example.com` and
 * `https://user:pass@host` are both URL attempts; only the first is allowed.
 * Treating the rejected one as an application name would convert a security
 * refusal into a different action, which is worse than the refusal.
 */
function looksLikeUrlAttempt(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  // Any scheme, including non-web ones such as file: and mailto:.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/\s/.test(trimmed)) return true;

  const authority = trimmed.split(/[/?#]/, 1)[0] ?? '';
  const hostOnly = authority.replace(/:\d+$/, '');

  // Bare loopback and link-local names. These carry no dot and no scheme, so
  // the dotted-domain check below never sees them, which is how `/open
  // 127.0.0.1` previously slipped through as an application name.
  if (/^(localhost|localhost\.localdomain)$/i.test(hostOnly)) return true;
  if (/\.(local|internal|lan|home|test)$/i.test(hostOnly)) return true;

  // Bracketed IPv6, with or without a port.
  if (/^\[[0-9a-f:.]+\]$/i.test(hostOnly)) return true;
  // Bare IPv6 is only unambiguous with two or more colons.
  if (/^[0-9a-f]*:[0-9a-f:]*:[0-9a-f:.]*$/i.test(trimmed) && trimmed.includes('::')) return true;

  // Dotted quad, whether or not the octets are in range. An out-of-range quad
  // is still an address attempt and must not become an application name.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostOnly)) return true;

  // Host with an explicit port, e.g. myhost:8080.
  if (/^[a-z0-9-]+:\d{1,5}$/i.test(authority)) return true;

  // Ordinary dotted domain.
  if (/\b[a-z0-9-]+\.[a-z]{2,}\b/i.test(trimmed)) return true;

  // Userinfo shaped, e.g. user:pass@host.
  if (trimmed.includes('@') && !/\s/.test(trimmed)) return true;

  return false;
}

/** Front door 1: an explicit slash action. The user asserts the family. */
function selectFromSlash(input: string): FamilySelection | null {
  const parsed = parseSlashInput(input);
  if (!parsed) return null;

  const command = findSlashCommand(parsed.name);
  if (!command) {
    // An unrecognised command is a conversation about what is available, not a
    // silent failure and not an invented family.
    return {
      family: 'converse',
      args: parsed.name ? { action: 'help', target: parsed.name } : { action: 'help' },
    };
  }

  const args: IntentArgs = {};
  if (command.action) args.action = command.action;

  if (command.family === 'web-surface' && parsed.rest) {
    // Reuse the shared normaliser rather than parsing a URL here. This is what
    // makes slash and natural language agree on credential rejection, private
    // address rejection, scheme handling, and trailing punctuation.
    const request = extractWebPreviewRequest(parsed.rest);
    if (request) {
      args.url = request.url;
      args.label = request.name;
      args.action = 'open';
      return { family: 'web-surface', args };
    }

    // A rejected URL is not an application name. Credential-bearing URLs,
    // private addresses, and non-web schemes must stay rejected rather than
    // being reinterpreted as something else, which would turn a refusal into a
    // silent redirection.
    if (looksLikeUrlAttempt(parsed.rest)) {
      return { family: 'web-surface', args: { action: 'open' } };
    }

    // `/open` covers registered applications as well as public pages. An
    // argument that was never URL-shaped is an application name.
    return { family: 'live-app', args: { target: parsed.rest } };
  }

  if (command.family === 'web-surface') args.action = 'open';

  // Only carry the remainder as a target when it was not consumed into a more
  // specific slot. Otherwise `/open <url>` would carry a target that the
  // natural-language form has no way to produce, and the two would diverge.
  if (parsed.rest && !args.url) args.target = parsed.rest;

  return { family: command.family, args };
}

/**
 * Front door 2: natural language, matched deterministically.
 *
 * Order matters. More specific phrases are tested before more general ones, so
 * "open the project example.com" is a project intent rather than a web preview.
 */
function selectFromNaturalLanguage(input: string, context: ResolverContext): FamilySelection {
  const projectMatch = matchProjectPhrase(input);
  if (projectMatch) {
    return { family: 'project', args: { target: projectMatch.target } };
  }

  const runMatch = matchRunPhrase(input);
  if (runMatch) {
    return { family: 'run', args: { target: runMatch.target } };
  }

  const inspectMatch = matchInspectPhrase(input);
  if (inspectMatch) {
    return { family: 'artifact', args: { target: inspectMatch.target } };
  }

  const webIntent = resolveWebPreviewIntent(input, context.hasOpenWebPreview);
  if (webIntent?.kind === 'open') {
    return {
      family: 'web-surface',
      args: { url: webIntent.request.url, label: webIntent.request.name, action: 'open' },
    };
  }
  if (webIntent?.kind === 'close' || webIntent?.kind === 'reload') {
    return { family: 'web-surface', args: { action: webIntent.kind } };
  }
  if (webIntent?.kind === 'clarify') {
    return { family: 'web-surface', args: { action: 'open' } };
  }

  const route = resolveConversationRoute(input, {
    hasWorkspace: context.hasWorkspace,
    hasSelectedFile: context.hasSelectedFile,
  });

  if (route === 'workspace') {
    return { family: 'artifact', args: {} };
  }

  return { family: 'converse', args: {} };
}

/**
 * Resolve composer input into an IntentEnvelope.
 *
 * The `+` attachment menu does not call this. Attachments produce ContextItem
 * records in the tray and only meet intent at send time, when the Headroom
 * envelope is assembled.
 */
export function resolveIntent(
  input: string,
  context: ResolverContext = DEFAULT_RESOLVER_CONTEXT,
): IntentEnvelope {
  const trimmed = input.trim();

  const slashSelection = trimmed.startsWith('/') ? selectFromSlash(trimmed) : null;
  const assertedBy: AssertedBy = slashSelection ? 'user-slash' : 'deterministic-matcher';
  const selection = slashSelection ?? selectFromNaturalLanguage(trimmed, context);

  const { readiness, missing, surface } = evaluateReadiness(selection, context);

  return {
    family: selection.family,
    readiness,
    assertedBy,
    // A slash assertion is not a guess, so there is no confidence to report.
    confidence: assertedBy === 'user-slash' ? null : 1,
    missing,
    surface,
    args: selection.args,
    rawInput: input,
  };
}
