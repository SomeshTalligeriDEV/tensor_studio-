# TensorScan real localnet development session

Prepared for a temporary GitHub Codespace, not continuous hosting. Start only after verifying unused included compute/storage allowance and a hard stop on paid overages. Stop the Codespace when finished; storage usage continues while retained, so delete the Codespace after exporting any development state you need.

Use the 4-core / 16-GB Codespaces machine and a 10-minute idle timeout. The devcontainer installs a small WebSocket proxy and runs its RPC policy tests; it does not start the blockchain automatically.

```sh
bash start-localnet.sh
```

The launcher uses the verified official multi-platform Subtensor localnet image pinned by SHA-256. Its three real authorities run inside Docker. The node RPC is published only to loopback. Port 8788 exposes a separate read-only proxy; its health check requires a Subtensor Development/Local chain. It refuses submission, key-management and administrative RPC methods. No miner or wallet writes are exposed.

Forwarded port 8788 is public and read-only. It was made public only after verifying genesis, runtime identity and advancing best/finalized blocks. Raw node port 9944 remains private. Recheck port visibility after any Codespaces policy change. Use the forwarded secure WSS URL as Vercel `CHAIN_WS` only after browser verification. Never forward raw port 9944 publicly. The Codespace needs to stay running for localnet to update. A sleeping or deleted Codespace is unavailable, not a live chain.

No local chain has been started or runtime-verified by these preparatory files. No simulated blocks or transaction fixtures replace a missing chain.

Checks:

```sh
npm test
node --check proxy.mjs
bash -n start-localnet.sh
```
