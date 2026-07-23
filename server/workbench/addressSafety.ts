// server/workbench/addressSafety.ts
//
// Deciding whether an address is safe for the server to dial on a user's behalf.
//
// Refusing literal private addresses is not enough. `resolveWebLink` rejects
// `http://127.0.0.1/` and `http://192.168.1.1/`, but it operates on the text of
// a URL, and the text is not what gets connected to. A perfectly public-looking
// hostname can resolve to loopback, to a private range, or to a cloud metadata
// endpoint. The name is public; the destination is not.
//
// So there are two checks, and both are required:
//
//   1. the URL text, handled by `resolveWebLink`;
//   2. every IP address that name resolves to, handled here.
//
// The second check is also why `safeLookup` exists rather than a bare
// `dns.lookup` followed by a connect. Validating a name and then connecting to
// it separately leaves a window in which the answer can change: the first
// lookup returns a public address, the check passes, and the connect performs a
// second lookup that returns 127.0.0.1. That is DNS rebinding, and the fix is
// to resolve once and connect to the address that was actually validated.

import dns from 'dns';
import net from 'net';
import ipaddr from 'ipaddr.js';

export type AddressRefusal =
  | 'loopback'
  | 'private'
  | 'link-local'
  | 'unspecified'
  | 'multicast'
  | 'reserved'
  | 'unresolvable';

export interface AddressJudgement {
  safe: boolean;
  refusal?: AddressRefusal;
  /** The validated address, when safe. */
  address?: string;
  family?: 4 | 6;
}

/**
 * Ranges this version of ipaddr.js classifies as `unicast` but which must never
 * be dialled anyway.
 *
 * The library carries the bulk of the work and is far better tested than
 * anything hand-rolled here, but it is not exhaustive, and the gaps were found
 * by checking rather than assumed absent. Each entry below was confirmed to
 * return `unicast` from ipaddr.js 1.9.1.
 *
 * This list is a supplement to an allowlist, not a denylist standing on its
 * own. That distinction is the whole point of the rewrite: a missing entry here
 * costs one range that the library already had to misclassify first, whereas a
 * missing entry in a pure denylist costs a live request-forgery route.
 */
const SUPPLEMENTARY_REFUSALS: Array<{ cidr: string; refusal: AddressRefusal; why: string }> = [
  { cidr: '198.18.0.0/15', refusal: 'reserved', why: 'benchmarking' },
  { cidr: 'fec0::/10', refusal: 'private', why: 'deprecated site-local, may still route internally' },
  { cidr: '100::/64', refusal: 'reserved', why: 'discard-only' },
  { cidr: '3fff::/20', refusal: 'reserved', why: 'documentation' },
  { cidr: '5f00::/16', refusal: 'reserved', why: 'segment routing' },
];

/** How ipaddr.js range names map to a refusal a person can be told about. */
const RANGE_REFUSALS: Record<string, AddressRefusal> = {
  unspecified: 'unspecified',
  loopback: 'loopback',
  linkLocal: 'link-local',
  multicast: 'multicast',
  broadcast: 'reserved',
  private: 'private',
  uniqueLocal: 'private',
  carrierGradeNat: 'private',
  ipv4Mapped: 'reserved',
  rfc6145: 'reserved',
  rfc6052: 'reserved',
  '6to4': 'reserved',
  teredo: 'reserved',
  reserved: 'reserved',
};

/**
 * Judge a range name, returning a refusal or `null` to permit.
 *
 * Separated out and exported so the *default* can be tested rather than only
 * the ranges that happen to exist today. With a real address you can only
 * exercise the range names the library currently emits, and against those a
 * denylist and an allowlist behave identically — which is why reverting this
 * function to a denylist once passed the entire suite unchanged.
 *
 * The question that distinguishes them is what happens to a name neither
 * contract has seen. Here, it is refused.
 */
export function judgeRange(range: string): AddressRefusal | null {
  if (range === 'unicast') return null;
  return RANGE_REFUSALS[range] ?? 'reserved';
}

/**
 * Whether a resolved IP address may be dialled.
 *
 * An allowlist, not a denylist, and the difference is the correction that
 * produced this version. Enumerating forbidden ranges by hand means every range
 * not thought of is permitted by default, and IPv6 supplies an enormous number
 * of ranges to not think of: site-local, discard-only, documentation, several
 * distinct translation prefixes, each with multiple spellings. Successive
 * reviews kept finding more, which is the signature of a contract that is wrong
 * rather than merely incomplete.
 *
 * So the question is inverted. An address is dialled only if a well-tested
 * address library classifies it as globally routable unicast, with a small
 * supplement for ranges that library does not yet classify. Anything
 * unrecognised is refused rather than allowed.
 */
