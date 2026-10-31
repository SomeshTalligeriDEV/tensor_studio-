"""Score observed miner responses, persist EMA, and optionally submit local weights."""
import argparse
import asyncio
import hashlib
import json
import math
import os
import re
import time
from pathlib import Path
from urllib.parse import urlsplit
import bittensor as bt
from websockets.asyncio.client import connect
from bittensor.keyfiles import Keypair
from skeleton import discover_miners, query_miner, preview_weights
from blocks.scoring import score_answers, normalize_weights


CHAIN_ENDPOINT = os.getenv('BITCODE_CHAIN_ENDPOINT', os.getenv('CHAIN_WS', 'ws://127.0.0.1:9944'))
_endpoint = urlsplit(CHAIN_ENDPOINT)
if _endpoint.scheme not in ('ws', 'wss') or not _endpoint.hostname or _endpoint.username or _endpoint.password or _endpoint.query or _endpoint.fragment:
    raise ValueError('Validator chain endpoint must be a WebSocket URL without credentials, query or fragment.')


def validator_signer(args):
    if args.dev_hotkey:
        if not re.fullmatch(r'bitcode-[a-z0-9-]{1,48}', args.dev_hotkey):
            raise ValueError('Use a bitcode- prefixed development hotkey name.')
        return Keypair.create_from_uri('//Alice//' + args.dev_hotkey)
    if not args.wallet or not args.hotkey:
        raise ValueError('Provide a wallet and hotkey, or an explicit public development identity.')
    return bt.Wallet(name=args.wallet, hotkey=args.hotkey)


async def local_chain_identity():
    async with asyncio.timeout(5):
        async with connect(CHAIN_ENDPOINT, open_timeout=3) as ws:
            async def rpc(method, params):
                await ws.send(json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}))
                response = json.loads(await ws.recv())
                if 'error' in response:
                    raise RuntimeError('Local chain identity check failed.')
                return response['result']
            if await rpc('system_chainType', []) not in ('Development', 'Local'):
                raise RuntimeError('Validator supports development chains only.')
            runtime = await rpc('state_getRuntimeVersion', [])
            if 'subtensor' not in runtime['specName'].lower():
                raise RuntimeError('Expected Bittensor Subtensor runtime.')
            return await rpc('chain_getBlockHash', [0])


def load_history(path):
    if not path.exists():
        return {'round': 0, 'ema': {}}
    state = json.loads(path.read_text())
    if not isinstance(state.get('round'), int) or state['round'] < 0 or not isinstance(state.get('ema'), dict):
        raise ValueError('Invalid validator checkpoint; inspect it before restarting.')
    if any(not isinstance(v, (float, int)) or not math.isfinite(v) or not 0 <= v <= 1 for v in state['ema'].values()):
        raise ValueError('Invalid EMA values in validator checkpoint.')
    return state


