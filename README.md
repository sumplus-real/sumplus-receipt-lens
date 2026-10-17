# Sumplus Receipt Lens

When an AI provider's billing dashboard disappears, its users lose their only view of the provider's usage declarations. Receipt Lens reads those statements directly from **Arkiv**, checks the on-chain creator and publisher signature, and exposes impersonation, gaps and duplicates. The publisher hands the records to a separate synthetic recipient wallet using Arkiv native ownership transfer, so the provider no longer controls their editing or deletion.

**Synthetic prototype only.** Authorship and consistency are checked; actual AI calls and payments are not proved. Testnet only; no real personal data.

Live app: https://sumplus-real.github.io/sumplus-receipt-lens/

## Run

Node 20.19+ and npm. Exact dependency versions are locked.

```
npm ci
npm test
npm run dev -- --port 19161
npm run build
```

Open the URL printed by Vite. `dist/` is a standalone static site and can be served over HTTPS. The read-only browser connects directly to Tiramisu 7738577, with **no Sumplus backend, database, account or wallet connection**. SDK `@arkiv-network/sdk` is pinned to **0.8.1**. The expected creator is pinned in `src/config.mjs`; it is a synthetic test issuer, not an authenticated business identity.

## Reproduce

Use **Complete session**, **Demo recipient wallet**, **Audit all creators**, **All amounts**, **18 October 2026**, and **Inspect pagination · 2 records/page**, then **Query Arkiv**. The intended seeded session has three signed receipt declarations totaling `0.060000 USDC` and one signed close statement. Check the exact predicate under Connection & query details. In this explicit pagination mode, each page has at most two entities, so the complete session requires multiple real Arkiv query pages. The normal default is20 records/page to reduce requests.

Use **Disputed session** to examine a missing sequence, a duplicate, a signed payload altered after signing and a different creator impersonating the same session/provider. The app excludes bad sources/data and withholds Complete coverage. Switch to Expected creator only to run `createdBy()` on chain. This view does not claim to enumerate attacks. Amount filtering uses a numeric attribute and explicitly disables completeness assessment.

**Verified on Tiramisu:** `public/creation-evidence.json` lists ten successful creation transactions; `public/acceptance-evidence.json` records 14 real-network checks and exact queries. The clean and disputed outcomes above were read back on the actual chain. A separate short-expiry probe confirmed before/after behavior. Empty or unavailable testnet results are always shown honestly. Query pagination explicitly pins the block before page one; see the observed cursor issue and verified workaround in the friction report.

```
npm run probe
node scripts/seed.mjs
```

Writer instructions are in [arkiv/writer.md](arkiv/writer.md). Never use the example command with mainnet or a personal wallet. Each dedicated test key is held outside the repository, never published or bundled in the client. Public creation evidence will contain only addresses, entity keys and transaction hashes.

## What Arkiv changes

The provider's API can be withdrawn or rewritten by the party whose bill is in dispute. Here the publisher transfers the records to the recipient, who controls edits, deletion and Lifetime Extension. An independent user can query by owner, session and typed amount/period, with the immutable creator exposed. An impersonator can transfer a fake statement to the same recipient: ownership alone never authenticates the issuer. IPFS content addressing alone does not offer this query contract; a subgraph needs an underlying publication/indexing design; a provider-controlled database leaves the original read dependency. Arkiv supplies queryable, time-scoped entities whose creator can be checked independently of our backend.

We keep signing keys and local evidence exports off Arkiv. The static frontend and public RPC are still dependencies; this is not a promise of permanent storage, full-node verification or censorship-proof networking. The recipient can delete records earlier than Entity Expiration or transfer ownership again. Keep your own evidence copy; a query is a snapshot, not guaranteed retention. An on-chain creator can lie about usage, and a valid signature is not payment proof.

## Data and reproduction contract

- [Entity schema, exact query and trust model](arkiv/schema.md)
- [Observed integration feedback](arkiv/friction.md)
- [Local positive/negative tests](tests/receipt.test.mjs)
- [Signature and consistency checks](src/receipt.mjs)
- [Arkiv query, cursor walk and error behavior](src/arkiv.mjs)

## Original work and license

Built in a new independent directory during the 9–18 October 2026 event. No pre-existing Sumplus business code, payment protocol or prior event demo was copied. Sumplus brand and the billing-dispute problem predate the event. Pre-existing code baseline: **None**. Third-party dependencies: official Arkiv SDK, Viem and Vite (see package-lock.json and their licenses). AI coding assistant: OpenAI Codex. Tracks: **Security** and **Censorship Resistance**.

MIT license. This project issues no token, accepts no payment and uploads no real usage records.

## Local validator lab

`lab.html` generates disposable keys in browser memory and runs six real signature/consistency cases using the same verifier. It is prominently labelled **LOCAL ONLY**, performs no Arkiv requests, and is never a fallback for a failed live query. It is useful for browser crypto compatibility and adversarial checks; it is not on-chain evidence. Select a different synthetic billing day in the live reader to exercise numeric period filtering.

CLI diagnostics are written to the ignored `evidence/` directory by default; set `RECEIPT_LENS_EVIDENCE_DIR` to choose another writable output directory. The public demo uses the published synthetic creator pins. To publish your own independent dataset, generate fresh keys and explicitly update all role pins in src/config.mjs and archive inherited creation evidence as described in arkiv/writer.md; do not impersonate the demo issuer.

### RPC quota is a real dependency
The official anonymous RPC has a limited query-cost budget. During the sprint it returned HTTP429 `ANON_COST_LIMITED`, with remaining0 and Retry-After2103 seconds. The reader now displays the rate limit and server retry advice, clears all results and disables export. It never embeds an access key or silently substitutes fixture data. The default page size is20; select2 to reproduce the pagination probe. Unbounded numeric no-op predicates are omitted while meaningful amount/day ranges remain supported. See friction report for the observed headers and measurement limits.

## Native recipient custody

`node scripts/ownership-probe.mjs` uses only dedicated synthetic Tiramisu wallets. It funds the recipient with a small internal test-token transfer, creates a disposable probe, transfers it, proves old-publisher patch/delete requests fail with NotOwner without broadcasting, and proves recipient patch succeeds. Then two successful batches transfer all ten main entities, including the impersonator's entity, to the recipient. `public/ownership-evidence.json` records those transaction hashes and controls. A separate post-reset read remains required to verify main owners and unchanged creator/signature behavior; see the readbackPending flag.

This is recipient custody, not immutable storage. The recipient can edit/delete/extend, but cannot forge the publisher signature. The read-only app never asks a viewer to connect a wallet or sign anything; the recipient is a synthetic demonstration role, not the viewer's personal address. Tiramisu currently rejects EVM contract creation; the implementation uses supported native Arkiv operations, with no deployed custody contract.
