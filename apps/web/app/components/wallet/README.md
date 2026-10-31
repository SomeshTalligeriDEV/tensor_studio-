# Browser wallet — F03 foundation

Open `/wallet`. Create a 12-word sr25519 phrase, confirm three randomly selected words, then encrypt it with a password of at least 12 characters. Import accepts a valid 12-word phrase or a version 3 encrypted sr25519 JSON backup (maximum 64 KB). JSON import verifies the password and address before saving, discards imported metadata, and leaves the wallet locked. Download encrypted backup exports the stored ciphertext without unlocking. Only encrypted keyring JSON is persisted in IndexedDB (`bitcode-wallet`). Existing storage cannot be silently overwritten.

Unlock decrypts in memory; lock, leaving the page, and 15 minutes of inactivity lock the signing pair. Passwords and recovery phrases are not sent to the runner or stored as plaintext. JavaScript cannot guarantee memory zeroization. Read-only balance subscription uses ws://127.0.0.1:9944. No public network is selected.

Shared `Signer` contract currently lives in `app/lib/chain/signer.ts` alongside the existing editor dependencies. It exposes address, lock status, signing, and lock; mnemonic implementation keeps the pair private. Extract to a monorepo package when the wallet consumers are added.

Verified: crypto round trip, wrong password, signature validity, lock, deterministic address derivation, API connection and chain decimals. Browser storage/reload and UI acceptance remain pending. Local funding is available only in the playground; fee-preview transfers and local activity are implemented. QR receive address, saved contacts and the last five recipients are implemented. Prices are not implemented. Taostats extension consent/account/signing support is implemented; real extension signing acceptance remains pending. Do not mark F03 complete.

JSON backup validation: automated tests cover roundtrip, wrong password, address mismatch, malformed/oversized files, unsupported key type, unencrypted data, and metadata removal. TypeScript validation passes. Browser file import/download acceptance remains pending.

## Local Bittensor transfers

Get test TAO calls the runner's fixed 1,000 TAO development-only faucet. Transfers preview the fee before password confirmation, preserve the sender account via `transferKeepAlive`, sign through the shared Signer, and wait for finalization. Amounts use integer rao, never floating point. Preview expires in 60 seconds and is rejected if the estimated fee increases. Keys lock immediately after signing. Activity is stored per genesis hash and address.

Live check: `node --experimental-strip-types scripts/verify-wallet-local.mjs` from `apps/web` (requires localnet and runner). It generates ephemeral wallets, funds one, sends 10 TAO, and verifies both balances. This spends only local test TAO. Verified 28 October: recipient received 10,000,000,000 rao; sender retained 989,999,916,875 rao after an 83,125 rao fee. Browser-click acceptance is still pending.

Receive QR uses a browser-rendered SVG containing only the public SS58 address. Contacts are validated and normalized to SS58 format 42, stored by chain genesis and wallet address, and capped at 100. Saving an existing address updates its label. Choosing a contact or recent recipient clears any existing transfer approval. Contact storage failures are reported rather than claiming a successful save.
