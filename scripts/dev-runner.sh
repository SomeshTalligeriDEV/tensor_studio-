#!/bin/sh
set -eu
cd "$(dirname "$0")/../apps/runner"
if [ -f .env.local ]; then
  exec uv run --env-file .env.local python -m uvicorn bitcode_runner.main:app --host 127.0.0.1 --port 8787
fi
exec uv run python -m uvicorn bitcode_runner.main:app --host 127.0.0.1 --port 8787
