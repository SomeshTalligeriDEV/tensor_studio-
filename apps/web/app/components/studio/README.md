# TensorStudio workspace

The shell provides navigation, theme switching, model settings and runner status. Home connects Ask suggestions to the editor or SubCreate. The LiveNetwork panel subscribes directly to Bittensor Finney/testnet best and finalized heads, checks the Subtensor runtime, and links observed heights to BScan. It does not submit transactions. Head data is marked stale after 45 seconds; connection setup times out after 20 seconds. Reconnect explicitly starts a fresh subscription.

Runner chain status describes the configured local runner endpoint, separately from the public network panel. Local process state does not imply on-chain registration.

Run `pnpm dev:all` from the repository root after configuring per-app environment files. `AI_BASE_URL`, `AI_MODEL` and `AI_API_KEY` stay on the server; `/api/models` exposes model identifiers, never credentials. The configured Groq model has been tested live. Chutes and fallback providers remain configurable.

Verify with `pnpm typecheck`, `pnpm test`, `pnpm build`, and opt-in live browser script `uv run --with playwright python scripts/verify-live-home.py`. Live checks require internet and the local dev server. Public RPC availability is external.
