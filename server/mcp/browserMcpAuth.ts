import { Request } from 'express';
import * as crypto from 'crypto';
import { emitMcpFacadeAudit } from './mcpAudit';

export interface McpClientPrincipal {
  clientId: string;
  subjectId: string;
  scopes: string[];
}

// In memory revocation list
const revokedTokens = new Set<string>();

// Production credential registry (hashes only)
// In production, this would be populated from secure environment variables or a database.
const credentialRegistry = new Map<string, McpClientPrincipal>();

export function registerMcpCredential(credentialToken: string, principal: McpClientPrincipal) {
  const tokenHash = crypto.createHash('sha256').update(credentialToken).digest('hex');
  credentialRegistry.set(tokenHash, principal);
}

export function revokeLocalCredential(credentialToken: string) {
  revokedTokens.add(crypto.createHash('sha256').update(credentialToken).digest('hex'));
}

export function validateMcpClient(req: Request): { status: number, error?: string, principal?: McpClientPrincipal } {
  // 1. Validate Bearer Token First (401)
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    emitMcpFacadeAudit({
        principal: null,
        event: 'mcp.auth.rejected',
        capability: 'mcp.connect',
        policyDecision: 'denied',
        outcome: 'denied',
        detail: 'Missing or malformed authorization header',
      })
    return { status: 401, error: 'Unauthorized: Missing or malformed authorization header' };
  }

  const token = authHeader.substring(7).trim();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  if (revokedTokens.has(tokenHash)) {
    emitMcpFacadeAudit({
        principal: null,
        event: 'mcp.auth.rejected',
        capability: 'mcp.connect',
        policyDecision: 'denied',
        outcome: 'denied',
        detail: 'Credential revoked',
      })
    return { status: 401, error: 'Unauthorized: Credential revoked' };
  }

  const principal = credentialRegistry.get(tokenHash);
  if (!principal) {
    emitMcpFacadeAudit({
        principal: null,
        event: 'mcp.auth.rejected',
        capability: 'mcp.connect',
        policyDecision: 'denied',
        outcome: 'denied',
        detail: 'Invalid credential',
      })
    return { status: 401, error: 'Unauthorized: Invalid credential' };
  }

  // 2. Validate Host (403)
  const host = req.headers.host || '';
  if (!host.includes('127.0.0.1') && !host.includes('localhost')) {
    emitMcpFacadeAudit({
        principal: principal,
        event: 'mcp.auth.rejected',
        capability: 'mcp.connect',
        policyDecision: 'denied',
        outcome: 'denied',
        detail: `Host rejection: ${host}`,
      })
    return { status: 403, error: 'Forbidden: Invalid Host' };
  }

  // 3. Validate Origin if present (403)
  const origin = req.headers.origin;
  if (origin) {
    if (origin.startsWith('http://') && !origin.includes('127.0.0.1') && !origin.includes('localhost')) {
      emitMcpFacadeAudit({
        principal: principal,
        event: 'mcp.auth.rejected',
        capability: 'mcp.connect',
        policyDecision: 'denied',
        outcome: 'denied',
        detail: `Origin rejection: ${origin}`,
      })
      return { status: 403, error: 'Forbidden: Invalid Origin' };
    }
    if (origin.startsWith('chrome-extension://')) {
      emitMcpFacadeAudit({
        principal: principal,
        event: 'mcp.auth.rejected',
        capability: 'mcp.connect',
        policyDecision: 'denied',
        outcome: 'denied',
        detail: `Origin rejection (chrome-extension): ${origin}`,
      })
      return { status: 403, error: 'Forbidden: Invalid Origin (chrome-extension)' };
    }
  }

  return { status: 200, principal };
}
