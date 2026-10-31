# Playground

`/playground` connects Taostats Wallet and provides network-specific test funding.
Localnet uses the authenticated runner's fixed Alice transfer after a genesis check.
Testnet links only to official network guidance and the community linked by Bittensor docs;
no public automated faucet was verified. Funding controls exist only on this page.

Run `pnpm dev` and `pnpm dev:runner`. Native M3 chain setup: `docs/LOCALNET-M3.md`.
Verify UI with `uv run --with playwright python scripts/verify-playground.py`.
Real funding requires a running local chain; the browser test verifies unavailable states,
official links and mobile layout, not a successful transfer.
