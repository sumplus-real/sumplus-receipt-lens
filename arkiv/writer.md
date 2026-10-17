# Disposable synthetic publisher

1. `npm ci`. `node scripts/wallet-init.mjs` creates **new dedicated Tiramisu-only** accounts under `~/.config/sumplus/arkiv-receipt-lens/` (directory 700, file 600), outside this repository. Output includes public addresses only. Never copy keys into the browser app, Git or Arkiv payloads.
2. Use the official Hub faucet with a wallet you control, then send **free Tiramisu test GLM only** to those public addresses. A browser-wallet import or transfer may require your own action. No mainnet funds or bridging are needed.
3. Ensure addresses match `src/config.mjs`. The seeder refuses a wrong chain or a key/config mismatch. `node scripts/seed.mjs` checks balances and prints BLOCKED for an unfunded role. It does not use a shared public example key or the user's real wallet.
4. Seeder writes synthetic signed envelopes and typed attributes on Tiramisu. It records a successful create result immediately in `public/creation-evidence.json` and skips that ID on resume, avoiding routine duplicate seeds. A crash after mining but before saving can still require manual transaction reconciliation; do not blindly rerun after uncertain network errors.
5. Rebuild after adding evidence. Public creator addresses are safe to publish. No private keys or credential-bearing RPC URLs are part of the build.

Receipt entities have 30-day Entity Expiration; close statements 90 days. No production spending, real data, settlement or mainnet effects.
