# Bittensor v11 project

This project uses actual model inference and signed miner HTTP requests. It is not deployed by assembly. `project-status.json` records dataset provenance and verification scope.

1. Install requirements in an isolated environment.
2. Set `BITCODE_MODEL_ID`, `BITCODE_MODEL_API_KEY`, and optionally `BITCODE_MODEL_BASE_URL` in the miner process environment. The default endpoint is Chutes; a local OpenAI-compatible server can use HTTP on loopback without an API key. Never put credentials in recipe JSON.
3. Run `python miner.py --hotkey PUBLIC_MINER_SS58 --validator PUBLIC_VALIDATOR_SS58`. Missing inference settings stop startup. Provider failures return HTTP 503; there are no canned answers or dataset lookups.
4. Register neurons and publish endpoints on localnet before running the validator. The runtime rejects 127.0.0.1 publication; macOS needs a loopback alias for 127.0.0.2 and `--host 127.0.0.2` on the miner. Publication does not start a server.
5. Run `python validator.py --wallet NAME --hotkey NAME --netuid N` to score real responses and preview weights. `--rounds 0 --interval 30` runs continuously. `--submit` enables actual localnet weight submission after each successful preview. Chain rate limits may defer submissions.

`python self_check.py` is an OFFLINE compile/scoring unit check. It does not test inference, miner reachability, chain registration or rewards. The validator emits observed responses, errors, scores and transaction status, never invented rewards. Timelocked commit success is not proof of auto-reveal.

Use labelled data you have verified. Built-in datasets, when explicitly selected through the testing API, are fixtures. Fuzzy answer scoring is a lexical baseline, not semantic fact verification. Duplicate text does not prove copying; live classification rejects duplicate-answer penalties. Production data quality and anti-cheat need separate validation.
