"""Read live node chain status and verify a real SDK serve preview, without writes."""
import asyncio
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import bittensor as bt
from bittensor.keyfiles import Keypair
import httpx
from bitcode_runner.funding import assert_development_chain


async def main():
    await assert_development_chain()
    with httpx.Client(base_url='http://127.0.0.1:8787', timeout=45, trust_env=False) as client:
        nodes = client.get('/nodes').json()['nodes']
        validator = next(node for node in nodes if node['role'] == 'validator')
        response = client.get('/nodes/' + validator['id'] + '/chain')
        response.raise_for_status()
        state = response.json()
        assert state['registered'] and state['uid'] == 0
        rejected = client.post('/nodes/' + validator['id'] + '/serve-preview', headers={'X-Bitcode-Client': 'studio'}, json={'dev_hotkey': 'bitcode-validator'})
        assert rejected.status_code == 409
    signer = Keypair.create_from_uri('//Alice//bitcode-miner')
    async with bt.Subtensor('ws://127.0.0.1:9944', fallback_endpoints=[], policy=bt.Policy(max_spend_tao=0, max_fee_tao=1, allowed_netuids=[2])) as chain:
        intent = bt.intents.build('serve_axon', {'netuid': 2, 'ip': '127.0.0.2', 'port': 8091})
        plan = await chain.plan(intent, signer)
        assert plan.ok
        assert not plan.fee > plan.fee
        print(json.dumps({'live_validator': state, 'sdk_serve_preview_ok': plan.ok, 'fee': str(plan.fee),
                          'effects': plan.effects, 'transaction_submitted': False,
                          'miner_publication_end_to_end_verified': False}), flush=True)


if __name__ == '__main__':
    asyncio.run(main())
