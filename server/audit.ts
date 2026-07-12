import * as fs from 'fs';
import * as path from 'path';

const AUDIT_LOG_PATH = path.resolve(__dirname, 'audit.log');

export interface AuditRecord {
  timestamp: string;
  event: string;
  details: any;
}

export function logAudit(event: string, details: any): void {
  const record: AuditRecord = {
    timestamp: new Date().toISOString(),
    event,
    details,
  };
  const line = JSON.stringify(record) + '\n';
  try {
    fs.appendFileSync(AUDIT_LOG_PATH, line, 'utf8');
  } catch (err: any) {
    console.error('[AUDIT ERROR] Failed to write audit record:', err.message);
  }
}
