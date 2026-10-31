/** Official Subtensor endpoints; verified against Bittensor network docs.
 * https://www.bittensor.com/docs/concepts/network
 * Keep this module dependency-free so the home screen can lazy-load Polkadot.js.
 */
export const explorerNetworks = {
  finney: { label: 'Finney · Mainnet', endpoint: 'wss://entrypoint-finney.opentensor.ai:443' },
  test: { label: 'Bittensor · Testnet', endpoint: 'wss://test.finney.opentensor.ai:443' },
  local: { label: 'Localnet · Development', endpoint: 'ws://127.0.0.1:9944' },
} as const;
export type ExplorerNetwork = keyof typeof explorerNetworks;

// Pruned nodes can retain roughly 300 blocks of state. Leave headroom for
// new blocks while backfilling; this is a request budget, not a retention guarantee.
export const RECENT_BACKFILL_BLOCKS = 256;
