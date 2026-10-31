#!/usr/bin/env bash
# Resume services only while the Codespace is running; do not bypass its idle limit.
set -euo pipefail
cd "$(dirname "$0")"
[[ -n "${CODESPACES:-}" ]] || { echo 'Codespaces only' >&2; exit 1; }
# A lock makes repeated lifecycle callbacks safe and keeps a single proxy supervisor.
nohup bash -c '
  exec 9>/tmp/tensorscan-localnet-service.lock
  flock -n 9 || exit 0
  while true; do
    bash start-localnet.sh >>/tmp/tensorscan-service.log 2>&1 || true
    sleep 5
  done
' >/dev/null 2>&1 </dev/null &
