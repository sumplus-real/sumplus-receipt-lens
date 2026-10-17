# Building Receipt Lens on Arkiv

This is a running report of observed behavior, including successful paths. Claims below distinguish local validation from actual testnet writes. Started **2026-10-18 02:28 Asia/Shanghai**. SDK **0.8.1**, Viem **2.57.7**, Node **20.19.6**, Vite **6.4.4**, macOS. Tiramisu chain **7738577**, public RPC `https://rpc.tiramisu.db-chain.testnet.arkiv.network`.

## 1. Public reads: successful CLI path

**Expected:** official SDK can read chain identity and run a typed query without a Sumplus API or access key. **Actual:** `npm run probe` returned chain 7738577, block 705998, zero entities for our new namespace in 1389 ms. This verifies transport and an empty query response, not a funded writer or useful populated app. Evidence: `evidence/probe-read.json` in the delivery evidence package.

**Reproduce:** `npm ci && npm run probe`. It calls `getChainId()` and a select on `app=sumplus-receipt-lens-v1` with limit 2. Later populated results naturally differ. It fails if the chain is wrong. No secret-bearing endpoint is needed. **Suggestion:** the official minimal read example and chain constants worked as expected.

## 2. Isolated writer onboarding: faucet requires a browser wallet

**Expected:** obtain free test GLM for two freshly generated disposable CLI wallets, without importing personal accounts or using mainnet funds. **Actual:** the official Hub faucet at the initial visit displayed **CONNECT YOUR WALLET** and only browser-wallet/WalletConnect options. The CLI-generated accounts were not installed in that browser. This is an onboarding dependency, **not a claimed faucet malfunction**. No CAPTCHA or new terms were accepted. No wallet private key was pasted into a website or source code.

**Reproduce:** generate a fresh account using `node scripts/wallet-init.mjs`, visit `https://hub.arkiv.network/faucet` without a connected wallet. **Suggestion:** document a supported CLI/SIWE test-funding route, or clearly document sending faucet funds from a connected wallet to a separate CLI account. At initial report time, free test funding was pending human wallet action. The user subsequently funded the fresh publisher with 5 test GLM and adversary with 1 test GLM. All actual writes used only these isolated accounts. The official SDK README's explicitly designated shared quick-test account was also checked read-only and had zero balance. We did not write or fund from that account.

## 3. Typed amounts and strict signatures: local validation

**Expected:** exact micro-USDC arithmetic, with a string pretending to be u64 rejected. A valid creator alone must not approve payload mutated after signing. **Actual:** `npm test` passes positive signed cases and known-bad forged creator, owner confusion, tampered payload, attribute type/value mismatch, domain mismatch and invalid integer tests. **Scope:** generated in-memory signed entities; initially not evidence of on-chain typed round-trip; subsequent live probe is recorded in section6.

**Reproduce:** `npm test` (tests/receipt.test.mjs). `money('9007199254740993')` remains exact. `amount_micro` with type str is rejected by the reader even when its text is numeric. **What worked:** the explicit SDK tagged types make schema intent visible. **Suggestion:** keep tagged types prominent in docs because bare JS strings are inappropriate for amount-range predicates.

## 4. Cursor safety: contract plus local failure injection

**Expected:** all pages share one block and a complete walk never silently returns partial results. **Actual:** installed SDK QueryResult docs specify cursor-bound snapshot blocks. Local tests confirm the reader rejects duplicate keys, repeated cursors, changed blocks, entity limits and a page-2 RPC error. **Scope:** live multi-page query was pending at this initial test stage; subsequently verified in sections5–6; these tests verify our guard, not server behavior. **Reproduce:** `npm test`, named pagination cases. **Suggestion:** document cursor-expiry recovery and retention windows near the first pagination example.

## 5. Moving-head cursor rejection: observed, reproduced, corrected

