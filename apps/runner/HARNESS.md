# Offline scoring harness

`POST /harness/run` accepts a generated `project` ID and optional `rounds`
(default 20, maximum 100). It requires `X-Bitcode-Client: studio`. The application
origin restrictions apply. `GET /harness/{id}` returns a saved report. The latest
64 reports persist in `BITCODE_PROJECTS_ROOT/.harness-reports.sqlite3`.

The harness revalidates the project's complete reviewed source snapshot before
using the installed, identical scoring and weight functions. It never executes
project code or accepts a command. Extra project files and secrets are not read.

Five fixtures are evaluated against the supplied dataset in order:

- Honest: exact ground truth with simulated elapsed time of 0.1 seconds.
- Copycat: the same answer and simulated elapsed time as honest.
- Incorrect: a different classification label, or a fixed incorrect Q&A string.
- Slow: correct answer with simulated elapsed time of six seconds, beyond the
  five-second timeout.
- Empty: an empty answer.

The report contains actual average scores, final normalized weights, ratios to
the honest fixture, per-round observations, checks, and dataset/recipe hashes.
EMA state is updated between rounds with the same calculation as the validator.
Input answers and prompts are not copied into reports. `duration_seconds` is
measured harness execution time; fixture timings are explicitly simulated.

Checks evaluate positive honest scores, highest honest final weight (allowing
ties), copycat scores at most half of honest, incorrect scores at most 10% of
honest, and zero scores for timed-out and empty answers. Classification marks
the copycat check inapplicable: matching labels alone do not show cheating.

Current Q&A duplicate penalties treat the original answer and its exact copy
identically. Consequently, the copycat check fails even when `copy_penalty` is
enabled. This is a real limitation exposed by the harness. Fuzzy text matching
can also reward incorrect answers with overlapping text. Passing checks is not
proof of semantic correctness, model quality, network latency, authentication,
on-chain rewards, or resistance to other attacks.

Run the same evaluation from `apps/runner`:

```sh
uv run python -m bitcode_runner.harness --project subcreate-<32 hex characters> --rounds 20
```

Use `BITCODE_PROJECTS_ROOT` to select the projects directory. The CLI writes the
JSON report to stdout and persists it. Exit status is 0 when applicable checks
pass, 1 when a check fails, or 2 for invalid input or an operational failure.

No model call, signed miner request, chain read/write, or real waiting is part of
this offline mode. SubCreate shows a Run offline harness action after assembly, with fixture tables,
checks and limitations. Saved reports open at `/harness?id=<report-id>` using the
same local runner. Live localnet evaluation, signed fake-miner servers and CI
file generation remain separate integration work.
