import * as fs from 'fs';
import * as path from 'path';

const AUDIT_LOG_PATH = path.resolve(__dirname, 'audit.log');

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
    fs.appendFileSync(AUDIT_LOG_PATH, line, 'utf8');
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
