import * as fs from 'fs';
import * as path from 'path';
import { isTestProcess, sameLocation } from './appData';

/** The PaneTera server's own audit log, next to this module. */
export const DEFAULT_AUDIT_LOG_PATH = path.resolve(__dirname, 'audit.log');

const AUDIT_LOG_REFUSAL =
  'Refusing to use the PaneTera server audit log from a test process. '
  + 'Set PANETERA_AUDIT_LOG to an isolated temporary file '
  + '(npm test does this through test/support/isolatedAppData.mjs).';

/**
 * Where audit records are written and read. PANETERA_AUDIT_LOG overrides the
 * location. A test process must supply an isolated file and never appends to
 * the server's own log.
 */
export function resolveAuditLogPath(env: Readonly<Record<string, string | undefined>> = process.env): string {
  const override = env.PANETERA_AUDIT_LOG;
  const testProcess = isTestProcess(env);
  if (override) {
    if (testProcess && sameLocation(override, DEFAULT_AUDIT_LOG_PATH)) throw new Error(AUDIT_LOG_REFUSAL);
    return path.resolve(override);
  }
  if (testProcess) throw new Error(AUDIT_LOG_REFUSAL);
  return DEFAULT_AUDIT_LOG_PATH;
}

export interface AuditRecord {
  timestamp: string;
  event: string;
  details: any;
}

/**
 * Append one already-formed record to the audit log.
 *
 * The single writer, shared by the legacy `logAudit` below and the typed
 * `logTypedAudit` in `auditRecord.ts`, so both kinds of line live in one
 * append-only file and there is one place that touches disk.
 */
export function appendAuditLine(record: object): void {
  const line = JSON.stringify(record) + '\n';
  try {
    fs.appendFileSync(resolveAuditLogPath(), line, 'utf8');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[AUDIT ERROR] Failed to write audit record:', msg);
  }
}

/**
 * The legacy loose record. Kept unchanged and backward-compatible: existing call
 * sites and the current read API and Audit UI all keep working. New,
 * authoritative pathways use `logTypedAudit` instead, and legacy lines are read
 * back as `unknown / legacy-unattributed` rather than being guessed at.
 */
export function logAudit(arg1: any, arg2?: any): void {
  let event = 'audit_event';
  let details: any = {};

  if (typeof arg1 === 'string') {
    event = arg1;
    details = arg2 || {};
  } else if (arg1 && typeof arg1 === 'object') {
    event = arg1.operation || arg1.event || 'audit_event';
    details = arg1;
  }

  appendAuditLine({
    timestamp: new Date().toISOString(),
    event,
    details,
  });
}
