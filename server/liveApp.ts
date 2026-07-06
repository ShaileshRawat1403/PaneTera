// server/liveApp.ts
//
// Core processor for Live Deployed App Experience Cards (Soothsayer POC).
// Strictly preview-only and read-only. Does not support mutation or scraping.

import type { ExecutionMode } from './execution/types';

export type LiveAppTruthSource =
  | 'manifest'
  | 'url-preview'
  | 'browser-observation'
  | 'user-config';

export interface LiveAppWorkbenchData {
  appName: string;
  url: string | null;
  configured: boolean;
  reachable: boolean | null;
  manifestAvailable: boolean;
  manifestUrl: string | null;
  environment: string | null;
  version: string | null;
  routes: Array<{ path: string; label?: string }>;
  features: Array<{ id: string; label: string; status?: string }>;
  workflows: Array<{ id: string; label: string; status?: string }>;
  health: Record<string, unknown> | null;
  sourceLabels: Array<{
    source: LiveAppTruthSource;
    status: 'available' | 'unavailable' | 'unverified' | 'future';
    note: string;
  }>;
  personaLenses: Array<'engineer' | 'pm' | 'ba' | 'qa' | 'exec'>;
  warnings: string[];
  previewOnly: true;
}

/**
 * Parses queries to determine if the user intends to inspect Soothsayer live.
 * Matches conservative, strict patterns.
 */
export function parseLiveAppIntent(query: string): { appName: string } | null {
  const q = query.trim().toLowerCase();

  const patterns = [
    /^inspect\s+soothsayer$/i,
    /^show\s+soothsayer\s+live\s+app$/i,
    /^open\s+soothsayer\s+workbench$/i,
    /^soothsayer\s+status$/i,
    /^soothsayer\s+live\s+preview$/i,
    /^review\s+soothsayer\s+app$/i,
  ];

  for (const pat of patterns) {
    if (pat.test(q)) {
      return { appName: 'soothsayer' };
    }
  }

  return null;
}

/**
 * Connects to the live deployed app, verifies manifest, and builds workbench data.
 */
export async function buildLiveAppWorkbench(
  appName: string,
  envLiveUrl = process.env.SOOTHSAYER_LIVE_URL,
): Promise<LiveAppWorkbenchData> {
  const warnings: string[] = [];
  const personaLenses: Array<'engineer' | 'pm' | 'ba' | 'qa' | 'exec'> = [
    'engineer',
    'pm',
    'ba',
    'qa',
    'exec',
  ];

  if (!envLiveUrl) {
    warnings.push('SOOTHSAYER_LIVE_URL is not configured.');
    const sourceLabels: Array<{
      source: LiveAppTruthSource;
      status: 'available' | 'unavailable' | 'unverified' | 'future';
      note: string;
    }> = [
      {
        source: 'user-config',
        status: 'unavailable',
        note: 'SOOTHSAYER_LIVE_URL environment variable is unset.',
      },
      {
        source: 'url-preview',
        status: 'unavailable',
        note: 'Live app preview URL is not configured.',
      },
      {
        source: 'manifest',
        status: 'unavailable',
        note: 'Manifest endpoint cannot be checked.',
      },
      {
        source: 'browser-observation',
        status: 'future',
        note: 'Chrome observation is not connected yet.',
      },
    ];

    return {
      appName: 'Soothsayer',
      url: null,
      configured: false,
      reachable: null,
      manifestAvailable: false,
      manifestUrl: null,
      environment: null,
      version: null,
      routes: [],
      features: [],
      workflows: [],
      health: null,
      sourceLabels,
      personaLenses,
      warnings,
      previewOnly: true,
    };
  }

  // Normalize URL
  let baseUrl = envLiveUrl.trim();
  if (!/^https?:\/\//i.test(baseUrl)) {
    baseUrl = `http://${baseUrl}`;
  }
  // Remove trailing slash if present
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }

  const manifestUrl = `${baseUrl}/api/portal-manifest`;

  let reachable = false;
  let manifestAvailable = false;
  let environment: string | null = null;
  let version: string | null = null;
  let routes: Array<{ path: string; label?: string }> = [];
  let features: Array<{ id: string; label: string; status?: string }> = [];
  let workflows: Array<{ id: string; label: string; status?: string }> = [];
  let health: Record<string, unknown> | null = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const resp = await fetch(manifestUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    reachable = true;
    if (resp.ok) {
      const body = (await resp.json()) as any;
      if (body && typeof body === 'object') {
        manifestAvailable = true;
        environment = body.environment || 'unknown';
        version = body.version || 'unknown';

        if (Array.isArray(body.routes)) {
          routes = body.routes.map((r: any) => ({
            path: typeof r === 'string' ? r : r.path || '',
            label: typeof r === 'object' ? r.method : undefined,
          }));
        }
        if (Array.isArray(body.features)) {
          features = body.features.map((f: any) => ({
            id: typeof f === 'string' ? f : f.id || '',
            label: typeof f === 'string' ? f : f.label || f.id || '',
          }));
        }
        if (Array.isArray(body.workflows)) {
          workflows = body.workflows.map((w: any) => ({
            id: typeof w === 'string' ? w : w.id || w.name || '',
            label: typeof w === 'string' ? w : w.label || w.name || w.id || '',
          }));
        }
        if (body.health && typeof body.health === 'object') {
          health = body.health;
        }
      } else {
        warnings.push('Manifest endpoint returned invalid JSON structure.');
      }
    } else {
      warnings.push(`Manifest fetch failed with HTTP status ${resp.status}`);
    }
  } catch (e: any) {
    reachable = false;
    warnings.push(`Failed to reach manifest endpoint: ${e.message}`);
  }

  if (!manifestAvailable) {
    warnings.push('Portal manifest endpoint unavailable. Workspace is in unverified preview-only state.');
  }

  const sourceLabels: Array<{
    source: LiveAppTruthSource;
    status: 'available' | 'unavailable' | 'unverified' | 'future';
    note: string;
  }> = [
    {
      source: 'user-config',
      status: 'available',
      note: 'SOOTHSAYER_LIVE_URL environment variable is set.',
    },
    {
      source: 'url-preview',
      status: reachable ? 'available' : 'unavailable',
      note: reachable ? 'Live app server is reachable.' : 'Live app server is unreachable.',
    },
    {
      source: 'manifest',
      status: manifestAvailable ? 'available' : 'unavailable',
      note: manifestAvailable
        ? 'Successfully parsed app-native /api/portal-manifest.'
        : 'App-native portal-manifest is missing or returned errors.',
    },
    {
      source: 'browser-observation',
      status: 'future',
      note: 'Chrome extension authenticated observation is not connected.',
    },
  ];

  return {
    appName: 'Soothsayer',
    url: baseUrl,
    configured: true,
    reachable,
    manifestAvailable,
    manifestUrl,
    environment,
    version,
    routes,
    features,
    workflows,
    health,
    sourceLabels,
    personaLenses,
    warnings,
    previewOnly: true,
  };
}