**Expected:** the documented SDK `first.next()` walk continues at a cursor-bound snapshot without the application pinning a block. **Actual on SDK 0.8.1 / public Tiramisu:** the clean session happened to complete in two pages. The disputed session failed on a subsequent page with QueryError kind `cursor`, code `-32005`, data message `cursor belongs to a different query, block or select — start a new page-through`. No partial result was returned as a full bill.

**Reproduce:** after seeding, run `node scripts/cursor-probe.mjs`. It fetches page one of the six-entity disputed session with limit 2, waits 2.5 seconds so the chain head changes, then calls next(). The unpinned path and error are recorded. The same probe then explicitly calls `atBlock(await client.getBlockNumber())` before the first fetch, waits 2.5 seconds between pages, and asserts all six keys across three pages at the original block. See `evidence/cursor-live-regression.json` in the delivery package. The SDK's installed fetchPage closure reuses the initial request; when its atBlock is undefined it does not promote the first response.blockNumber into subsequent requests. This is an observed SDK/node interaction, not a claim about every deployment.

**Correction in our app:** `src/arkiv.mjs` pins atBlock before page one. No dependency source was patched, no cursor retry is hidden, and incomplete results still fail. The local HTTP wire regression test checks explicit atBlock on both requests. **Suggested upstream fix:** have SDK fetchPage carry the response snapshot into the cursor closure, or explicitly require atBlock in the pagination tutorial and document the current behavior. The workaround is verified on the real network, not just mocks.

## 6. Actual populated writes, types and creator filtering: passed

**Expected:** publish controlled synthetic signed statements from two different test wallets; exact numeric range queries and creator separation must work. **Actual:** ten createEntity transactions mined successfully, each receipt.from agrees with getEntity.creator. First successful entity appeared 812 seconds (13m32s) after the sprint's 02:28:08 start. CLI `node scripts/verify-live.mjs` passed 14 checks: four clean entities/two pages, six disputed entities/three pages, correct u64 round-trip for sequence/amount_micro/period, a numeric amount range returning only 20000 and 30000, an Oct18 positive day-range versus a known-empty Oct19 range, a numeric sequence range, and createdBy filtering. The attacker can sign its own payload correctly but cannot become the expected creator; a publisher-created payload altered after signing fails signature matching. A duplicate sequence and missing sequence2 keep the disputed bill incomplete. These are synthetic declarations, never actual AI usage or payment.

**Reproduce:** follow README seeded read steps or run `node scripts/verify-live.mjs`. `public/creation-evidence.json` contains successful creation hashes and entity keys; `public/acceptance-evidence.json` records every query and verdict. **What worked:** explicit typed u64 attributes, immutable creator selection and signed payload validation round-tripped as intended. No API key or Sumplus backend was needed.

## 7. Entity Expiration: before/after and surviving transaction, passed

**Expected:** a separate short-lived probe entity disappears from current query results at its expiry block, while its successful creation transaction remains inspectable. **Actual:** 30-second probe was found at block706439 before expiry706453, absent at block706460 afterward. Creation transaction remained success at block706438. Hash `0xb7ced167189c8f687c52588c17d84609adc4a587de98c41bd55cc09882a2a439`. The local reporter initially hit JSON BigInt serialization after successfully saving the first observation; the output serializer was corrected without sending another transaction. This was our script bug, not an Arkiv failure.

**Reproduce:** `node scripts/expiry-probe.mjs` creates only once, saves the entity key immediately, and on subsequent runs queries that same probe and its creation receipt. Run after its expiry block for the negative observation. See delivery evidence `evidence/expiry-probe.json`. The primary usage entities initially expire after30 days and summaries90 days, beyond judging; the current owner can remove them earlier. We do not claim expired payload recovery.

## 8. Browser path and explicit failure: passed in local build

