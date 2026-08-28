// test/eventTicketAndCors.test.ts
//
// Two boundary policies that both used to fail open:
//   1. The SSE stream accepted the master token from a query string.
//   2. CORS granted every origin when no allowlist was configured.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  issueEventTicket,
  consumeEventTicket,
  resetEventTickets,
  outstandingEventTickets,
  EVENT_TICKET_TTL_MS,
  MAX_OUTSTANDING_TICKETS,
} from '../server/eventTicket';
import { resolveAllowedOrigin } from '../server/middleware/securityHeaders';

describe('event stream tickets', () => {
  it('issues a high-entropy ticket that is spent exactly once', () => {
    resetEventTickets();
    const { ticket } = issueEventTicket();

    assert.match(ticket, /^[0-9a-f]{64}$/, '32 random bytes, hex encoded');
    assert.strictEqual(consumeEventTicket(ticket), true, 'first use succeeds');
    assert.strictEqual(consumeEventTicket(ticket), false, 'replay is refused');
    assert.strictEqual(consumeEventTicket(ticket), false, 'and stays refused');
  });

  it('issues a distinct ticket every time', () => {
    resetEventTickets();
    const seen = new Set<string>();
    for (let i = 0; i < 32; i += 1) seen.add(issueEventTicket().ticket);
    assert.strictEqual(seen.size, 32, 'no ticket is ever reissued');
  });

  it('refuses a ticket after its TTL', () => {
    resetEventTickets();
    const now = 1_000_000;
    const { ticket } = issueEventTicket(now);

    assert.strictEqual(
      consumeEventTicket(ticket, now + EVENT_TICKET_TTL_MS + 1),
      false,
      'an expired ticket is not accepted',
    );
  });

  it('accepts a ticket right up to its expiry', () => {
    resetEventTickets();
    const now = 2_000_000;
    const { ticket } = issueEventTicket(now);
    assert.strictEqual(consumeEventTicket(ticket, now + EVENT_TICKET_TTL_MS - 1), true);
  });

  it('reports an expiry the client can read', () => {
    resetEventTickets();
    const now = 3_000_000;
    const { expiresAt } = issueEventTicket(now);
    assert.strictEqual(expiresAt, new Date(now + EVENT_TICKET_TTL_MS).toISOString());
  });

  it('rejects anything that is not a well-formed ticket', () => {
    resetEventTickets();
    for (const candidate of [undefined, null, '', 'short', 42, {}, [], 'z'.repeat(64)]) {
      assert.strictEqual(consumeEventTicket(candidate), false, `rejects ${String(candidate)}`);
    }
  });

  it('does not grow without bound when tickets are minted and never spent', () => {
    resetEventTickets();
    for (let i = 0; i < MAX_OUTSTANDING_TICKETS * 3; i += 1) issueEventTicket();
    assert.ok(
      outstandingEventTickets() <= MAX_OUTSTANDING_TICKETS,
      `outstanding tickets stay capped (saw ${outstandingEventTickets()})`,
    );
  });

  it('sweeps expired tickets rather than accumulating them', () => {
    resetEventTickets();
    const now = 4_000_000;
    for (let i = 0; i < 10; i += 1) issueEventTicket(now);
    assert.strictEqual(outstandingEventTickets(), 10);

    // Any later operation past the TTL clears the dead entries.
    consumeEventTicket('0'.repeat(64), now + EVENT_TICKET_TTL_MS + 1);
    assert.strictEqual(outstandingEventTickets(), 0, 'expired tickets are swept');
  });
});

describe('CORS origin policy', () => {
  it('grants nothing when no allowlist is configured', () => {
    // The shipping default: ALLOWED_ORIGINS appears in neither .env nor
    // .env.example. This previously reflected the caller's own Origin back
    // alongside Allow-Credentials.
    assert.strictEqual(resolveAllowedOrigin('https://evil.example', undefined), null);
    assert.strictEqual(resolveAllowedOrigin('https://evil.example', ''), null);
    assert.strictEqual(resolveAllowedOrigin('https://evil.example', '   '), null);
    assert.strictEqual(resolveAllowedOrigin('https://evil.example', ',,,'), null);
  });

  it('grants only an origin that is on the allowlist', () => {
    const allowed = 'https://app.example,https://admin.example';
    assert.strictEqual(resolveAllowedOrigin('https://app.example', allowed), 'https://app.example');
    assert.strictEqual(resolveAllowedOrigin('https://admin.example', allowed), 'https://admin.example');
    assert.strictEqual(resolveAllowedOrigin('https://evil.example', allowed), null);
  });

  it('echoes the exact allowlisted origin, never a wildcard', () => {
    const result = resolveAllowedOrigin('https://app.example', 'https://app.example');
    assert.notStrictEqual(result, '*', 'a wildcard is never returned');
    assert.strictEqual(result, 'https://app.example');
  });

  it('tolerates whitespace in the configured list', () => {
    const allowed = ' https://app.example , https://admin.example ';
    assert.strictEqual(resolveAllowedOrigin('https://app.example', allowed), 'https://app.example');
  });

  it('returns nothing for a same-origin request, which carries no Origin', () => {
    // This is how the app itself is served: Vite proxies /api in development,
    // and the API shares an origin with the built client in production. Neither
    // needs a CORS header at all.
    assert.strictEqual(resolveAllowedOrigin(undefined, 'https://app.example'), null);
    assert.strictEqual(resolveAllowedOrigin('', 'https://app.example'), null);
  });

  it('does not match an origin by prefix or suffix', () => {
    const allowed = 'https://app.example';
    assert.strictEqual(resolveAllowedOrigin('https://app.example.evil.com', allowed), null);
    assert.strictEqual(resolveAllowedOrigin('https://evil-app.example', allowed), null);
    assert.strictEqual(resolveAllowedOrigin('http://app.example', allowed), null, 'scheme must match');
  });
});
