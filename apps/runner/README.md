# Bitcode runner — F02 foundation

Run `uv sync --locked`, then `uv run runner` from this directory. The service binds only to `127.0.0.1:8787`. Set `BITCODE_WEB_ORIGIN` to the exact frontend origin (default `http://localhost:5173`). For Colima, set `DOCKER_HOST` to the socket returned by `docker context inspect`; Docker SDK does not automatically select CLI contexts.

Pull `ghcr.io/raofoundation/subtensor-localnet:devnet` before using Start. The controller manages only its labelled `bitcode-localnet` container, binds chain ports 9944/9945 to loopback, and retains the container when stopped. `/health` reports Docker state separately from a real WebSocket `chain_getHeader` probe. Container running does not mean chain ready.

Test: `uv run pytest`. Unit tests use Docker mocks. Live image startup and EVM port verification remain pending. Command execution and WebSocket logs are implemented below; live btcli/localnet verification is still required before F02 is acceptance-complete.

## Command execution

The Runner navigation item opens `/runner`. Choose `python`, `btcli`, or `uv`, supply a JSON argument array, and choose a folder relative to `BITCODE_PROJECTS_ROOT` (defaults to `projects/` under the runner's working directory). `POST /exec` returns a job ID; `/ws/exec/{id}` replays output and streams completion. Browser requests require the configured Origin and `X-Bitcode-Client: studio`. WebSockets require the configured Origin.

Commands are trusted local code, not sandboxed; Python and uv can execute arbitrary code. Only use this runner with trusted local projects. No shell strings are evaluated by the runner. Processes have a 120-second deadline, 256 KiB output cap, four-job concurrency limit, and descendant cleanup. Up to 32 jobs are retained in memory. Server API keys are not inherited by subprocesses. Bittensor 11.3.0 and its bundled btcli are installed by `uv sync --locked`; commands prefer the runner environment executable. Closing the page disconnects logs; it does not cancel the command.

## Project text files

`GET` and `PUT /projects/{id}/files/{path}` read/write UTF-8 files under the configured workspace. PUT accepts `{ "content": "..." }` and requires the client header. IDs use letters, numbers, underscores, and hyphens; absolute paths, parent traversal, and symlinks are rejected. Files are limited to 1 MiB. This is a trusted local workspace API, not isolation from concurrently running project code.

In the editor workbench, **Save to runner** saves pending edits and exports eligible text files into a new `project-<uuid>` folder. **Open runner** selects that folder for commands. Export skips binaries, dependency/build directories, `.env` files (except `.env.example`), and common private-key extensions. This filename filtering cannot detect secrets embedded in arbitrary source files; keep credentials out of generated projects. Each export is a separate snapshot; runner edits are not imported back automatically.

### Verified Bitcode Docker profile on this Mac

The original Colima profile fails to boot. A separate `bitcode-dev` profile boots successfully with 2 CPUs, 4 GiB RAM and no host-folder mounts. Use `DOCKER_HOST=unix://$HOME/.colima/bitcode-dev/docker.sock uv run runner` from this directory. Match `BITCODE_WEB_ORIGIN` to the web app (`http://127.0.0.1:5173` for an app opened at that address). This does not change your default Docker context.

Runner subprocesses default `BT_NETWORK=ws://127.0.0.1:9944` and `BT_FALLBACK_ENDPOINTS=none`. This is a default, not a sandbox: explicit command arguments or trusted Python code can override it.

## Local test funding

`POST /localnet/fund` accepts only `{ "address": "5…" }` plus `X-Bitcode-Client: studio`. It sends exactly 1,000 local test TAO from the development Alice account. The endpoint is hardcoded to loopback, refuses non-development/non-Subtensor chains, disables fallback endpoints, previews the intent, and applies a 1,000 TAO spend / 1 TAO fee policy. Requests are serialized and successful funding is rate-limited to once every 10 seconds. No user secrets are accepted. Restart the runner after updating its source.

## SubCreate live project path

The production UI requires a problem and a labelled user dataset. `/api/subcreate` calls the configured model for a strict data-only recipe; no sample fallback is used. `GET /subcreate/schema` returns the assembly schema. `POST /subcreate/assemble-live` requires `X-Bitcode-Client: studio` and `{recipe, dataset}`. Fixture recipe routes have been removed; canned data lives only under `tests/fixtures`.

Custom data is validated for size, unique inputs, nonempty answers, and classification labels. The assembler copies fixed code, emits provenance and hash manifests, and runs an explicitly offline scoring check. Passing that check is not proof of live inference or deployment.

Generated miners use OpenAI-compatible inference (`BITCODE_MODEL_ID`, `BITCODE_MODEL_API_KEY`, optional `BITCODE_MODEL_BASE_URL`, default Chutes). Missing configuration stops startup; invalid/upstream responses fail without substituting answers. Classification instructions include only the allowed labels; the input is not looked up in evaluation data.

Generated validators query signed HTTP endpoints from the live metagraph, rotate evaluation inputs, maintain EMA checkpoints scoped by chain, subnet, hotkey and recipe, and log actual observations. `--rounds 0 --interval 30` runs continuously. `--submit` enables localnet weight submission after policy preview; without it the validator only previews. No rewards are synthesized. End-to-end inference and launch verification still require provider credentials and reachable registered miners.

Development verification scripts:
- `scripts/verify_live_assembly.py`: reads real chain facts, supplies them to live custom-data assembly, verifies output/provenance and missing-model behavior. Does not claim inference success.
- `scripts/verify_subcreate_local.py`: signed HTTP and metagraph tests. `--registered` needs the 127.0.0.2 endpoint to be bindable; macOS requires an administrator-configured loopback alias.
- `scripts/verify_subcreate_chain.py`: explicit development registration and commit verification. Successful timelocked commit does not prove successful reveal. `--plaintext` may be blocked by the runtime's protected weights window.

## Nodes (miner runtime increment)

`/nodes` in Studio builds and launches current, unmodified SubCreate miners in Docker. Configure `BITCODE_MODEL_ID`, `BITCODE_MODEL_API_KEY`, and optionally `BITCODE_MODEL_BASE_URL` (HTTPS, defaults to Chutes) in the **runner** environment, then restart it. No model configuration or answers are substituted. This increment does not support containerized local HTTP model providers.

- `POST /nodes/miner`: `{project, netuid, hotkey, validators}` with `X-Bitcode-Client: studio`. Requires the local development Subtensor chain. Checks current template bytes, validates data, builds only allowlisted files, and starts a non-root miner. Existing/edited projects must be reassembled. The first build can take several minutes; launches are serialized and duplicates are rejected.
- `GET /nodes`, `GET /nodes/{id}`, `GET /nodes/{id}/logs`: Docker inventory, actual process/health/resource state, and bounded timestamped logs. Studio polls every three seconds; failed refreshes are explicitly stale. Missing metrics are unavailable, never invented zeroes.
- `POST /nodes/{id}/start` and `/stop`: operate only on labelled Bitcode node containers, with the client header. Start/stop persists in Docker. Restart policy is `unless-stopped`; no wallet directories, host mounts, or Docker socket are mounted. Provider keys are runtime environment variables (visible to local Docker administrators), excluded from images and API responses.

HTTP health means only that the miner process responds. Inference, served endpoints, chain statistics, automatic transaction signing, and weight reveal are **not verified by this screen**. Development validator registration is checked before launch; current registration is not continuously monitored. The subnet ID is an association label, not proof of registration. Validators can use the local development launcher below or the existing generated CLI. This is partial F06, not the full subnet launch flow.

`scripts/verify_nodes.py <existing-project>` rebuilds a real project and tests the actual Docker image's offline checks and missing-credentials failure, plus status/log/start/stop APIs; it does not create fake model credentials. Container image pulls require the Docker VM to reach the registry.

### Local development validators

The Nodes role selector also supports `POST /nodes/validator` with `{project, netuid, dev_hotkey}`. The name must match `bitcode-[a-z0-9-]{1,48}`; the signer is the public development derivation `//Alice//<name>`. This is a real signing identity for a local chain, not a private user wallet. Registration is read from the actual local metagraph before Docker changes. Missing registrations fail explicitly. The launcher does not submit weights or register identities.

The validator joins the managed miner network, connects to the labelled localnet container, permits only loopback and that bounded private subnet for signed miner queries, and stores EMA checkpoints in its dedicated Docker volume. Generated validators accept `--dev-hotkey` for this mode; existing `--wallet`/`--hotkey` CLI usage remains available. `BITCODE_CHAIN_ENDPOINT` permits only loopback or the managed localnet hostname. Both modes verify Development/Local chain type and the Subtensor runtime before deriving/using a signer. API bodies cannot carry private keys or request weight submission. Containerized execution still requires successful image download/build.

### Local chain persistence

New localnet containers pass `--no-purge` to the image startup script. Older containers created without that flag purge their chain on restart. `scripts/preserve_localnet.py` migrates only the labelled Bitcode localnet, preserving the original startup script as a backup inside the container. This was applied and verified on this machine: subnet 2 survived a controlled restart. Removing the container still deletes its writable-layer chain storage. The earlier reset cleared previous test balances; refill those through Wallet if needed.

Live checks now include a real built Docker runtime, missing-credentials miner failure, node status/log/start/stop, and a running development validator whose checkpoint survives stop/start. `scripts/verify_validator_docker.py <project>` repeats that check through the live runner. The observed miner endpoint is currently unreachable, so its real reports contain null answers and connection errors with no submitted weights. Provider inference remains unverified.

### Live chain status and development endpoint publication

`GET /nodes/{id}/chain` queries the actual local metagraph for registration, UID, validator permit, rank, incentive, dividends, and served endpoint. It reports the block observed near the read and whether a miner's chain endpoint matches its Docker endpoint. Missing registrations return null metrics; unavailable chains return errors. Studio refreshes selected-node chain status and explicitly marks failures.

A healthy running miner can publish its Docker endpoint using a matching public development identity:

- `POST /nodes/{id}/serve-preview` with `{dev_hotkey}` performs real SDK preflight and returns the endpoint, fee, effects, warnings, and a single-use token valid for 60 seconds.
- `POST /nodes/{id}/serve` with `{token}` confirms that exact preview. The runner rechecks the container identity/address, chain identity, registration, policy, and fee before executing `serve_axon`. A changed endpoint, increased fee, expired/replayed token, or changed registration requires a fresh preview.

Both mutations require the Studio client header. The endpoint is taken from the managed container; callers cannot supply arbitrary endpoints, netuids, or private signing material. Transactions use only the matching `//Alice//bitcode-...` development identity and a zero-spend/1-TAO maximum-fee policy on the local development chain. This is endpoint publication, not subnet/hotkey registration or successful inference. After inclusion, the UI reads the actual served endpoint again rather than assuming it matches.

`scripts/verify_node_chain.py` verifies live validator status and a real SDK serve preview without submitting. Full miner publication still requires a configured healthy miner. No model credentials are currently configured on this machine.
