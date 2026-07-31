import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

/** A server-minted identity for an authenticated, configured local operator. */
export interface OperatorPrincipal {
  readonly subjectId: string;
  readonly label: string;
  readonly source: 'configured-local-operator';
}

const PRINCIPALS = new WeakSet<object>();
const REQUEST_PRINCIPALS = new WeakMap<object, OperatorPrincipal>();

function equalSecret(presented: string, expected: string): boolean {
  const left = Buffer.from(presented);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function configuredPrincipal(): OperatorPrincipal | null {
  const subjectId = process.env.PORTAL_OPERATOR_ID?.trim() ?? '';
  if (!subjectId) return null;
  const principal = Object.freeze({
    subjectId,
    label: process.env.PORTAL_OPERATOR_LABEL?.trim() || 'local operator',
    source: 'configured-local-operator' as const,
  });
  PRINCIPALS.add(principal);
  return principal;
}

/**
 * Authorize a portal request and bind an opaque principal to that exact Request
 * object only when the operator identity is configured on the server.
 */
export function authenticatePortalRequest(
  req: Request,
  expectedToken: string,
  options: { allowQueryToken?: boolean } = {},
): boolean {
  const authorization = req.headers.authorization ?? '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const query = options.allowQueryToken && typeof req.query.token === 'string' ? req.query.token : '';
  const presented = bearer || query;
  if (!expectedToken || !presented || !equalSecret(presented, expectedToken)) return false;

  const principal = configuredPrincipal();
  if (principal) REQUEST_PRINCIPALS.set(req, principal);
  return true;
}

export function operatorPrincipalForRequest(req: Request): OperatorPrincipal | undefined {
  return REQUEST_PRINCIPALS.get(req);
}

/**
 * Route-level guard for endpoints mounted before the global master-token gate
 * that still must require the master token (e.g. the workbench audit write,
 * FINDING-001). Reads the configured PORTAL_TOKEN and 401s on a missing or
 * wrong credential.
 */
export function requirePortalToken(req: Request, res: Response, next: NextFunction): void {
  const token = process.env.PORTAL_TOKEN || '';
  if (!authenticatePortalRequest(req, token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

export function isAuthoritativeOperatorPrincipal(value: unknown): value is OperatorPrincipal {
  return typeof value === 'object' && value !== null && PRINCIPALS.has(value as object);
}
