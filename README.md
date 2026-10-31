<div align="center">

<img src="docs/media/banner.svg" alt="TensorStudio — One idea. Every next step." width="100%" />

**The browser workspace for building on Bittensor.**

[![Bittensor](https://img.shields.io/badge/Built_for-Bittensor-102329?style=for-the-badge)](https://www.bittensor.com/)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python_3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-102329?style=for-the-badge&logo=react)

[Open TensorStudio](https://tensorstudio-workbench.vercel.app) · [Watch the demo](docs/media/TensorStudio-demo-5min.mp4) · [Three-minute pitch](docs/pitch/README.md) · [Project brief PDF](docs/resources/TensorStudio-Project-Brief.pdf)

</div>

## From a useful idea to an inspectable system

A Bittensor subnet needs more than a model. It needs a useful task, a way to evaluate answers, software that can run that task, and visibility into what the network actually does.

Those pieces often live in different editors, terminals, scripts and explorers. TensorStudio brings the development loop into one workspace: **describe a problem, build an interface, assemble a task-specific project, test its scoring, run processes and inspect the chain.**

For subnet founders, developers, researchers and teams learning to build on decentralized intelligence.

## The problem we solve

| Builder friction | The TensorStudio workflow |
| --- | --- |
| An idea is hard to turn into a concrete starting point | A guided assistant asks questions and suggests practical next steps |
| UI prototypes and subnet logic grow in disconnected tools | Editable code, browser previews and subnet project assembly share one workspace |
| Incentive design is difficult to inspect | Explicit task, ground-truth, scoring and weight blocks |
| A successful-looking demo can hide weak evaluation | Offline fixture reports expose how scoring treats correct, copied, incorrect, slow and empty answers |
| Process state and chain state are easily confused | Native process controls and public chain observations have separate views |
| Bittensor is difficult to approach as a beginner | Contextual network tools and a Bittensor Quest learning link |

## A workspace that follows the work

### Explore → Build

Use the playground to shape an idea, review a plan and carry context into the **Subnet builder**. Inspect generated files and try the result in a real browser preview.

![Editable code and an interactive task-tracker preview](docs/media/builder.png)

### Define → Evaluate

In **Subnet setup**, describe a question-answering or classification task and supply labelled JSONL data. The assistant selects schema-validated building blocks. The runner assembles reviewed templates and checks the code. An offline harness makes the scoring behavior visible before a team relies on it.

### Run → Observe

Manage generated miner and development-validator processes through Nodes. Inspect logs, stop or restart a process, and run authenticated commands in the console. Open **TensorScan** and the subnet dashboard to inspect real chain observations, public addresses and neuron information.

![Observed testnet subnet dashboard](docs/media/dashboard.png)

## Why Bittensor

Bittensor provides the network context for specialized intelligence: miners perform work, validators evaluate it, and subnet incentive mechanisms connect contributions to network economics. TensorStudio focuses on the builder workflow around those roles.

| Bittensor concept | How TensorStudio uses it |
| --- | --- |
| Subtensor | Reads live headers, finality, blocks, events and runtime metadata through RPC |
| Subnets and metagraphs | Displays subnet snapshots, neuron identities, validator permits and available metrics |
| Hotkeys and signed requests | Generated miner/validator templates use the SDK's signed HTTP authentication |
| Task evaluation | QA/classification recipes make ground truth and scoring choices explicit |
| Weights | Offline reports calculate proposed local weights; development validator execution is separate |
| Wallets | Encrypted browser-local key storage and network-aware wallet tools |

**Inference and the chain are separate connections.** The assistant uses a configurable model endpoint. A compatible subnet inference service can be configured as that endpoint; this repository does not claim the hosted assistant is served by a registered TensorStudio subnet. Starting a miner process is separate from registration, on-chain serving, accepted weights and rewards.

Read the [Bittensor integration guide](docs/BITTENSOR-INTEGRATION.md) and [official network concepts](https://www.bittensor.com/docs/concepts/network).

## System architecture

![TensorStudio architecture: browser, web application, model endpoint, runner, generated project and Subtensor](docs/media/architecture.svg)

1. **Browser workspace:** React UI, editable files, WebContainer previews, encrypted wallet storage and bounded browser chain history.
2. **Web application:** Remix server routes validate AI requests, route inference and protect owner operations. Provider credentials remain server-side.
3. **Runner:** FastAPI assembles reviewed project files, evaluates fixtures, manages native processes and streams command output.
4. **Generated project:** Miner inference, signed requests, development-validator logic, scoring blocks and supplied evaluation data.
5. **Subtensor:** Independent RPC observations feed TensorScan and the dashboard. A separate development chain is required for private-chain workflows.

Hosted runner access uses short-lived scoped sessions and TLS. The owner console executes trusted code; it is not a public multi-user sandbox. [Architecture and operations PDF](docs/resources/TensorStudio-Architecture-Guide.pdf)

## Start building

### Open the hosted workspace

Visit **[tensorstudio-workbench.vercel.app](https://tensorstudio-workbench.vercel.app)**. The landing page and read-only explorer are public; execution tools require the workspace owner's sign-in. Never publish those credentials.

### Run locally

Requirements: **Node 20+ · pnpm 10.15 · Python 3.11 · uv · Chrome/Chromium**.

```bash
pnpm install --frozen-lockfile
uv sync --project apps/runner --python 3.11 --locked
python3 scripts/setup-local.py
pnpm dev:all
```

Open `http://localhost:5173`. The runner uses port `8787`.

Set your model endpoint, API key and model ID in `apps/web/.env.local`. Configure `BITCODE_MODEL_BASE_URL`, `BITCODE_MODEL_API_KEY` and `BITCODE_MODEL_ID` in `apps/runner/.env.local` for miner inference. The setup script pairs local runner credentials. Environment files and keys must remain outside version control.

Use a model available from your chosen service. For private-chain work, configure `CHAIN_WS` to your own development chain. Select public Testnet to explore without deploying a chain.

### Try the complete development loop

1. Open **Playground** and describe a useful, measurable task.
2. Carry a suggestion into **Subnet builder**; inspect code and interact with its preview.
3. Open **Subnet setup**, describe a QA/classification task and supply labelled data.
4. Generate a recipe, inspect its blocks and assemble the project.
5. Run the offline harness and inspect the saved report.
6. Launch a generated miner in **Nodes** with valid public identity values and configured inference.
7. Inspect process logs and use **Console** for authorized runner commands.
8. Use **TensorScan** and **Dashboard** to investigate the selected network.

Example **format** for a small classification dataset; replace this illustrative data with reviewed data for your actual task:

```jsonl
{"input":"Please refund my invoice","answer":"billing"}
{"input":"The page crashes after login","answer":"technical"}
```

The assembler requires 2–1,000 unique inputs. Classification requires 2–32 distinct labels. An evaluation dataset is not a model benchmark by itself.

## Routes at a glance

| Route | Purpose |
| --- | --- |
| `/playground` | Guided conversation, suggestions and network tools |
| `/editor` | Subnet builder: code, terminal and browser preview |
| `/subcreate` | Task recipes, project assembly and offline scoring |
| `/nodes` | Native process lifecycle and logs |
| `/scan` | Blocks, calls, events, addresses and subnet reads |
| `/dashboard/1?network=test` | A public testnet subnet snapshot |
| `/wallet` | Browser-local wallet tools |
| `/harness?id=…` | Saved offline evaluation report |
| `/runner` | Authenticated command execution |

## Sustainable business model

TensorStudio can sell developer productivity and reliable infrastructure around Bittensor. Potential products include team workspaces, managed isolated runners, private evaluations, hosted observability and integration services. These are proposed revenue streams, not claims of existing sales or guaranteed network earnings.

A practical path is to offer self-hosted development tools, validate demand for paid team workflows, then price managed compute and storage transparently. Subnet token emissions are separate from software revenue. See [business model and unit economics](docs/resources/BUSINESS-MODEL.md).

## Documentation and resources

- **[Project brief PDF](docs/resources/TensorStudio-Project-Brief.pdf)** — problem, product, Bittensor fit and business direction.
- **[Architecture guide PDF](docs/resources/TensorStudio-Architecture-Guide.pdf)** — components, request flow, security boundaries and deployment.
- **[Three-minute pitch](docs/pitch/README.md)** — narrated video, script and presenter timing.
- **[Learning and technical resources](docs/resources/RESOURCES.md)** — official Bittensor references, SDKs and design acknowledgements.
- **[Deployment guide](docs/DEPLOYMENT-RELEASE.md)** — hosting configuration and operational boundaries.
- **[Bittensor Quest](https://bittensor-quest-learn.someshtalligeri12.chatgpt.site)** — gamified learning, with its own sign-in requirements.
- **[Standalone TensorScan](https://tensorscan.vercel.app/scan?network=test)** — public testnet explorer.

## Development

```bash
pnpm typecheck
pnpm test
pnpm test:runner
pnpm build
```

```text
apps/web/       Remix + React workbench and server routes
apps/runner/    FastAPI execution service and subnet templates
packages/chain/ shared chain code
scripts/        local setup, verification and packaging
infra/          infrastructure configuration
docs/           architecture, guides, pitch and resources
```

## Operating boundaries

The hosted demonstration uses a free runner that may sleep; project files and process state are ephemeral across restarts. Offline harness timing is simulated. A private development chain is not included in the hosted deployment. Registration, serving, accepted weights, rewards and wallet-signing acceptance require separate end-to-end validation. Mainnet writes are not part of this demo.

Preserve [upstream application licensing](apps/web/LICENSE) and [third-party notices](apps/web/third-party) when redistributing. Brand and architecture graphics in this README were created for TensorStudio; interface images show the actual application.

---

<div align="center">

**Make the next step a real one.**

Built by **Somesh Talligeri** · Built for **Bittensor**

</div>