async def run(args):
    if args.rounds < 0 or args.interval < 1 or not 0 < args.netuid < 65536:
        raise ValueError('Use nonnegative rounds, interval >= 1, and a valid non-root netuid.')
    root = Path(__file__).resolve().parent
    recipe_text = (root / 'recipe.json').read_text()
    recipe = json.loads(recipe_text)
    rows = [json.loads(line) for line in (root / 'data' / recipe['ground_truth']['params']['file']).read_text().splitlines()]
    genesis = await local_chain_identity()
    wallet = validator_signer(args)
    address = bt.resolve_signer(wallet, role="hotkey").ss58_address
    key = hashlib.sha256((genesis + str(args.netuid) + address + recipe_text).encode()).hexdigest()[:24]
    checkpoint = Path(os.getenv('BITCODE_STATE_DIR', str(root))) / f'validator-state-{key}.json'
    history = load_history(checkpoint)
    completed = 0
    async with bt.Subtensor(CHAIN_ENDPOINT, fallback_endpoints=[], policy=bt.Policy(max_spend_tao=0, max_fee_tao=1, allowed_netuids=[args.netuid])) as chain:
        while args.rounds == 0 or completed < args.rounds:
            if await local_chain_identity() != genesis:
                raise RuntimeError('Local chain identity changed. Restart the validator.')
            miners = await discover_miners(chain, args.netuid)
            miners = [miner for miner in miners if miner.hotkey != address]
            if not miners:
                raise RuntimeError('No served local miner endpoints found. No scores or rewards were fabricated.')
            sample = rows[history['round'] % len(rows)]
            async def ask(miner):
                started = time.monotonic()
                try:
                    answer = await query_miner(wallet, miner.hotkey, miner.endpoint, sample['input'], timeout=30)
                    return answer, time.monotonic() - started, None
                except Exception as error:
                    return None, time.monotonic() - started, type(error).__name__
            observed = await asyncio.gather(*(ask(miner) for miner in miners))
            answers = [value[0] for value in observed]
            scores = score_answers(recipe, answers, [value[1] for value in observed], sample['answer'], timeout=30)
            previous = [history['ema'].get(miner.hotkey, 0.0) for miner in miners]
            settings = recipe['weights']
            weights = normalize_weights(scores, previous, settings['block'], **settings['params'])
            if settings['block'] == 'ema_normalize':
                alpha = settings['params']['alpha']
                updated = [alpha * score + (1 - alpha) * old for score, old in zip(scores, previous)]
            else:
                updated = scores
            report = {'round': history['round'], 'sample_index': history['round'] % len(rows), 'netuid': args.netuid,
                      'observations': [{'uid': miner.uid, 'hotkey': miner.hotkey, 'answer': result[0], 'elapsed_seconds': result[1], 'error': result[2], 'score': score, 'weight': weight} for miner, result, score, weight in zip(miners, observed, scores, weights)],
                      'submitted': False, 'chain_status': 'not_submitted'}
            # Don't emit weights based only on stale history when every current response failed.
            if any(score > 0 for score in scores):
                intent = bt.SetWeights(netuid=args.netuid, weights={miner.uid: weight for miner, weight in zip(miners, weights)})
                try:
                    plan = await chain.plan(intent, wallet)
                    report.update(preview_ok=plan.ok, fee=str(plan.fee), effects=plan.effects)
                    if args.submit and plan.ok:
                        if await local_chain_identity() != genesis:
                            raise RuntimeError('Chain identity changed before submission.')
                        result = await chain.execute(intent, wallet)
                        report.update(submitted=result.success, chain_status='included_or_committed' if result.success else 'failed', block_hash=result.block_hash,
                                      transaction_data=result.data, error_code=str(result.error.code) if result.error else None,
                                      remediation=result.error.remediation if result.error else None)
                except bt.BittensorError as error:
                    report.update(chain_status='preflight_failed', error_type=type(error).__name__)
            else:
                report['chain_status'] = 'no_positive_current_scores'
            history = {'round': history['round'] + 1, 'ema': {miner.hotkey: value for miner, value in zip(miners, updated)}}
            temporary = checkpoint.with_suffix('.tmp')
            temporary.write_text(json.dumps(history, sort_keys=True))
            os.replace(temporary, checkpoint)
            print(json.dumps(report, default=str), flush=True)
            completed += 1
            if args.rounds == 0 or completed < args.rounds:
                await asyncio.sleep(args.interval)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--wallet')
    parser.add_argument('--hotkey')
    parser.add_argument('--dev-hotkey', help='Public Alice-derived local development identity; never use for real funds')
    parser.add_argument('--netuid', type=int, required=True)
    parser.add_argument('--rounds', type=int, default=1, help='0 runs continuously')
    parser.add_argument('--interval', type=float, default=30)
    parser.add_argument('--submit', action='store_true', help='Submit real localnet weights after a successful preview')
    asyncio.run(run(parser.parse_args()))
