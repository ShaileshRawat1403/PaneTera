// test/auditRecord.test.ts
//
// The versioned, actor-separated audit record. These tests hold the two rules
// the slice exists to enforce: an actor's identity is server-derived and cannot
// be spoofed into a record, and a line whose principal is unknown is labelled
// unknown rather than guessed into system or human.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  AUDIT_SCHEMA_VERSION,
  browserExtensionActor,
  connectorActor,
  fingerprint,
  logTypedAudit,
  normalizeAuditRecord,
  scrubSecrets,
  systemActor,
  unknownActor,
  type TypedAuditInput,
} from '../server/auditRecord';

function typedInput(overrides: Partial<TypedAuditInput> = {}): TypedAuditInput {
  return {
    event: 'test.event',
    actor: systemActor(),
    outcome: 'success',
    policyDecision: 'allowed',
    ...overrides,
  };
}

describe('actor kinds stay distinct and honest', () => {
  it('gives the extension and a connector different kinds and ids', () => {
    const ext = browserExtensionActor({ installationId: 'install-1', runtimeId: 'rt-1' });
    const con = connectorActor({ connectionId: 'conn-1', displayName: 'Local FS' });

    assert.strictEqual(ext.kind, 'browser-extension');
    assert.strictEqual(con.kind, 'connector');
    assert.notStrictEqual(ext.kind, con.kind);
    assert.notStrictEqual(ext.id, con.id);
  });

  it('derives the extension id from the durable installation, not the session bearer', () => {
    // The sessions map is keyed by the access token; the actor id must come from
    // the installation instead, so the bearer can never become an identity.
    const actor = browserExtensionActor({ installationId: 'install-xyz', runtimeId: 'rt' });
    assert.strictEqual(actor.id, fingerprint('install-xyz'));
    assert.ok(actor.id && actor.id.length <= 16, 'id is a short fingerprint');
    assert.ok(!/install-xyz/.test(actor.id ?? ''), 'the raw installation id is not exposed');
  });

  it('refuses to emit a hand-written human or agent actor', () => {
    // The real enforcement, not the absence of a factory. A caller can still
    // hand-write a reserved actor; the emitter must downgrade it to unknown
    // because no authoritative principal source exists yet.
    for (const kind of ['human', 'agent'] as const) {
      const record = logTypedAudit(
        typedInput({ actor: { kind, id: 'invented-user', label: 'Invented Principal' } }),
      );
      assert.strictEqual(record.actor.kind, 'unknown', `${kind} must not be emitted as itself`);
      assert.ok(!/invented-user/.test(record.actor.id ?? ''), 'the invented id does not survive');
    }
  });

  it('downgrades any unbranded actor to unknown', () => {
    // Only factories in the module can brand an actor. A plain object, even with
    // a valid-looking kind, is untrusted.
    const record = logTypedAudit(
      typedInput({ actor: { kind: 'connector', id: 'not-from-a-factory' } }),
    );
    assert.strictEqual(record.actor.kind, 'unknown');
  });

  it('emits a factory-built actor faithfully', () => {
    const record = logTypedAudit(
      typedInput({ actor: connectorActor({ connectionId: 'conn-9', displayName: 'FS' }) }),
    );
    assert.strictEqual(record.actor.kind, 'connector');
    assert.strictEqual(record.actor.id, 'conn-9');
  });

  it('cannot be forged by copying the brand off a factory result', () => {
    // The reproduced attack: read the brand symbol from a real actor and stamp
    // it onto a fabricated one. The brand now lives in a module-private WeakSet,
    // so there is no property to copy.
    const real = systemActor();
    const stolenSymbols = Object.getOwnPropertySymbols(real);
    const forged = { kind: 'connector' as const, id: 'invented-connector', label: 'Forged' };
    for (const symbol of stolenSymbols) {
      (forged as Record<symbol, unknown>)[symbol] = true;
    }

    const record = logTypedAudit(typedInput({ actor: forged }));
    assert.strictEqual(stolenSymbols.length, 0, 'no brand symbol is exposed on a factory result');
    assert.strictEqual(record.actor.kind, 'unknown', 'the forged actor is downgraded');
    assert.ok(!/invented-connector/.test(record.actor.id ?? ''));
  });

  it('freezes factory results so a branded actor cannot be mutated', () => {
    const actor = connectorActor({ connectionId: 'conn-1' });
    assert.ok(Object.isFrozen(actor), 'the factory result is frozen');
    assert.throws(
      () => {
        (actor as { kind: string }).kind = 'human';
      },
      TypeError,
      'mutating a frozen actor throws in strict mode',
    );
  });
});

