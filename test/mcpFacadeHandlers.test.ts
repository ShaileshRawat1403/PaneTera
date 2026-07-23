// test/mcpFacadeHandlers.test.ts
//
// Handler-level tests that invoke the real façade handlers and inspect the audit
// record each produced. The prior slice tested only the attribution helper in
// isolation, so a handler that failed to emit on a real failure path went
// unnoticed. These drive all four terminal outcomes through an actual handler
// and read the record back from the audit log.
//
// The read service is a singleton; each case stubs one method to force the
// outcome, so success, ownership denial, a missing target, and an unexpected
// service error are all exercised against real handler code.

process.env.NODE_ENV = 'test';

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { browserEvidenceReadService, UnauthorizedAccessError } from '../server/browserEvidenceReadService';
import { browserGetCapture } from '../server/mcp/browserOperatorServer';

const AUDIT_LOG = fileURLToPath(new URL('../server/audit.log', import.meta.url));

/** Every typed record whose transaction id matches, read back from the log. */
function recordsForTransaction(txn: string): Record<string, unknown>[] {
  if (!existsSync(AUDIT_LOG)) return [];
  const lines = readFileSync(AUDIT_LOG, 'utf8').trim().split('\n');
  const found: Record<string, unknown>[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if ((parsed?.details as { transactionId?: string })?.transactionId === txn) found.push(parsed);
    } catch {
      // ignore an unparsable line
    }
  }
  return found;
}

/** The single record for a transaction, or null. */
function recordForTransaction(txn: string): Record<string, unknown> | null {
  const found = recordsForTransaction(txn);
  return found.length ? found[found.length - 1] : null;
}

const principal = { clientId: 'mcp-client-alpha', subjectId: 's1', scopes: ['browser.read'] };
const original = browserEvidenceReadService.getCapture.bind(browserEvidenceReadService);

afterEach(() => {
  browserEvidenceReadService.getCapture = original;
});

describe('every terminal handler outcome is audited as an mcp-client action', () => {
  it('records a success', async () => {
    browserEvidenceReadService.getCapture = () =>
      ({ captureId: 'c1', title: 'T', url: 'https://x.com/', capturedAt: 'now' }) as never;
    const txn = `txn-ok-${Math.random()}`;

    const result = await browserGetCapture(principal, txn, { captureId: 'c1' });
    assert.ok(!result.isError, 'a found capture is not an error');

    const record = recordForTransaction(txn);
    assert.ok(record, 'a record was written');
    assert.strictEqual((record!.actor as { kind: string }).kind, 'mcp-client');
    assert.strictEqual(record!.outcome, 'success');
    assert.strictEqual(record!.policyDecision, 'allowed');
  });

  it('records an ownership denial as denied', async () => {
    browserEvidenceReadService.getCapture = () => {
      throw new UnauthorizedAccessError('not owned by principal');
    };
    const txn = `txn-denied-${Math.random()}`;

    const result = await browserGetCapture(principal, txn, { captureId: 'c1' });
    assert.ok(result.isError, 'a denial is an error result to the client');

    const record = recordForTransaction(txn);
    assert.ok(record, 'a denial is audited');
    assert.strictEqual((record!.actor as { kind: string }).kind, 'mcp-client');
    assert.strictEqual(record!.outcome, 'denied');
    assert.strictEqual(record!.policyDecision, 'denied');
  });

  it('records an authorised lookup of a missing target as allowed error', async () => {
    browserEvidenceReadService.getCapture = () => undefined;
    const txn = `txn-missing-${Math.random()}`;

    const result = await browserGetCapture(principal, txn, { captureId: 'nope' });
    assert.ok(result.isError, 'a missing target is an error result');

    const record = recordForTransaction(txn);
    assert.ok(record, 'a missing target is audited, not silent');
    assert.strictEqual((record!.actor as { kind: string }).kind, 'mcp-client');
    assert.strictEqual(record!.outcome, 'error');
    assert.strictEqual(record!.policyDecision, 'allowed');
  });

  it('records an unexpected service failure as allowed error and re-throws it', async () => {
    browserEvidenceReadService.getCapture = () => {
      throw new Error('read service exploded');
    };
    const txn = `txn-error-${Math.random()}`;

    await assert.rejects(
      () => browserGetCapture(principal, txn, { captureId: 'c1' }),
      /read service exploded/,
      'an unexpected failure is not swallowed',
    );

    const record = recordForTransaction(txn);
    assert.ok(record, 'the failure is audited before it re-throws');
    assert.strictEqual((record!.actor as { kind: string }).kind, 'mcp-client');
    assert.strictEqual(record!.outcome, 'error');
    assert.strictEqual(record!.policyDecision, 'allowed');
  });

  it('treats a response that cannot be built as an error, never a success', async () => {
    // The reproduced defect: a lookup succeeds but the response fails to
    // serialise. Success must not be recorded, and exactly one allowed/error
    // record must exist for the transaction.
    const cyclic: Record<string, unknown> = { captureId: 'c1' };
    cyclic.self = cyclic;
    browserEvidenceReadService.getCapture = () => cyclic as never;
    const txn = `txn-cyclic-${Math.random()}`;

    await assert.rejects(
      () => browserGetCapture(principal, txn, { captureId: 'c1' }),
      /circular|Converting circular/i,
      'the handler rejects when its response cannot be built',
    );

    const records = recordsForTransaction(txn);
    assert.strictEqual(records.length, 1, 'exactly one record, not a success plus an error');
    assert.strictEqual(records[0].outcome, 'error', 'the one record is an error');
    assert.strictEqual(records[0].policyDecision, 'allowed');
    assert.ok(
      !records.some((r) => r.outcome === 'success'),
      'no success record exists for a failed response',
    );
  });
});
