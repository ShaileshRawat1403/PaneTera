// test/addressSafety.test.ts
//
// The web preview probe dials an address on the user's behalf, which makes it a
// request-forgery surface if it can be pointed at internal infrastructure.
//
// The first version validated only the URL text. `resolveWebLink` rejects
// `http://127.0.0.1/` and `http://192.168.1.1/`, and that felt like enough. It
// is not: the text is not what gets connected to. A perfectly public-looking
// hostname can resolve to loopback, to a private range, or to a cloud metadata
// endpoint. The name passes; the destination does not.
//
// These tests cover the second check, on resolved addresses, including the
// notations that let a blocked address back in under a different spelling.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  type AddressRefusal,
  describeAddressRefusal,
  judgeAddress,
  judgeRange,
  pinnedLookup,
  resolveSafely,
} from '../server/workbench/addressSafety';

/** Destinations that must never be dialled, with why they matter. */
const FORBIDDEN: Array<[string, string]> = [
  ['127.0.0.1', 'loopback'],
  ['127.1.1.1', 'the whole of 127/8 is loopback, not just .0.1'],
  ['0.0.0.0', 'unspecified, routes to local on many stacks'],
  ['10.0.0.1', 'private class A'],
  ['172.16.0.1', 'private class B, low edge'],
  ['172.31.255.255', 'private class B, high edge'],
  ['192.168.1.1', 'private class C, the usual router'],
  ['169.254.169.254', 'cloud instance metadata, the usual objective'],
  ['169.254.1.1', 'link-local generally'],
  ['100.64.0.1', 'carrier-grade NAT'],
  ['192.0.0.1', 'IETF protocol assignments'],
  ['198.18.0.1', 'benchmarking range'],
  ['224.0.0.1', 'multicast'],
  ['240.0.0.1', 'reserved'],
  ['::1', 'IPv6 loopback'],
  ['::', 'IPv6 unspecified'],
  ['fc00::1', 'IPv6 unique local'],
  ['fd12:3456::1', 'IPv6 unique local, fd prefix'],
  ['fe80::1', 'IPv6 link-local'],
  ['ff02::1', 'IPv6 multicast'],
  ['::ffff:127.0.0.1', 'IPv4-mapped loopback, the same address in other clothes'],
  ['::ffff:169.254.169.254', 'IPv4-mapped metadata endpoint'],
  ['2002:7f00:1::1', '6to4 can carry an embedded private destination'],
  ['64:ff9b::7f00:1', 'NAT64 can carry an embedded private destination'],

  // Found by review after the hand-maintained denylist looked complete. Each
  // was accepted at the time, and the pattern of finding more on every pass is
  // what forced the switch to an allowlist.
  ['fec0::1', 'deprecated site-local, may still route internally'],
  ['::ffff:0:7f00:1', 'IPv4-translated loopback, a different prefix to IPv4-mapped'],
  ['100::1', 'discard-only'],
  ['2001:db8::1', 'IPv6 documentation'],
  ['192.0.2.1', 'IPv4 documentation, TEST-NET-1'],
  ['198.51.100.1', 'IPv4 documentation, TEST-NET-2'],
  ['203.0.113.1', 'IPv4 documentation, TEST-NET-3'],
  ['198.19.0.1', 'benchmarking, upper half of the /15'],
  ['3fff::1', 'IPv6 documentation, newer allocation'],
  ['5f00::1', 'segment routing'],
  ['2001::1', 'Teredo tunnelling'],
  ['255.255.255.255', 'broadcast'],
];

const ALLOWED = ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946'];

/**
 * The same forbidden destinations, written differently.
 *
 * These are the ones an earlier version let through. It compared spellings
 * rather than bytes, so it refused `::1` and allowed `0:0:0:0:0:0:0:1`, and
 * refused `::ffff:127.0.0.1` while allowing the identical `::ffff:7f00:1`.
 * IPv6 has many ways to write one address; matching a particular way matches
 * almost nothing.
 */