describe('a record cannot be spoofed', () => {
  it('generates its own record id and timestamp, ignoring any the caller injects', () => {
    const record = logTypedAudit({
      ...typedInput(),
      recordId: 'attacker-controlled',
      timestamp: '1970-01-01T00:00:00.000Z',
      schemaVersion: 999,
    } as TypedAuditInput & Record<string, unknown>);

    assert.notStrictEqual(record.recordId, 'attacker-controlled');
    assert.match(record.recordId, /^audit-/);
    assert.notStrictEqual(record.timestamp, '1970-01-01T00:00:00.000Z');
    assert.strictEqual(record.schemaVersion, AUDIT_SCHEMA_VERSION);
  });

  it('coerces an unrecognised actor kind to unknown', () => {
    const record = logTypedAudit(
      typedInput({ actor: { kind: 'root' as never, id: 'nice-try' } }),
    );
    assert.strictEqual(record.actor.kind, 'unknown');
  });

  it('scrubs a credential that arrives through a factory input', () => {
    // The factory is the only way in, so the scrub path that matters is a secret
    // passed as a connection id or display name.
    const record = logTypedAudit(
      typedInput({
        actor: connectorActor({
          connectionId: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghij',
          displayName: 'Bearer sk-supersecretvalue',
        }),
      }),
    );
    assert.strictEqual(record.actor.kind, 'connector');
    assert.ok(!/eyJhbGci/.test(record.actor.id ?? ''), 'a JWT in the connection id is redacted');
    assert.ok(!/supersecretvalue/.test(record.actor.label ?? ''), 'a bearer in the name is redacted');
  });
});

