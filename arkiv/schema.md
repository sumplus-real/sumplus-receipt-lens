# Receipt Lens data contract v1

All data is synthetic. Tiramisu chain **7738577**. SDK **0.8.1**. No real personal data, identifiers, their hashes, private keys or RPC secrets may be published.

## Who can rely on what?

The demo expects publisher `0xCc115e9cC6a7053C6F4999eDd02076C08d17F958`. This is a dedicated test wallet pinned in the open-source client, **not a verified commercial identity**. An integration must distribute and authenticate its own issuer pin. A provider name or session ID is not authority. `$creator` is the immutable creation account; `$owner` may change. Creator equality and the EIP-191 signature over the canonical statement must both pass. An owner changing the payload without the publisher's signing key fails the check. A malicious original publisher can still issue false or conflicting statements. Key rotation, revocation and real provider enrollment are out of scope.

The app trusts the configured public RPC for chain metadata and query completeness. It does not verify Merkle inclusion proofs, run a full node or guarantee RPC censorship resistance. It removes the **service operator's backend** from the read path. MIT code and a static build support independent hosting.

## Entity types

`receipt`: one provider usage declaration, with **30-day Entity Expiration** from creation. This covers a prototype invoice-review window. `session-close`: signed expected receipt count and total, with **90-day Entity Expiration** to preserve a dispute reference longer than detailed usage. These are deliberately chosen prototype windows, not a regulatory retention claim. No Lifetime Extension is used or claimed. After detail expiration, the summary cannot reconstruct the payload. Creation transaction hashes and the demo remain available for judges. Users can export a local snapshot before expiry; it is not Arkiv permanent storage.

Both use JSON payloads and these typed attributes:

| Attribute | Type | Purpose |
|---|---|---|
| app | str | `sumplus-receipt-lens-v1`, namespace |
| kind | str | `receipt` or `session-close` |
| session | str | Random/synthetic consumption session; no real identifier |
| provider | str | `synthetic-ai-provider`; display/filter only |
| sequence | u64 | Receipt order starting at 1; close statement 0 |
| amount_micro | u64 | Exact integer micro-USDC statement amount; close statement 0 |
| period | u64 | Unix second for synthetic billing period, numeric range query |

Amount uses integer micro-units because floating-point USDC would change bills. `0.060000` is exactly `60000` micro-USDC. SDK tagged u64 values round-trip as bigint. Display, sums and comparisons use BigInt. No floats participate in amounts. Attribute values must match signed payload values and types.

## Signed payload

Envelope has exactly `statement` and `signature` fields. See `src/receipt.mjs:canonical` for the authoritative canonical field order and validation. The message is the literal prefix `Sumplus Receipt Lens | synthetic statement | v1\n` followed by JSON of these fields in order:

```
schema,chain,app,kind,session,provider,sequence,amountMicro,period,
expectedCount,totalMicro,usageUnits,settlementRef,synthetic
```

`schema=receipt-lens/1`, `chain=7738577`, `synthetic=true`. Integers in the payload are canonical unsigned base-10 strings with no leading zeros. Only the controlled synthetic provider/session/reference formats are accepted. `settlementRef=synthetic:unverified-N` is **not a payment transaction**. A close statement declares expectedCount and totalMicro. Each usage statement repeats these values to expose disagreement. A trusted signature proves that key signed the statement, **not that usage happened or payment settled**.

## Queries the app actually runs

```js
const client = createPublicClient({ chain: tiramisu, transport: http(PUBLIC_RPC) });
const q = client.select({
  key: true, creator: true, owner: true, attributes: true, payload: true,
  createdAt: true, updatedAt: true, expiresAt: true, contentType: true,
}).where(
  eq('app', 'sumplus-receipt-lens-v1'),
  eq('session', 'synthetic-clean-20261018'),
  gte('period', u64(1792252800n)),
  lte('period', u64(1792339199n)),
).limit(2).atBlock(await client.getBlockNumber());
// An explicit amount filter adds gte('amount_micro', u64(20000n));
// the amount-filtered result is never labelled a complete session.
// Trusted scope uses the immutable creator, never provider text or owner:
q.createdBy('0xCc115e9cC6a7053C6F4999eDd02076C08d17F958');
let page = await q.fetch();
while (page.hasNextPage()) page = await page.next();
```

Audit scope omits createdBy so users can see impersonating entities. Every returned entity is validated locally before contributing to the trusted subtotal. The billing-day selector maps UTC+8 day boundaries to an inclusive numeric Unix-second range; selecting the next day produces an empty result rather than mixing billing periods. An amount-filtered view explicitly does not establish full session coverage. The normal reader uses20 records/page; choosing the pagination inspection mode uses2. Unbounded no-op amount/period predicates are omitted to avoid unnecessary query work. The app renders the exact predicate with `toString()` for reproduction. CLI evidence records it too.

SDK 0.8.1 must receive an explicit atBlock before the first page on the tested node; otherwise next() may fail when the latest head advances (see friction report). Arkiv supplies **no server-side ordering**. We walk all pages at one cursor-bound block, reject repeated keys/cursors or block changes, and then sort by sequence locally. At most 100 pages/1000 entities per walk; hitting a cap fails rather than declaring partial data complete. A page-2 RPC failure discards the incomplete result. An expired cursor is an error requiring a fresh query, not a silent fallback.

## Consistency and negative cases

A clean session needs exactly one trusted close statement, all sequences 1..expectedCount, no duplicates, matching count/total declarations, and matching summed amount. Duplicate sequences are ambiguous even when equal, withhold complete-bill status and are counted once in the explicitly labelled **unique subtotal**. Missing tail receipts are detected by the signed close count. Unknown-creator and invalid-signature entities are visible but excluded. Trusted-only query scope does not establish that no adversary exists; audit scope exposes that difference.

No result is loaded from fixture JSON. A failed live query clears the old result, disables export and says QUERY FAILED. An empty successful network response says no complete session is established. A completed query is labelled a timestamped snapshot, not continuous live monitoring.
