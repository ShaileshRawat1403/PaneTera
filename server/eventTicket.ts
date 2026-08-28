// server/eventTicket.ts
//
// Single-use, short-lived tickets for authenticating the SSE stream.
//
// EventSource cannot set request headers, so /api/events previously accepted
// the master PORTAL_TOKEN as a query parameter. A URL is the wrong place for a
// long-lived master credential: query strings reach access logs, proxy logs,
// shell history and Referer headers, and the token in question authorises every
// governed capability the server exposes.
//
// A ticket is exchanged for the stream instead. It is minted only by a caller
// that already presented the master token in an Authorization header, it is
// valid for seconds rather than for the session, it is spent on first use, and
// it authorises exactly one thing: opening the event stream.
//
// The store is deliberately in-process and unpersisted. Tickets are meant to
// die with the server; surviving a restart would make them a credential rather
// than a handshake.

import crypto from 'node:crypto';

/**
 * How long a ticket stays valid. Long enough to cover the round trip from
 * minting to opening the stream, short enough that a leaked URL is worthless
 * by the time anyone reads it.
 */
export const EVENT_TICKET_TTL_MS = 30_000;

/**
 * Cap on outstanding tickets, so a caller looping on the mint endpoint cannot
 * grow the map without bound. Well above what any legitimate client needs: a
 * client holds at most one ticket at a time, and each is spent on connect.
 */
export const MAX_OUTSTANDING_TICKETS = 64;

/** ticket -> expiry timestamp in epoch milliseconds. */
const tickets = new Map<string, number>();

/** 32 random bytes, hex encoded. */
const TICKET_BYTES = 32;
const TICKET_LENGTH = TICKET_BYTES * 2;

/** Drop everything already expired. Called on both mint and consume. */
function sweepExpired(now: number): void {
  for (const [ticket, expiresAt] of tickets) {
    if (expiresAt <= now) tickets.delete(ticket);
  }
}

/**
 * Mint a ticket. The caller must already have been authenticated by the master
 * token; this function does not check that and must never be mounted where an
 * unauthenticated request can reach it.
 */
export function issueEventTicket(now: number = Date.now()): { ticket: string; expiresAt: string } {
  sweepExpired(now);

  // Still at the cap after sweeping means live tickets are being minted faster
  // than they are spent. Drop the oldest so a caller cannot pin the map full.
  while (tickets.size >= MAX_OUTSTANDING_TICKETS) {
    const oldest = tickets.keys().next();
    if (oldest.done) break;
    tickets.delete(oldest.value);
  }

  const ticket = crypto.randomBytes(TICKET_BYTES).toString('hex');
  const expiresAt = now + EVENT_TICKET_TTL_MS;
  tickets.set(ticket, expiresAt);
  return { ticket, expiresAt: new Date(expiresAt).toISOString() };
}

/**
 * Spend a ticket. Returns true exactly once per issued ticket, and only while
 * it is unexpired.
 *
 * The ticket is deleted whether or not it was still valid, so a replay of an
 * expired value cannot linger in the map, and a valid ticket cannot be used to
 * open a second stream.
 */
export function consumeEventTicket(candidate: unknown, now: number = Date.now()): boolean {
  if (typeof candidate !== 'string' || candidate.length !== TICKET_LENGTH) return false;
  sweepExpired(now);
  const expiresAt = tickets.get(candidate);
  if (expiresAt === undefined) return false;
  tickets.delete(candidate);
  return expiresAt > now;
}

/** Test seam: forget every outstanding ticket. */
export function resetEventTickets(): void {
  tickets.clear();
}

/** Test seam: how many tickets are currently outstanding. */
export function outstandingEventTickets(): number {
  return tickets.size;
}
