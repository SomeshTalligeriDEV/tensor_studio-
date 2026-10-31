# Build with the right references

Use official documentation for protocol behavior and software interfaces. The PDFs in this folder are original TensorStudio guides; external documentation is linked rather than republished.

## Bittensor fundamentals

| Resource | Use it for |
| --- | --- |
| [Bittensor documentation](https://www.bittensor.com/docs) | Network, SDK, CLI and protocol concepts |
| [Agent-friendly index](https://www.bittensor.com/llms.txt) | Finding raw Markdown pages and operation catalogs |
| [Network concepts](https://www.bittensor.com/docs/concepts/network) | Subnets, miners, validators, TAO and alpha |
| [SDK quickstart](https://www.bittensor.com/docs/quickstart) | Connecting and working with the SDK |
| [Signed HTTP requests](https://www.bittensor.com/docs/guides/signed-requests) | Hotkey-authenticated miner/validator traffic |
| [Running a subnet](https://www.bittensor.com/docs/guides/subnets) | Registration and subnet operations outside project assembly |
| [Validating](https://www.bittensor.com/docs/guides/validating) | Validator responsibilities and weights |
| [Wallets and keys](https://www.bittensor.com/docs/concepts/wallets) | Identity and key management |
| [Transactions and policy](https://www.bittensor.com/docs/concepts/transactions) | Planning, fee previews and bounded execution |
| [Subtensor source](https://github.com/RaoFoundation/subtensor) | Chain implementation and local-chain resources |

The implementation pins Bittensor 11.3.0. Check current upstream documentation before changing dependencies. Never infer real earnings from a running process or a fixture score.

## Application stack

- [Remix](https://remix.run/docs) — application routes and server actions.
- [React](https://react.dev/) — workspace interface.
- [FastAPI](https://fastapi.tiangolo.com/) — runner API.
- [Polkadot.js API](https://polkadot.js.org/docs/api/) — browser Substrate RPC and runtime decoding.
- [WebContainers](https://webcontainers.io/guides/introduction) — browser execution and preview runtime.
- [Vercel documentation](https://vercel.com/docs) — deployed web application.
- [Render free-service documentation](https://render.com/docs/free) — sleep, memory and storage constraints.

## Learning and design references

- [Bittensor Quest](https://bittensor-quest-learn.someshtalligeri12.chatgpt.site) — gamified introduction; separate application and sign-in.
- [TensorScan](https://tensorscan.vercel.app/scan?network=test) — standalone explorer deployment.
- [React Bits](https://reactbits.dev/) — animated components; bundled license in `apps/web/third-party`.
- [ObsidianUI](https://www.obsidianui.dev/) and [Rune Icons](https://www.runeicons.com/) — interface references and applicable component/icon notices.
- [Typesafe](https://typesafe.ai/), [Preflight](https://preflight-lemon.vercel.app/) and [TensorStudio reference](https://tensorstudio.lovable.app/) — visual inspiration. No affiliation or endorsement is implied.

Planes Pro components are not included. TensorStudio uses an original free visual treatment. Keep bundled third-party license files with redistributed source.

## Downloadable TensorStudio guides

- [Project brief](TensorStudio-Project-Brief.pdf)
- [Architecture and operations](TensorStudio-Architecture-Guide.pdf)
- [Business model](BUSINESS-MODEL.md)
- [Three-minute pitch](../pitch/README.md)
