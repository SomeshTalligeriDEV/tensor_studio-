[![Bitcode Studio](./public/social_preview_index.jpg)](https://github.com/SomeshTalligeriDEV/bitcode)

# Bitcode Studio

Bitcode Studio is a browser IDE where a plain-English idea becomes a working **Bittensor** subnet or app — prompt, run, edit, and deploy full-stack applications directly from your browser, with a built-in wallet, an on-chain explorer, and a one-click local node runner.

Owner: [SomeshTalligeriDEV](https://github.com/SomeshTalligeriDEV)

## What Bitcode Studio does

- **Full-stack in the browser**: an in-browser development environment (WebContainers) that lets you prompt, run, edit, and deploy code without any local setup.
- **AI with environment control**: the AI has full control over the filesystem, package manager, terminal, and dev server — not just code suggestions.
- **Built for Bittensor**: SubCreate turns one sentence into a working subnet (miner, validator, scoring); BitNode runs miners/validators locally in Docker; Bitcode Scan is a block explorer for localnet/testnet; a browser-native wallet handles keys, balances, swaps, and staking.

See `docs/features/` in `bitcode-spec/` for the full feature spec and build order.

## Getting started

```bash
pnpm install
pnpm run dev
```

Set `CHUTES_API_KEY` in `.env.local` for the AI model backend. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full local setup.

## Tips for prompting

- **Be specific about your stack**: mention frameworks or libraries you want (Astro, Tailwind, etc.) in your initial prompt.
- **Scaffold the basics first, then add features**: get the foundation in place before diving into advanced functionality.
- **Batch simple instructions**: combine several small requests into one message to save round trips.

## Credits

Built on the open-source [bolt.diy](https://github.com/stackblitz-labs/bolt.diy) project (MIT License, originally by StackBlitz).
