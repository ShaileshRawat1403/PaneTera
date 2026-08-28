// server/middleware/securityHeaders.ts
//
// Security headers middleware for Express.

import { Request, Response, NextFunction } from 'express';

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy (restrict features)
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
  );

  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http: https: ws: wss:; frame-ancestors 'self';"
  );

  // HSTS (only in production)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}

/**
 * Decide whether a request's Origin is permitted cross-origin access.
 *
 * Fails closed. An empty or unset ALLOWED_ORIGINS grants nothing, where it
 * previously granted everything: the old condition treated "no allowlist
 * configured" as "allow all", and then reflected the caller's own Origin back
 * alongside Access-Control-Allow-Credentials. ALLOWED_ORIGINS is not set in
 * .env.example, so that permissive branch was the shipping default on a server
 * whose routes invoke governed capabilities.
 *
 * Exported so the policy is unit-tested without an Express request.
 */
export function resolveAllowedOrigin(
  origin: string | undefined,
  allowedOriginsEnv: string | undefined,
): string | null {
  if (!origin) return null;
  const allowed = (allowedOriginsEnv || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

/**
 * CORS configuration.
 *
 * Same-origin requests carry no Origin header and need no CORS headers at all,
 * which is how the app itself is served in both development (the Vite dev
 * server proxies /api) and production (the API and the built client share an
 * origin). Cross-origin access is opt-in via ALLOWED_ORIGINS.
 */
export function corsHeaders(req: Request, res: Response, next: NextFunction): void {
  const allowedOrigin = resolveAllowedOrigin(req.headers.origin, process.env.ALLOWED_ORIGINS);

  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    // Vary matters as soon as the header depends on the request: without it a
    // cache can serve one allowed origin's response to a different origin.
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  // Preflight is answered either way. Without the headers above the browser
  // refuses the actual request, which is the intended outcome for an origin
  // that is not on the allowlist.
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}
