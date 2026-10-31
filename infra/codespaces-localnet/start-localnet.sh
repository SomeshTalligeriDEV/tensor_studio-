#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ -z "${CODESPACES:-}" ]]; then
  echo 'Run this launcher inside GitHub Codespaces, not on the local Mac.' >&2
  exit 1
fi
image='ghcr.io/raofoundation/subtensor-localnet@sha256:64f56c4b5485c2bf1f299ce792423517217acd7e763549dab311c74e784bee2b'
if docker container inspect tensorscan-localnet >/dev/null 2>&1; then
  docker start tensorscan-localnet >/dev/null
else
  docker run --detach --name tensorscan-localnet --cpus=3 --memory=10g \
    --log-opt max-size=10m --log-opt max-file=2 \
    --publish 127.0.0.1:9944:9944 "$image" >/dev/null
fi
printf '%s\n' 'Real localnet starting. Proxy health is /healthz; wait for advancing best and finalized heads before enabling the endpoint.'
exec node proxy.mjs