**Expected:** browser JavaScript can query the public RPC without a provider backend or wallet; failures cannot masquerade as an empty or cached bill. **Actual:** the actual browser queried Tiramisu and rendered four signed clean entities, 0.060000 statement subtotal, and complete coverage. Six in-memory browser-crypto cases also passed in a separately labelled LOCAL ONLY lab. Replacing the public RPC field with a dead local endpoint produced QUERY FAILED, cleared results and disabled export. No sample fallback occurred. Browser CORS succeeded. These checks establish the local browser path; public deployment accessibility requires its separate release readback.

**Reproduce:** open the app and use the connection field. `lab.html` is independent of the Arkiv integration and never substitutes for it. Evidence screenshots and DOM captures are included with the release package.


## 9. Anonymous cost quota: actual release risk, explicit failure and mitigation

**Expected:** repeated anonymous testnet reads eventually encounter an advertised quota; no app may represent quota failure as a zero bill. **Actual at2026-10-18 02:54 Asia/Shanghai:** both the public-origin app and CLI received HTTP429, body `ANON_COST_LIMITED`. A single minimal key-only query was also rejected. Measured response headers were `RateLimit: limit=10000, remaining=0, reset=2103` and `Retry-After:2103` seconds. This establishes the tested anonymous query budget was exhausted, not which individual request spent it or that every user's quota is exhausted. The record is in the delivery evidence `rpc-budget-headers.txt` and `rpc-budget-body.json`.

**Local correction:** `src/errors.mjs` now distinguishes HTTP429 and includes server Retry-After when available. `readSession()` captures exposed RateLimit/Arkiv-Cost/Retry-After headers. A local HTTP429 wire test asserts one failed query, no auto-retry, no fixture result, and propagation of2103-second advice. Clear-on-input-change also prevents old session results appearing under new filter labels.

**Request mitigation, with preserved functionality:** normal page size20 reduces the number of page requests for small bills; users can explicitly select2 for pagination inspection. Queries omit unbounded no-op numeric ranges, while actual chosen billing-day and amount bounds remain typed numeric predicates. These changes reduce request count; we do not claim a measured cost-unit reduction until fresh successful response headers are available. Current real acceptance evidence was recorded before this quota event; recheck after the server-advised reset before marking release healthy again.

**Official docs:** [Access Keys](https://docs.arkiv.network/start-here/access-keys/) explain a free-key onboarding path via wallet sign-in and CAPTCHA, monthly cost quotas, and keeping keys out of browser code. Origin restrictions are attribution, not secret protection. We did not embed a key, introduce a Sumplus proxy, invent higher limits, spend money or evade the anonymous limit. The independent reader deliberately retains its public-RPC dependency. **Suggested first improvement:** expose remaining/reset cost metadata prominently and document anonymous budget behavior and query-cost accounting next to the first query example.

## 10. Provider control versus recipient ownership: native operations

**Problem:** merely putting provider-owned declarations on Arkiv leaves that provider able to modify or delete its entities. Time-scoped expiry is not immutability. **Experiment:** an empty custody-contract gas estimate was rejected with `contract creation is disabled (no-EVM Arkiv executor)`. It was not broadcast and consumed no transaction gas. This is a Tiramisu capability boundary observed in this test, not a general statement about EVM chains. No contract/compiler is part of the app.

**Implemented path:** use native Arkiv `changeOwnership` and `executeBatch({ownershipChanges})` to hand records to a separate synthetic recipient. On a disposable probe, the former publisher's patch and delete each returned NotOwner during estimation. A transport guard prohibited broadcasting the negative controls. A recipient patch transaction succeeded. Two further successful transactions handed the nine publisher records and one adversary record to the same recipient. This demonstrates recipient control and why owner equality cannot replace immutable creator + signature checks. See public/ownership-evidence.json and scripts/ownership-probe.mjs.

**Limits:** the recipient can delete, modify or transfer records, and can request Lifetime Extension. We do not call this an immutable vault or guaranteed retention. The live UI only reads and exports; it does not connect or import a user wallet. The dedicated synthetic recipient key is outside the repository. **Suggestion:** make native account custody and the current no-EVM executor boundary visible in the onboarding examples.
