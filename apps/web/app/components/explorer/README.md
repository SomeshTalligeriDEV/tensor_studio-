# TensorScan

Read-only Bittensor explorer at `/scan`, sharing one RPC session with the dashboard and wallet.

- Live best/finalized subscriptions; 100-block localnet / 20-block public-network backfill.
- Up to 200 observed blocks cached in IndexedDB per genesis; canonical checks on reconnect.
- Block, extrinsic, account and subnet routes; public address and netuid search.
- Local endpoint comes from server CHAIN_WS. Public testnet is verified by genesis.
- Activity charts show real signed-call/event counts and adjacent canonical timestamp intervals,
  with inspectable values. Missing heights/timestamps are never interpolated.
- Feed status distinguishes connection, decoding, catch-up, delayed and live states.
- Full runtime metagraph paginated; block-pinned account balances, memberships and stake positions.
- Hash-only transaction lookup covers the cached window; older block-index locations can be fetched
  on demand if RPC retains the historical state. Account activity is not lifetime history.

Run `pnpm dev`; verify `pnpm test` and `pnpm typecheck`.
Browser acceptance: `uv run --with playwright python scripts/verify-scan-activity.py`,
`verify-live-dashboard.py`, and `verify-network-recovery.py` in scripts/.
The browser offline test simulates network loss; it does not unplug system Wi-Fi.
Localnet needs a real node; see docs/LOCALNET-M3.md. No fabricated charts or balances substitute
for an unavailable chain. This is a bounded live explorer, not a complete archival indexer.