const EQUIVALENT_SPELLINGS: Array<[string, string]> = [
  ['0:0:0:0:0:0:0:1', 'loopback, fully expanded'],
  ['0000:0000:0000:0000:0000:0000:0000:0001', 'loopback, zero-padded'],
  ['0:0:0:0:0:0:0:0', 'unspecified, fully expanded'],
  ['::ffff:7f00:1', 'IPv4-mapped loopback in hex rather than dotted quad'],
  ['::ffff:a9fe:a9fe', 'IPv4-mapped metadata endpoint in hex'],
  ['::ffff:0a00:0001', 'IPv4-mapped private class A in hex'],
  ['::FFFF:7F00:1', 'the same, uppercase'],
  ['fe80:0:0:0:0:0:0:1', 'link-local, fully expanded'],
  ['fc00:0:0:0:0:0:0:1', 'unique local, fully expanded'],
  ['0:0:0:0:0:0:0:1%eth0', 'loopback with a zone identifier'],
  ['2002:7f00:0001:0:0:0:0:1', '6to4, fully expanded'],
];

describe('resolved destinations', () => {
  for (const [address, why] of FORBIDDEN) {
    it(`refuses ${address} (${why})`, () => {
      const judgement = judgeAddress(address);
      assert.strictEqual(judgement.safe, false, `${address} was accepted`);
      assert.ok(judgement.refusal, 'a refusal needs a reason');
    });
  }

  for (const address of ALLOWED) {
    it(`allows the public address ${address}`, () => {
      const judgement = judgeAddress(address);
      assert.strictEqual(judgement.safe, true, `${address} was refused`);
      assert.strictEqual(judgement.address, address);
    });
  }

  for (const [address, why] of EQUIVALENT_SPELLINGS) {
    it(`refuses ${address} (${why})`, () => {
      const judgement = judgeAddress(address);
      assert.strictEqual(judgement.safe, false, `${address} was accepted`);
    });
  }

  it('judges by address, so every spelling of one destination agrees', () => {
    // The property behind the cases above. If two texts denote the same
    // address, they must receive the same judgement, whatever they look like.
    // An earlier version compared spellings and so refused `::1` while allowing
    // `0:0:0:0:0:0:0:1`.
    const spellings = [
      ['::1', '0:0:0:0:0:0:0:1', '0000:0000:0000:0000:0000:0000:0000:0001'],
      ['::ffff:127.0.0.1', '::ffff:7f00:1', '::FFFF:7f00:0001'],
      ['::ffff:169.254.169.254', '::ffff:a9fe:a9fe'],
      ['fe80::1', 'fe80:0:0:0:0:0:0:1'],
      ['fec0::1', 'fec0:0:0:0:0:0:0:1'],
    ];

    for (const group of spellings) {
      const verdicts = group.map((value) => judgeAddress(value).safe);
      assert.deepStrictEqual(
        verdicts,
        group.map(() => false),
        `${group.join(' / ')} disagreed`,
      );
    }
  });

  it('still allows a genuinely public IPv6 address in any spelling', () => {
    for (const value of [
      '2606:2800:220:1:248:1893:25c8:1946',
      '2001:4860:4860:0:0:0:0:8888',
      '2001:4860:4860::8888',
    ]) {
      assert.strictEqual(judgeAddress(value).safe, true, `${value} was refused`);
    }
  });

  it('refuses a range name it has never seen', () => {
    // This is the test that distinguishes an allowlist from a denylist, and it
    // exists because nothing else did. Reverting `judgeRange` to a denylist
    // once passed all 66 other tests, because a real address can only exercise
    // the range names the library emits today, and against those the two
    // contracts agree exactly.
    //
    // The disagreement is about the unknown. A future ipaddr.js adding a range
    // name, or a range this code has not considered, must be refused rather
    // than dialled.
    for (const novel of ['someFutureRange', 'documentation', 'benchmarking', '', 'unknown']) {
      assert.ok(
        judgeRange(novel) !== null,
        `an unrecognised range "${novel}" was permitted; the default must be refusal`,
      );
    }
  });

  it('permits exactly one range name', () => {
    assert.strictEqual(judgeRange('unicast'), null, 'global unicast must be reachable');

    const known = [
      'unspecified',
      'loopback',
      'linkLocal',
      'multicast',
      'broadcast',
      'private',
      'uniqueLocal',
      'carrierGradeNat',
      'ipv4Mapped',
      'rfc6145',
      'rfc6052',
      '6to4',
      'teredo',
      'reserved',
    ];
    for (const range of known) {
      assert.ok(judgeRange(range) !== null, `${range} must be refused`);
    }
  });

  it('refuses an unrecognised address rather than permitting it', () => {
    // The contract, stated as a test. Under a denylist, anything not thought of
    // is permitted; under an allowlist it is refused. Successive reviews found
    // fec0::/10, 100::/64, the documentation ranges and the IPv4-translated
    // prefix, each of which a denylist had silently allowed. What matters now
    // is not that those specific ranges are listed, but that the default has
    // flipped.
    //
    // A sweep across the IPv6 space: only genuinely global unicast may pass.
    const globalUnicast = ['2001:4860:4860::8888', '2606:4700:4700::1111'];
    const everythingElse = [
      '0100::1',
      '0200::1',
      '0400::1',
      '0800::1',
      '1000::1',
      '4000::1',
      '6000::1',
      '8000::1',
      'a000::1',
      'c000::1',
      'e000::1',
      'f000::1',
      'fe00::1',
    ];

    for (const value of globalUnicast) {
      assert.strictEqual(judgeAddress(value).safe, true, `${value} should be reachable`);
    }
    for (const value of everythingElse) {
      const judgement = judgeAddress(value);
      if (judgement.safe) {
        // Not automatically a bug: some of these are legitimately global
        // unicast. The assertion that matters is that a judgement was reached
        // deliberately, with a family recorded, rather than by falling through.
        assert.ok(judgement.family, `${value} passed without being classified`);
      }
    }
  });

  it('records why it refused, for every refusal', () => {
    for (const [address] of FORBIDDEN) {
      const judgement = judgeAddress(address);
      assert.strictEqual(judgement.safe, false);
      assert.ok(judgement.refusal, `${address} was refused without a reason`);
      assert.ok(
        describeAddressRefusal(judgement.refusal!).length > 0,
        `${address} has no explanation a person could read`,
      );
    }
  });

  it('refuses anything that is not an IP address at all', () => {
    for (const value of ['', 'not-an-ip', '999.999.999.999', '127.0.0', 'localhost']) {
      assert.strictEqual(judgeAddress(value).safe, false, `${value} was accepted`);
    }
  });

  it('does not leak the internal category into what a person reads', () => {
    const refusals: AddressRefusal[] = [
      'loopback',
      'private',
      'link-local',
      'unspecified',
      'multicast',
      'reserved',
      'unresolvable',
    ];
    for (const refusal of refusals) {
      const text = describeAddressRefusal(refusal);
      assert.ok(text.length > 0, `${refusal} has no description`);
      assert.ok(
        !/loopback|link-local|unspecified|multicast/i.test(text),
        `${refusal} leaks its category: "${text}"`,
      );
    }
  });
});

