// src/composer/appRegistry.ts
// Resolve a human application name to a registered application id.
//
// `/open Soothsayer` yields the name a person used. `/api/workbench/apps` keys
// on `appId`, e.g. `soothsayer-local`. Passing the name straight through
// produced a request for an application that does not exist, which failed as an
// unavailable status rather than as the naming mistake it was.

export interface RegisteredApp {
  appId: string;
  name?: string;
  displayName?: string;
}

export type AppResolution =
  | { kind: 'resolved'; appId: string; label: string }
  | { kind: 'not-found'; query: string; available: string[] }
  | { kind: 'ambiguous'; query: string; candidates: string[] };

function labelOf(app: RegisteredApp): string {
  return app.displayName ?? app.name ?? app.appId;
}

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Loose comparison for matching a typed name against a registered id.
 *
 * Registered ids commonly decorate the product name with an environment or
 * deployment suffix, so `Soothsayer` should reach `soothsayer-local` without
 * the user knowing the suffix exists.
 */
function slug(value: string): string {
  return normalise(value).replace(/[^a-z0-9]+/g, '');
}

export function resolveAppName(query: string, apps: readonly RegisteredApp[]): AppResolution {
  const wanted = normalise(query);
  const available = apps.map(labelOf);

  if (!wanted) return { kind: 'not-found', query, available };

  // Exact id or label first. An exact match is never ambiguous, even when it is
  // also a prefix of something else.
  const exact = apps.filter(
    (app) => normalise(app.appId) === wanted || normalise(labelOf(app)) === wanted,
  );
  if (exact.length === 1) return { kind: 'resolved', appId: exact[0]!.appId, label: labelOf(exact[0]!) };
  if (exact.length > 1) {
    return { kind: 'ambiguous', query, candidates: exact.map((app) => app.appId) };
  }

  // Then slug equality, which absorbs punctuation and spacing differences.
  const wantedSlug = slug(query);

  // A query of pure punctuation slugs to the empty string, and every string
  // starts with the empty string. Without this guard `/open ---` prefix-matches
  // the only registered app and opens it.
  if (!wantedSlug) return { kind: 'not-found', query, available };

  const slugged = apps.filter(
    (app) => slug(app.appId) === wantedSlug || slug(labelOf(app)) === wantedSlug,
  );
  if (slugged.length === 1) {
    return { kind: 'resolved', appId: slugged[0]!.appId, label: labelOf(slugged[0]!) };
  }
  if (slugged.length > 1) {
    return { kind: 'ambiguous', query, candidates: slugged.map((app) => app.appId) };
  }

  // Finally a prefix match, which is where genuine ambiguity usually appears.
  const prefixed = apps.filter(
    (app) => slug(app.appId).startsWith(wantedSlug) || slug(labelOf(app)).startsWith(wantedSlug),
  );
  if (prefixed.length === 1) {
    return { kind: 'resolved', appId: prefixed[0]!.appId, label: labelOf(prefixed[0]!) };
  }
  if (prefixed.length > 1) {
    // Reported rather than silently resolved to the first candidate. Picking
    // one would open an application the user did not ask for.
    return { kind: 'ambiguous', query, candidates: prefixed.map((app) => app.appId) };
  }

  return { kind: 'not-found', query, available };
}

/** Plain-language explanation for an unresolved name. */
export function describeResolution(resolution: AppResolution): string {
  switch (resolution.kind) {
    case 'resolved':
      return `Opening ${resolution.label}.`;
    case 'ambiguous':
      return `“${resolution.query}” matches more than one registered application: ${resolution.candidates.join(', ')}. Which did you mean?`;
    case 'not-found':
      return resolution.available.length > 0
        ? `I could not find a registered application called “${resolution.query}”. Registered: ${resolution.available.join(', ')}.`
        : `I could not find a registered application called “${resolution.query}”, and no applications are registered yet.`;
  }
}
