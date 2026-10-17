# Disposable synthetic publisher

1. `npm ci`. `node scripts/wallet-init.mjs` creates **new dedicated Tiramisu-only** accounts under `~/.config/sumplus/arkiv-receipt-lens/` (directory 700, file 600), outside this repository. Output includes public addresses only. Never copy keys into the browser app, Git or Arkiv payloads.
2. Use the official Hub faucet with a wallet you control, then send **free Tiramisu test GLM only** to those public addresses. A browser-wallet import or transfer may require your own action. No mainnet funds or bridging are needed.
3. Ensure addresses match `src/config.mjs`. The seeder refuses a wrong chain or a key/config mismatch. `node scripts/seed.mjs` checks balances and prints BLOCKED for an unfunded role. It does not use a shared public example key or the user's real wallet.
4. Seeder writes synthetic signed envelopes and typed attributes on Tiramisu. It records a successful create result immediately in `public/creation-evidence.json` and skips that ID on resume, avoiding routine duplicate seeds. A crash after mining but before saving can still require manual transaction reconciliation; do not blindly rerun after uncertain network errors.
5. Rebuild after adding evidence. Public creator addresses are safe to publish. No private keys or credential-bearing RPC URLs are part of the build.

After creating the ten main records, run `node scripts/ownership-probe.mjs` with the same dedicated wallets. It uses a third synthetic recipient, records each completed step, and refuses to continue an uncertain pending write until manually reconciled. Do not rerun or regenerate keys blindly. The negative-control transport blocks broadcasting. No personal payout wallet is used. Run the bounded post-reset reader to verify actual owners before declaring release complete.

Receipt entities initially have 30-day Entity Expiration; close statements 90 days. The current owner can modify/delete sooner or request Lifetime Extension. No production spending, real data, settlement or mainnet effects.

For a new independent fork/dataset, generate fresh dedicated keys, update all public address pins, and archive the inherited public/creation-evidence.json before seeding. The seeder refuses mismatched inherited creator evidence rather than silently skipping a new publisher. Do not erase the official demo evidence while reproducing its public reads. Ownership/gas diagnostics expect the published demo roles and need their dedicated keys; judges need no keys to read or verify signatures.