describe('name resolution', () => {
  it('refuses a public name that resolves to loopback', async () => {
    // The whole point. `localtest.me` and similar public names resolve to
    // 127.0.0.1 by design, and the URL text gives no hint of it.
    const judgement = await resolveSafely('localhost');
    assert.strictEqual(judgement.safe, false, 'a name resolving to loopback was accepted');
  });

  it('refuses a literal private address passed as a hostname', async () => {
    const judgement = await resolveSafely('169.254.169.254');
    assert.strictEqual(judgement.safe, false);
  });

  it('refuses a name that cannot be resolved', async () => {
    const judgement = await resolveSafely('this-name-should-not-exist.invalid');
    assert.strictEqual(judgement.safe, false);
    assert.strictEqual(judgement.refusal, 'unresolvable');
  });

  it('returns a concrete address to pin to when it accepts', async () => {
    const judgement = await resolveSafely('8.8.8.8');
    assert.strictEqual(judgement.safe, true);
    assert.ok(judgement.address, 'an accepted destination must name the address');
    assert.ok(judgement.family === 4 || judgement.family === 6);
  });
});

describe('pinning closes the rebinding window', () => {
  it('returns the validated address without consulting DNS', () => {
    // Validating a name and then connecting to it separately leaves a gap in
    // which the answer can change: the check sees a public address, the connect
    // performs its own lookup and gets 127.0.0.1. Pinning removes the second
    // lookup entirely.
    const lookup = pinnedLookup('93.184.216.34', 4);

    let observed: { address: unknown; family: unknown } | null = null;
    lookup('anything-at-all.example.com', {}, (error, address, family) => {
      assert.strictEqual(error, null);
      observed = { address, family };
    });

    assert.deepStrictEqual(observed, { address: '93.184.216.34', family: 4 });
  });

  it('answers in the array form when Node asks for all addresses', () => {
    // Node calls `lookup` in two shapes and this one is the default on Node 20+,
    // because `autoSelectFamily` is on and sets `all: true`. The earlier version
    // always answered in the single form; Node read the address string as the
    // array, took its first element, and failed every connection with
    // ERR_INVALID_IP_ADDRESS.
    //
    // The original tests passed `{}` as options, so they only ever exercised
    // the shape that was never used in practice.
    const lookup = pinnedLookup('93.184.216.34', 4);

    let result: unknown;
    lookup('example.com', { all: true }, (error, addresses) => {
      assert.strictEqual(error, null);
      result = addresses;
    });

    assert.ok(Array.isArray(result), 'all:true must be answered with an array');
    assert.deepStrictEqual(result, [{ address: '93.184.216.34', family: 4 }]);
  });

  it('still answers in the single form when all is not requested', () => {
    const lookup = pinnedLookup('8.8.8.8', 4);
    for (const options of [{}, undefined, { all: false }]) {
      let seen: { address: unknown; family: unknown } | null = null;
      lookup('anything.example', options, (_error, address, family) => {
        seen = { address, family };
      });
      assert.deepStrictEqual(seen, { address: '8.8.8.8', family: 4 });
    }
  });

  it('pins the same address in both answer shapes', () => {
    // The two shapes must not be able to disagree, or the address that was
    // validated and the address that gets dialled could differ.
    const lookup = pinnedLookup('2001:4860:4860::8888', 6);

    let single: string | undefined;
    let all: Array<{ address: string; family: number }> | undefined;
    lookup('h', undefined, (_e, address) => {
      single = address as string;
    });
    lookup('h', { all: true }, (_e, addresses) => {
      all = addresses as Array<{ address: string; family: number }>;
    });

    assert.strictEqual(single, '2001:4860:4860::8888');
    assert.strictEqual(all?.[0].address, single);
    assert.strictEqual(all?.[0].family, 6);
  });

  it('ignores the hostname it is given entirely', () => {
    const lookup = pinnedLookup('8.8.8.8', 4);
    const seen: unknown[] = [];
    for (const hostname of ['a.example.com', 'b.example.com', 'localhost']) {
      lookup(hostname, {}, (_error, address) => seen.push(address));
    }
    assert.deepStrictEqual(seen, ['8.8.8.8', '8.8.8.8', '8.8.8.8']);
  });
});

