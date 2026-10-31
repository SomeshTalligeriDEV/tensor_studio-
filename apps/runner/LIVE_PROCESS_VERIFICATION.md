# Signed local miner verification

Verified on 2026-10-29 using `scripts/verify_process_inference.py` and the
server-only configured Groq provider. Configuration values and credentials are
not included in this evidence.

The check generated a fresh reviewed project in a temporary directory with two
explicit synthetic test questions (arithmetic and geography). These were test
fixtures, not application demo data. It started the actual generated miner as a
supervised process on `127.0.0.1:8099`, using public development identities.

Observed results:

- The real miner reached its HTTP readiness endpoint.
- An unsigned task request returned HTTP 401.
- A request signed with the SDK's `bt.http_auth` flow was accepted and passed
  through the generated model client to the configured provider. The response
  was nonempty, one character long, and the correct answer to the arithmetic
  question. No model response or HTTP transport was mocked.
- The actual offline harness API returned HTTP 200 and a saved report could be
  retrieved unchanged. Its `copycat_half_honest` check failed, correctly exposing
  the duplicate-scoring limitation. The report remained explicitly offline and
  synthetic; it was separate from the live inference request.
- The configured API key did not appear in returned process metadata, miner
  logs, or harness report JSON.
- The process stop endpoint reported stopped and the OS child exited. Runner
  shutdown cleared the registry and removed its private runtime snapshot. The
  temporary project, report database and remaining fixture files were removed.

No chain reads, writes, registration, serving extrinsics, wallet files, Docker
operations, or coldkeys were used. This verifies one authenticated inference
round trip; it does not establish miner registration, serving reachability from
another machine, validator operation, weight submission, or production load.

Re-run explicitly from `apps/runner`:

```sh
.venv/bin/python scripts/verify_process_inference.py --env-file .env.local --port 8099
```

The command reads only the allow-listed model settings, makes one live inference
request (provider usage may apply), prints a non-sensitive JSON summary, and
cleans up its own resources. It requires loopback binding and provider network
access. It never prints API keys, provider diagnostics, or model response text.
