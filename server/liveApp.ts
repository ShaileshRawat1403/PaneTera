// server/liveApp.ts
//
// Core processor for Live Deployed App Experience Cards (Soothsayer POC).
// Strictly preview-only and read-only. Does not support mutation or scraping.

import * as crypto from 'crypto';

function signPath(path: string, secret: string, timestamp: number): string {
  const payload = `${timestamp}.${path}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function sameOrigin(left: string, right: string): boolean {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}

export type LiveAppTruthSource =
  | 'manifest'
  | 'workbench'
  | 'url-preview'
  | 'browser-observation'
  | 'user-config';

export interface AppNativeWorkbenchView {
  id: string;
  type: string;
  label: string;
  status: 'template' | 'no-active-run' | 'awaiting-review' | 'available';
  source?: string;
  updatedAt?: string;
  deepLink?: string;
  data?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  inputSchema?: {
    fields: Array<{
      name: string;
      label: string;
      type: 'string' | 'select';
      required?: boolean;
      options?: string[];
      description?: string;
    }>;
  };
  actions?: Array<{
    id: string;
    label: string;
    kind: 'proposal';
    risk: 'low' | 'medium' | 'high';
    requiresApproval: true;
  }>;
}

export interface AppNativeWorkbenchSession {
  app: string;
  environment: string;
  updatedAt: string;
  views: AppNativeWorkbenchView[];
}

export interface LiveAppWorkbenchData {
  appName: string;
  url: string | null;
  configured: boolean;
  urlReachable: boolean | null;
  manifestReachable: boolean | null;
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
  workbench?: AppNativeWorkbenchSession;
  workbenchReachable?: boolean;
  workbenchAvailable?: boolean;
  workbenchSource?: 'app-native-api' | 'fallback' | null;
  embed?: {
    allowed: boolean;
    mode: 'iframe';
    origin: string;
    defaultPath: string;
    routes: Array<{ id: string; label: string; path: string; embedUrl?: string }>;
  } | null;
  embedUrl?: string | null;
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
      urlReachable: null,
      manifestReachable: null,
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

  let urlReachable = false;
  let manifestReachable = false;
  let manifestAvailable = false;
  let environment: string | null = null;
  let version: string | null = null;
  let routes: Array<{ path: string; label?: string }> = [];
  let features: Array<{ id: string; label: string; status?: string }> = [];
  let workflows: Array<{ id: string; label: string; status?: string }> = [];
  let health: Record<string, unknown> | null = null;
  let workbench: AppNativeWorkbenchSession | undefined;

  // 1. Base URL Reachability check
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    await fetch(baseUrl, {
      signal: controller.signal,
      method: 'GET', // Use GET in case HEAD is blocked/unsupported by edge
    });
    clearTimeout(timeoutId);
    urlReachable = true;
  } catch (e: any) {
    // If it threw connection refused / timeout, it is unreachable.
    // If it returned 401/403/etc, fetch resolves successfully (doesn't throw), so urlReachable becomes true.
    urlReachable = false;
    warnings.push(`Base URL reachability check failed: ${e.message}`);
  }

  // 2. Manifest Endpoint reachability check
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(manifestUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    manifestReachable = true;
    if (resp.ok) {
      const body = (await resp.json()) as { environment?: string; version?: string; routes?: unknown[]; features?: unknown[]; health?: Record<string, unknown>; workflows?: unknown[] };
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
            status: typeof f === 'object' && typeof f.status === 'string' ? f.status : undefined,
          }));
        }
        if (Array.isArray(body.workflows)) {
          workflows = body.workflows.map((w: any) => ({
            id: typeof w === 'string' ? w : w.id || w.name || '',
            label: typeof w === 'string' ? w : w.label || w.name || w.id || '',
            status: typeof w === 'object' && typeof w.status === 'string' ? w.status : undefined,
          }));
        }
        if (body.health && typeof body.health === 'object') {
          health = body.health;
        }
      } else {
        warnings.push('Manifest endpoint returned invalid JSON structure.');
      }
    } else {
      warnings.push(`Manifest fetch returned HTTP status ${resp.status}`);
    }
  } catch (e: any) {
    manifestReachable = false;
    warnings.push(`Failed to reach manifest endpoint: ${e.message}`);
  }

  // 3. Dynamic Workbench Endpoint reachability check
  let workbenchReachable = false;
  let workbenchAvailable = false;
  let workbenchSource: 'app-native-api' | 'fallback' | null = null;
  let embed: any = null;
  let embedUrl: string | null = null;
  const workbenchUrl = `${baseUrl}/api/portal-workbench`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(workbenchUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    workbenchReachable = true;
    if (resp.ok) {
      const body = (await resp.json()) as { views?: AppNativeWorkbenchView[]; app?: string; environment?: string; updatedAt?: string; embed?: Record<string, unknown> };
      if (body && typeof body === 'object' && Array.isArray(body.views)) {
        workbenchAvailable = body.views.length > 0;
        workbenchSource = 'app-native-api';
        workbench = {
          app: typeof body.app === 'string' ? body.app : appName,
          environment: typeof body.environment === 'string' ? body.environment : (environment || 'unknown'),
          updatedAt: typeof body.updatedAt === 'string' ? body.updatedAt : new Date().toISOString(),
          views: body.views,
        };
        if (body.embed && typeof body.embed === 'object') {
          const rawEmbed = body.embed;
          const secret = process.env.SOOTHSAYER_PORTAL_EMBED_SECRET || '';
          const origin = typeof rawEmbed.origin === 'string' ? rawEmbed.origin : '';
          const embedOriginAllowed = origin && sameOrigin(origin, baseUrl);
          if (rawEmbed.allowed && secret && embedOriginAllowed) {
            const timestamp = Date.now();
            const defaultPath = typeof rawEmbed.defaultPath === 'string' ? rawEmbed.defaultPath : '/';
            const signature = signPath(defaultPath, secret, timestamp);
            embedUrl = `${origin}/portal-embed?path=${encodeURIComponent(defaultPath)}&token=${timestamp}.${signature}`;
            const signedRoutes = Array.isArray(rawEmbed.routes)
              ? rawEmbed.routes.map((r: any) => {
                  const routePath = r.path || '/';
                  const routeSig = signPath(routePath, secret, timestamp);
                  const routeEmbedUrl = `${origin}/portal-embed?path=${encodeURIComponent(routePath)}&token=${timestamp}.${routeSig}`;
                  return {
                    ...r,
                    embedUrl: routeEmbedUrl
                  };
                })
              : [];
            embed = {
              allowed: true,
              mode: rawEmbed.mode || 'iframe',
              origin,
              defaultPath,
              routes: signedRoutes
            };
          } else {
            if (rawEmbed.allowed && secret && !embedOriginAllowed) {
              warnings.push('Workbench embed origin does not match configured live app origin.');
            }
            embed = {
              allowed: false,
              mode: 'iframe',
              origin,
              defaultPath: '/',
              routes: []
            };
          }
        }
        if (!workbenchAvailable) {
          warnings.push('Workbench endpoint returned no native views.');
        }
      } else {
        warnings.push('Workbench endpoint returned invalid JSON structure. Expected an object with a views array.');
      }
    } else {
      warnings.push(`Workbench fetch returned HTTP status ${resp.status}`);
    }
  } catch (e: any) {
    workbenchReachable = false;
    warnings.push(`Failed to reach workbench endpoint: ${e.message}`);
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
      status: urlReachable ? 'available' : 'unavailable',
      note: urlReachable ? 'Live app server is reachable.' : 'Live app server is unreachable.',
    },
    {
      source: 'manifest',
      status: manifestAvailable ? 'available' : (manifestReachable ? 'unverified' : 'unavailable'),
      note: manifestAvailable
        ? 'Successfully parsed app-native /api/portal-manifest.'
        : (manifestReachable ? 'Manifest endpoint returned error or authentication challenge.' : 'App-native portal-manifest is unreachable.'),
    },
    {
      source: 'workbench',
      status: workbenchAvailable ? 'available' : (workbenchReachable ? 'unverified' : 'unavailable'),
      note: workbenchAvailable
        ? 'Successfully parsed app-native /api/portal-workbench.'
        : (workbenchReachable ? 'Workbench endpoint did not expose usable native views.' : 'App-native portal-workbench is unreachable.'),
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
    urlReachable,
    manifestReachable,
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
    workbench,
    workbenchReachable,
    workbenchAvailable,
    workbenchSource,
    embed,
    embedUrl,
  };
}
