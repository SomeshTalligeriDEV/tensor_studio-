# Local process nodes

`process_nodes.router` runs reviewed SubCreate miner and validator templates on
this computer without Docker. Include it in the runner app and await
`process_nodes.shutdown()` in the app lifespan shutdown handler. The runner's
origin/authentication middleware must cover these routes; mutations additionally
require `X-Bitcode-Client: studio`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/process-nodes` | Return `{nodes: [...]}` |
| POST | `/process-nodes/miner` | Start a generated miner |
| POST | `/process-nodes/validator` | Start a development validator in preview mode |
| GET | `/process-nodes/{id}` | Inspect observed process state |
| GET | `/process-nodes/{id}/logs` | Return `{text: ...}` with a bounded log tail |
| POST | `/process-nodes/{id}/start` | Restart a stopped/exited node |
| POST | `/process-nodes/{id}/stop` | Terminate the process group |
| DELETE | `/process-nodes/{id}` | Remove a stopped node and its private snapshot |

Miner input: `project`, `netuid`, public SS58 `hotkey`, public SS58 `validators`
(array), and optional `port` (default 8091). Use a different port for each miner.
The listener binds to `127.0.0.1`; this is not an advertised chain endpoint.
Configure `BITCODE_MODEL_BASE_URL`, `BITCODE_MODEL_ID`, and
`BITCODE_MODEL_API_KEY` in the runner's environment. A loopback HTTP model may
omit the key. The API neither accepts nor returns model keys.

Validator input: `project`, `netuid`, and `dev_hotkey` (a `bitcode-` prefixed public
Alice-derived development identity). It never loads a wallet or passes
`--submit`. It reads the runner's `CHAIN_WS` endpoint (default `ws://127.0.0.1:9944`)
and requires a Development/Local Subtensor chain before loading its development
signer. Runtime and genesis checks are repeated during validation. It fails if
the chain is unavailable or not a development chain. No fallback occurs.
Miner destinations remain limited to loopback addresses in this local launcher.

The launcher regenerates trusted template bytes from validated recipe/data and
requires the project to match them. It executes a private snapshot containing
only those files. Extra project files, `.env`, Python import hooks, wallet files,
and symlinks are excluded or rejected. The child gets a private empty HOME and a
small explicit environment; only miners receive the configured inference key.
Python isolated mode disables user site packages and inherited Python paths.
This is not an operating-system sandbox: reviewed subprocesses run as the local
user, with the runner environment's installed dependencies.

Limits: eight retained nodes, 24 hours per run, 1 MiB of output per run, and a
64 KiB redacted log tail. Overlong lines stop the child. Stop sends SIGTERM and
then SIGKILL after at most two seconds, including remaining process-group
members. Failed processes are not automatically retried. Delete stopped nodes
to free a registry slot.

Current scope: the registry, snapshots, and validator checkpoints last for the
runner session. Shutdown stops nodes and removes snapshots. Crash recovery,
SQLite persistence, automatic restart, live WebSocket logs, health probes,
CPU/RAM measurements, registration, serving transactions, and chain rewards are
not implemented. API fields explicitly report unknown metrics and unverified
registration/serving. `running` means an OS process was started, not that chain
participation or model inference succeeded.
