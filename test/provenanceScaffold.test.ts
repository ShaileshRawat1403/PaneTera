import assert from 'assert';
import { collectCandidateSources, deriveProvenanceScaffold } from '../server/provenance';
import type { AgentEvent } from '../server/agent/types';

function makeEvent(overrides: Partial<AgentEvent>): AgentEvent {
  return {
    eventId: 'evt-1',
    runId: 'run-1',
    sequence: 1,
    type: 'tool.completed',
    timestamp: new Date().toISOString(),
    summary: 'test event',
    ...overrides,
  };
}

// The candidate collector is the testable core of the scaffold: it gathers
// eventIds and capability names off tool.completed events only, and ignores
// every other event type in the run's log.
function collectsToolCompletedEventsOnly() {
  const events: AgentEvent[] = [
    makeEvent({ eventId: 'evt-1', type: 'tool.completed', data: { capability: 'fetchWebPage' } }),
    makeEvent({ eventId: 'evt-2', type: 'tool.started', data: { capability: 'fetchWebPage' } }),
    makeEvent({ eventId: 'evt-3', type: 'tool.completed', data: { capability: 'runShell' } }),
    makeEvent({ eventId: 'evt-4', type: 'model.completed' }),
  ];

  const result = collectCandidateSources(events);
  assert.deepStrictEqual(result.eventIds, ['evt-1', 'evt-3'], 'only tool.completed eventIds are gathered');
  assert.deepStrictEqual(result.capabilities, ['fetchWebPage', 'runShell'], 'capability names ride along in order');
}

// Repeated capabilities across multiple tool calls should dedupe, since the
// field is meant for display (a list of what ran), not a per-call tally.
function dedupesRepeatedCapabilities() {
  const events: AgentEvent[] = [
    makeEvent({ eventId: 'evt-1', type: 'tool.completed', data: { capability: 'fetchWebPage' } }),
    makeEvent({ eventId: 'evt-2', type: 'tool.completed', data: { capability: 'fetchWebPage' } }),
  ];

  const result = collectCandidateSources(events);
  assert.deepStrictEqual(result.eventIds, ['evt-1', 'evt-2'], 'every matching event still contributes its id');
  assert.deepStrictEqual(result.capabilities, ['fetchWebPage'], 'capability names are deduplicated');
}

// The store persists arbitrary, possibly stale or hand-edited JSON. The
// collector must never throw on missing fields, wrong types, or junk entries.
function defendsAgainstMalformedEvents() {
  const junk = [
    null,
    undefined,
    42,
    'not an event',
    { type: 'tool.completed' }, // missing eventId
    { eventId: 'evt-ok', type: 'tool.completed' }, // missing data
    { eventId: 'evt-bad-capability', type: 'tool.completed', data: { capability: 123 } },
    { eventId: '', type: 'tool.completed', data: { capability: 'x' } }, // empty eventId
  ] as unknown as AgentEvent[];

  const result = collectCandidateSources(junk);
  assert.deepStrictEqual(result.eventIds, ['evt-ok', 'evt-bad-capability'], 'only well-formed eventIds survive');
  assert.deepStrictEqual(result.capabilities, [], 'a non-string capability is dropped, not coerced');

  assert.doesNotThrow(() => collectCandidateSources(null as unknown as AgentEvent[]), 'a non-array input never throws');
  assert.deepStrictEqual(collectCandidateSources(null as unknown as AgentEvent[]), { eventIds: [], capabilities: [] });
}

// The scaffold builder is intentionally inert right now: it always returns
// an empty attribution list, regardless of what candidate sources exist.
function scaffoldReturnsRunIdWithEmptyAttributions() {
  const events: AgentEvent[] = [
    makeEvent({ eventId: 'evt-1', type: 'tool.completed', data: { capability: 'fetchWebPage' } }),
  ];
  const provenance = deriveProvenanceScaffold('run-42', events, 'Here is the answer.');
  assert.strictEqual(provenance.runId, 'run-42');
  assert.deepStrictEqual(provenance.attributions, [], 'no claims are emitted yet; this is groundwork only');
}

function scaffoldNeverThrowsOnJunk() {
  assert.doesNotThrow(() => deriveProvenanceScaffold('run-1', [] as AgentEvent[], ''));
  assert.doesNotThrow(() => deriveProvenanceScaffold('run-1', null as unknown as AgentEvent[], 'reply'));
  const provenance = deriveProvenanceScaffold('run-1', [{ garbage: true }] as unknown as AgentEvent[], 'reply');
  assert.deepStrictEqual(provenance, { runId: 'run-1', attributions: [] });
}

function main() {
  console.log('Running provenance scaffold tests...');
  collectsToolCompletedEventsOnly();
  dedupesRepeatedCapabilities();
  defendsAgainstMalformedEvents();
  scaffoldReturnsRunIdWithEmptyAttributions();
  scaffoldNeverThrowsOnJunk();
  console.log('Provenance scaffold tests passed.');
}

main();