describe('secrets cannot enter the new fields', () => {
  it('redacts a value under a sensitive key in correlation and details', () => {
    const record = logTypedAudit(
      typedInput({
        correlation: { connectionId: 'conn-1', authToken: 'shhh-1234567890' } as never,
        details: { password: 'hunter2', capability: 'browser.article.extract' },
      }),
    );

    assert.strictEqual((record.correlation as Record<string, unknown>).connectionId, 'conn-1');
    assert.ok(
      !/shhh-1234567890/.test(JSON.stringify(record.correlation)),
      'a token under a sensitive correlation key is redacted',
    );
    assert.ok(!/hunter2/.test(JSON.stringify(record.details)), 'a password in details is redacted');
    assert.strictEqual(record.details.capability, 'browser.article.extract', 'benign detail survives');
  });

  it('redacts a bearer or JWT literal wherever it appears as a value', () => {
    const scrubbed = scrubSecrets({
      note: 'authorization header was Bearer abc.def.ghi123456',
      jwt: 'eyJhbGciOiJI.eyJzdWIiOiIx.sigsigsig',
      plain: 'nothing to see',
    }) as Record<string, string>;

    assert.ok(!/abc\.def\.ghi123456/.test(scrubbed.note), 'bearer literal redacted in a benign field');
    assert.ok(!/eyJhbGci/.test(scrubbed.jwt), 'jwt literal redacted');
    assert.strictEqual(scrubbed.plain, 'nothing to see', 'ordinary text is untouched');
  });

  it('redacts credentials carried inside a targetUrl', () => {
    // The exact reproduced defect: a URL secret hides under a benign key, so
    // name-based scrubbing never sees it. Both migrated browser events write a
    // targetUrl, so this is the real field.
    const record = logTypedAudit(
      typedInput({
        actor: browserExtensionActor({ installationId: 'i1' }),
        details: {
          targetUrl: 'https://x.com/p?token=SECRETVALUE&auth=AAA&q=news#access_token=BBB',
        },
      }),
    );
    const url = String(record.details.targetUrl);
    assert.ok(!/SECRETVALUE/.test(url), 'the token value is gone');
    assert.ok(!/AAA/.test(url), 'the auth value is gone');
    assert.ok(!/BBB/.test(url), 'the fragment token is gone');
    assert.match(url, /token=redacted/, 'the sensitive param name is kept, value redacted');
    assert.match(url, /q=news/, 'a benign query value survives');
    assert.match(url, /#\[redacted\]/, 'the fragment is dropped');
  });

  it('matches the authoritative sanitiser, including bare key and signed-link names', () => {
    // The reproduced gap: `key`, `code`, `sig`, and `X-Amz-Signature` survived.
    // Audit now shares the canonical param policy, so these are all classified.
    const record = logTypedAudit(
      typedInput({
        actor: browserExtensionActor({ installationId: 'i1' }),
        details: {
          targetUrl:
            'https://x.com/p?key=SECRETVALUE&code=OAUTHCODE&sig=SIGNEDVALUE&X-Amz-Signature=AWSSIGNATURE&q=ok',
        },
      }),
    );
    const url = String(record.details.targetUrl);
    for (const leaked of ['SECRETVALUE', 'OAUTHCODE', 'SIGNEDVALUE', 'AWSSIGNATURE']) {
      assert.ok(!url.includes(leaked), `${leaked} must not survive`);
    }
    assert.match(url, /q=ok/, 'a genuinely benign parameter survives');
  });

  it('does not over-redact query names that merely contain a short sensitive name', () => {
    const record = logTypedAudit(
      typedInput({
        actor: browserExtensionActor({ installationId: 'i1' }),
        details: {
          targetUrl: 'https://x.com/p?zipcode=94107&language_code=en&design=y&signal=green',
        },
      }),
    );
    const url = String(record.details.targetUrl);
    assert.match(url, /zipcode=94107/, 'zipcode is not a code param');
    assert.match(url, /language_code=en/, 'language_code is not a code param');
    assert.match(url, /design=y/, 'design is not a sig param');
    assert.match(url, /signal=green/, 'signal is not a sig param');
  });

  it('strips embedded credentials from a url value', () => {
    const record = logTypedAudit(
      typedInput({ details: { targetUrl: 'https://user:secretpass@x.com/p' } }),
    );
    assert.ok(!/secretpass/.test(String(record.details.targetUrl)));
  });

  it('redacts a secret whose value is not a string', () => {
    // Checking the sensitive-key flag only in the string branch let a numeric,
    // boolean, or object secret through. The whole value goes, whatever its type.
    const record = logTypedAudit(
      typedInput({
        details: { password: 1234, token: 987654, enabledSecret: true, credential: { a: 1 } },
      }),
    );
    assert.strictEqual(record.details.password, '[redacted]');
    assert.strictEqual(record.details.token, '[redacted]');
    assert.strictEqual(record.details.enabledSecret, '[redacted]');
    assert.strictEqual(record.details.credential, '[redacted]');
  });

  it('preserves benign object keys that merely resemble sensitive short names', () => {
    // `code` and `sig` match anywhere would erase these. Object keys use the
    // narrow substring rule, and neither `code` nor `sig` is in it.
    const record = logTypedAudit(
      typedInput({
        details: {
          design: 'a layout',
          signal: 'green',
          zipcode: '94107',
          language_code: 'en',
          status_code: 200,
        },
      }),
    );
    assert.strictEqual(record.details.design, 'a layout');
    assert.strictEqual(record.details.signal, 'green');
    assert.strictEqual(record.details.zipcode, '94107');
    assert.strictEqual(record.details.language_code, 'en');
    assert.strictEqual(record.details.status_code, 200);
  });

  it('does not redact legitimate digests and fingerprints', () => {
    // Value-based entropy redaction would destroy the digests audit depends on.
    // The policy is name-based plus literal-shape, so a hex digest survives.
    const record = logTypedAudit(
      typedInput({ details: { outputDigest: 'a'.repeat(64), provenanceRecordId: 'rec-abc' } }),
    );
    assert.strictEqual(record.details.outputDigest, 'a'.repeat(64), 'a digest is not mistaken for a secret');
    assert.strictEqual(record.details.provenanceRecordId, 'rec-abc');
  });
});

describe('malformed details never crash the recorded operation', () => {
  it('records a cyclic details object without throwing', () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;

    const record = logTypedAudit(typedInput({ details: cyclic }));
    assert.ok(record, 'a record was still written');
    assert.ok(/cyclic/.test(JSON.stringify(record.details)), 'the cycle is marked, not followed');
  });

  it('bounds a pathologically deep object rather than overflowing', () => {
    let deep: Record<string, unknown> = {};
    const root = deep;
    for (let i = 0; i < 500; i += 1) {
      const next: Record<string, unknown> = {};
      deep.child = next;
      deep = next;
    }
    assert.doesNotThrow(() => {
      logTypedAudit(typedInput({ details: root }));
    });
  });

  it('always produces serialisable details', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.loop = cyclic;
    const record = logTypedAudit(typedInput({ details: cyclic }));
    assert.doesNotThrow(() => JSON.stringify(record.details), 'the written details serialise');
  });
});

describe('correlation identifiers survive', () => {
  it('carries run, proposal, approval, grant, connection, and parent through the emitter', () => {
    const correlation = {
      runId: 'run-1',
      proposalId: 'prop-1',
      approvalId: 'appr-1',
      grantId: 'grant-1',
      connectionId: 'conn-1',
      parentRecordId: 'rec-parent',
      captureId: 'capture-1',
    };
    const record = logTypedAudit(typedInput({ correlation }));
    assert.deepStrictEqual(record.correlation, correlation);
  });
});

