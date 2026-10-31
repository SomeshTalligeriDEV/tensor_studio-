"""Create local env files and pair web/runner authentication without printing secrets."""
import argparse
from pathlib import Path
import secrets
import os
parser=argparse.ArgumentParser()
parser.add_argument('--check',action='store_true')
args=parser.parse_args()
root=Path(__file__).resolve().parent.parent
paths=[root/'apps/web/.env.local',root/'apps/runner/.env.local']
def read_token(path):
    if not path.exists(): return ''
    for line in path.read_text().splitlines():
        if line.startswith('RUNNER_TOKEN='): return line.partition('=')[2].strip()
    return ''
tokens=[read_token(path) for path in paths]
if all(tokens) and tokens[0]!=tokens[1]:
    raise SystemExit('RUNNER_TOKEN values differ. Set the same value in both app .env.local files; values were not displayed or changed.')
if args.check:
    if not all(tokens): raise SystemExit('Local pairing is incomplete. Run python3 scripts/setup-local.py.')
    print('Web and runner authentication are paired. No credentials displayed.')
else:
    token=next((value for value in tokens if value),None) or secrets.token_urlsafe(32)
    for path in paths:
        text=path.read_text() if path.exists() else path.with_name('.env.example').read_text()
        lines=[line for line in text.splitlines() if not line.startswith('RUNNER_TOKEN=')]
        fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
        with os.fdopen(fd,'w') as stream: stream.write('\n'.join(lines+[f'RUNNER_TOKEN={token}'])+'\n')
        path.chmod(0o600)
    print('Local environment files ready. Configure your AI key locally, then run pnpm dev:all. No credentials displayed.')