export function judgeAddress(address: string): AddressJudgement {
  const family = net.isIP(address);
  if (family !== 4 && family !== 6) return { safe: false, refusal: 'unresolvable' };

  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsed = ipaddr.parse(address);
  } catch {
    return { safe: false, refusal: 'unresolvable' };
  }

  const verdict = judgeRange(parsed.range());
  if (verdict) return { safe: false, refusal: verdict };

  for (const { cidr, refusal } of SUPPLEMENTARY_REFUSALS) {
    try {
      const [network, bits] = ipaddr.parseCIDR(cidr);
      // Comparing across families throws, so the kinds are checked first. The
      // cast is needed only because the overloads are declared per-family and
      // the kind check has already established they agree.
      if (network.kind() !== parsed.kind()) continue;
      if ((parsed as ipaddr.IPv4).match(network as ipaddr.IPv4, bits)) {
        return { safe: false, refusal };
      }
    } catch {
      // A malformed entry in the supplement must not open the gate. Refusing on
      // a broken rule is the safe direction.
      return { safe: false, refusal: 'reserved' };
    }
  }

  return { safe: true, address, family: family as 4 | 6 };
}

/** Plain language for a refused destination. Never names the internal category. */
export function describeAddressRefusal(refusal: AddressRefusal): string {
  switch (refusal) {
    case 'unresolvable':
      return 'the address could not be found';
    case 'loopback':
    case 'private':
    case 'link-local':
    case 'unspecified':
      return 'the address resolves to a private network location';
    case 'multicast':
    case 'reserved':
      return 'the address resolves to a reserved network location';
  }
}

/**
 * Resolve a hostname and refuse it if any answer is a private destination.
 *
 * Every answer is checked, not just the first. A name that returns one public
 * and one private address is refused outright, because which one gets used is
 * not something this code controls.
 */
export async function resolveSafely(hostname: string): Promise<AddressJudgement> {
  // A literal IP needs no lookup, but still needs judging.
  if (net.isIP(hostname)) return judgeAddress(hostname);

  let answers: dns.LookupAddress[];
  try {
    answers = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  } catch {
    return { safe: false, refusal: 'unresolvable' };
  }

  if (answers.length === 0) return { safe: false, refusal: 'unresolvable' };

  for (const answer of answers) {
    const judgement = judgeAddress(answer.address);
    if (!judgement.safe) return judgement;
  }

  const first = answers[0];
  return { safe: true, address: first.address, family: net.isIP(first.address) === 6 ? 6 : 4 };
}

/**
 * A `lookup` implementation for http/https that only ever returns an address
 * already validated.
 *
 * Passing this to `http.get` closes the rebinding window: Node does not perform
 * its own resolution, so there is no second answer to differ from the first.
 * Host and SNI still derive from the hostname, so virtual hosting and
 * certificate validation continue to work normally.
 */
export function pinnedLookup(
  address: string,
  family: 4 | 6,
): (
  hostname: string,
  options: { all?: boolean } | undefined,
  callback: (
    err: NodeJS.ErrnoException | null,
    addr: string | Array<{ address: string; family: number }>,
    fam?: number,
  ) => void,
) => void {
  return (_hostname, options, callback) => {
    // Node calls `lookup` in one of two shapes, and answering in the wrong one
    // fails the connection outright.
    //
    // With `all: true` it expects an array of `{ address, family }`; otherwise
    // it expects `(err, address, family)`. Since Node 20, `autoSelectFamily`
    // defaults to true, which sets `all: true` — so on Node 22 the array form
    // is the normal path, not the exotic one.
    //
    // An earlier version always answered in the single form. Node read the
    // address string as though it were the array, took its first element, and
    // rejected it with ERR_INVALID_IP_ADDRESS. Every probe failed, and because
    // that code was not translated it surfaced as a bare "did not respond" —
    // so a site that refuses framing and a site that answers normally produced
    // exactly the same wrong answer.
    if (options?.all) {
      callback(null, [{ address, family }]);
      return;
    }
    callback(null, address, family);
  };
}