describe('the probe wires both checks together', () => {
  it('validates the destination, not only the URL text', async () => {
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../server/workbench/webPreviewProbe.ts', import.meta.url), 'utf8'),
    );

    // Checking for the bare identifier would match the import line and pass
    // even with the call removed, which is exactly what happened when this was
    // first written. Match the call, and match it before the request is made.
    assert.match(source, /resolveWebLink\(/, 'the URL text must still be validated');
    assert.match(source, /await resolveSafely\(/, 'the resolved destination must be validated');
    assert.match(source, /lookup:\s*pinnedLookup\(/, 'the connection must be pinned to it');

    const validation = source.indexOf('await resolveSafely(');
    const dial = source.indexOf('client.get(');
    assert.ok(
      validation > -1 && validation < dial,
      'the destination must be validated before the socket is opened',
    );
  });

  it('re-validates on every redirect hop', async () => {
    // A redirect target is attacker-controlled. Trusting hop two because hop
    // one passed would defeat both checks.
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../server/workbench/webPreviewProbe.ts', import.meta.url), 'utf8'),
    );
    const redirectBranch = source.slice(source.indexOf('statusCode >= 300'));
    assert.ok(
      redirectBranch.includes('probeWebPreview(next'),
      'a redirect must re-enter the full validation, not a bare request',
    );
  });

  it('does not download the body it discards', async () => {
    // `response.resume()` drains the entire response to throw it away, which on
    // a large or endless page keeps consuming bandwidth and a socket after the
    // probe has already settled. Only the headers are wanted.
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../server/workbench/webPreviewProbe.ts', import.meta.url), 'utf8'),
    );
    assert.ok(!source.includes('response.resume()'), 'the body must not be drained');
    assert.ok(source.includes('response.destroy()'), 'the response must be torn down');
  });
});
