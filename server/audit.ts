import * as fs from 'fs';
import * as path from 'path';

const AUDIT_LOG_PATH = path.resolve(__dirname, 'audit.log');

export interface AuditRecord {
  timestamp: string;
  event: string;
  details: any;
}

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

  const record: AuditRecord = {
    timestamp: new Date().toISOString(),
    event,
    details,
  };
  const line = JSON.stringify(record) + '\n';
  try {
    fs.appendFileSync(AUDIT_LOG_PATH, line, 'utf8');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[AUDIT ERROR] Failed to write audit record:', msg);
  }
}
