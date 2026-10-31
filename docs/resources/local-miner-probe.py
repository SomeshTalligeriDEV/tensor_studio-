"""Local development-only signed miner probe; uses the public //Alice identity.

This does not register a node or submit a chain transaction. The miner must
allowlist Alice. Never use this public development identity for valuable funds.
"""
import argparse
import json
import bittensor as bt
from bittensor.keyfiles import Keypair
import httpx

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--receiver', required=True, help='Miner public SS58 address')
parser.add_argument('--port', type=int, default=8094)
args = parser.parse_args()
message = 'As soon as I log in, the screen freezes.'
body = json.dumps({'input': message}).encode()
headers = bt.http_auth.sign(Keypair.create_from_uri('//Alice'), method='POST',
                            path='/task', body=body, receiver_ss58=args.receiver)
headers['Content-Type'] = 'application/json'
response = httpx.post(f'http://127.0.0.1:{args.port}/task', content=body,
                      headers=headers, timeout=45, trust_env=False)
print('Input:', message, flush=True)
print('Signed local miner response: HTTP', response.status_code, flush=True)
response.raise_for_status()
print('Predicted category:', response.json()['answer'], flush=True)
print('Development request only; no chain transaction.', flush=True)