describe('legacy lines read back as explicitly unattributed', () => {
  it('labels a legacy record unknown / legacy-unattributed without guessing', () => {
    const legacy = {
      timestamp: '2026-07-22T00:00:00.000Z',
      event: 'browser.pair',
      details: { actor: 'panetera-ui', policyDecision: 'allowed' },
    };
    const normalized = normalizeAuditRecord(legacy);

    assert.strictEqual(normalized.actor.kind, 'unknown');
    assert.strictEqual(normalized.actor.label, 'legacy-unattributed');
    assert.strictEqual(normalized.schemaVersion, 1);
    // Never relabelled as system or human, even though the legacy line said
    // 'panetera-ui'.
    assert.notStrictEqual(normalized.actor.kind, 'system');
    assert.notStrictEqual(normalized.actor.kind, 'human');
    // The original content is preserved for reading.
    assert.strictEqual(normalized.timestamp, '2026-07-22T00:00:00.000Z');
    assert.strictEqual(normalized.event, 'browser.pair');
  });

  it('passes a typed record through as itself', () => {
    const typed = logTypedAudit(
      typedInput({ event: 'rig.invocation.completed', actor: connectorActor({ connectionId: 'c1' }) }),
    );
    const normalized = normalizeAuditRecord(typed);
    assert.strictEqual(normalized.schemaVersion, AUDIT_SCHEMA_VERSION);
    assert.strictEqual(normalized.actor.kind, 'connector');
    assert.strictEqual(normalized.event, 'rig.invocation.completed');
  });

  it('treats an unparsed raw line as unknown rather than crashing', () => {
    const normalized = normalizeAuditRecord({ raw: 'this was not valid json' });
    assert.strictEqual(normalized.actor.kind, 'unknown');
    assert.strictEqual(normalized.schemaVersion, 1);
  });
});

describe('record identity', () => {
  it('gives every record a unique id and a valid recent timestamp', () => {
    const before = Date.now();
    const records = Array.from({ length: 50 }, () => logTypedAudit(typedInput()));
    const after = Date.now();

    const ids = new Set(records.map((record) => record.recordId));
    assert.strictEqual(ids.size, 50, 'record ids are unique');

    for (const record of records) {
      const parsed = Date.parse(record.timestamp);
      assert.ok(Number.isFinite(parsed), 'timestamp parses');
      assert.ok(parsed >= before - 1000 && parsed <= after + 1000, 'timestamp is recent');
      assert.strictEqual(record.schemaVersion, AUDIT_SCHEMA_VERSION);
    }
  });

  it('fingerprints stably and does not echo the input', () => {
    assert.strictEqual(fingerprint('install-1'), fingerprint('install-1'));
    assert.notStrictEqual(fingerprint('install-1'), fingerprint('install-2'));
    assert.ok(!fingerprint('install-1').includes('install-1'));
  });

  it('keeps unknownActor honest', () => {
    assert.deepStrictEqual(unknownActor(), { kind: 'unknown', id: null, label: 'legacy-unattributed' });
  });
});

describe('the migrated pathways derive actors from server state, not the request', () => {
  it('browser observe and extract use the extension session, never req.body', () => {
    const source = readFileSync(new URL('../server/browserGateway.ts', import.meta.url), 'utf8');

    assert.ok(source.includes('browserExtensionActor(session)'), 'actor comes from the session');
    // The two typed emissions must not read an actor from the request body.
    for (const event of ['browser.observe', 'browser.extract']) {
      const block = source.slice(source.indexOf(`event: '${event}'`), source.indexOf(`event: '${event}'`) + 400);
      assert.ok(block.length > 0, `${event} emission found`);
      assert.ok(!/actor:\s*req\.body/.test(block), `${event} does not take its actor from req.body`);
    }
  });

  it('rig connector reads derive their actor from the governed connection', () => {
    // The rig routes now delegate actor choice to the classification table
    // (server/rig/auditClassification.ts), where the connector actor is built
    // from the connection. The full per-event classification is proven
    // behaviourally in test/rigAudit.test.ts; here we only confirm the connector
    // events pass the connection through and take nothing from the request body.
    const source = readFileSync(new URL('../server/rig/routes.ts', import.meta.url), 'utf8');
    for (const event of ['rig.invocation.completed', 'rig.resource.read', 'rig.prompt.read']) {
      const block = source.slice(source.indexOf(`event: '${event}'`), source.indexOf(`event: '${event}'`) + 400);
      assert.ok(block.length > 0, `${event} emission found`);
      assert.ok(/rigAuditFields\('[^']+', connection\)/.test(block), `${event} passes the governed connection`);
      assert.ok(!/req\.body/.test(block.split('correlation')[0]), `${event} does not take its actor from req.body`);
    }
  });
});
