"""Explicit development-chain registration/weight acceptance, never public chains."""
import asyncio
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import bittensor as bt
from bittensor.keyfiles import Keypair
from bitcode_runner.funding import assert_development_chain

STATE = Path(__file__).resolve().parent / 'local-subcreate-state.json'

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--plaintext', action='store_true', help='Temporarily disable commit-reveal on this owned dev subnet and verify stored weights')
    parser.add_argument('--setup-only', action='store_true', help='Register development identities and endpoint without setting weights')
    parser.add_argument('--recreate-missing', action='store_true', help='Recreate the saved development subnet only if it no longer exists')
    args = parser.parse_args()
    await assert_development_chain()
    alice = Keypair.create_from_uri('//Alice')
    validator = Keypair.create_from_uri('//Alice//bitcode-validator')
    miner = Keypair.create_from_uri('//Alice//bitcode-miner')
    # Floating registration cost cannot be expressed with max_spend_tao.
    # This is an explicit development-chain-only verification script.
    async with bt.Subtensor('ws://127.0.0.1:9944', fallback_endpoints=[], policy=bt.Policy(max_fee_tao=1)) as chain:
        async def execute(op, args, signer):
            intent = bt.intents.build(op, args)
            plan = await chain.plan(intent, signer)
            print(json.dumps({'preview': op, 'ok': plan.ok, 'fee': str(plan.fee), 'effects': plan.effects, 'warnings': plan.warnings}), flush=True)
            if not plan.ok:
                raise RuntimeError(f'{op} policy preview refused')
            result = await chain.execute(intent, signer)
            print(json.dumps({'operation': op, 'success': result.success, 'block': result.block_hash, 'data': result.data, 'error': str(result.error) if result.error else None}, default=str), flush=True)
            result.raise_for_failure()
            return result
        reuse = STATE.exists()
        if reuse and args.recreate_missing:
            saved = json.loads(STATE.read_text())
            reuse = await chain.subnets.metagraph(saved['netuid']) is not None
        if reuse:
            state = json.loads(STATE.read_text())
            netuid = state['netuid']
            owner = await chain.query(bt.storage.SubtensorModule.SubnetOwner, [netuid])
            assert owner == alice.ss58_address, 'Saved subnet owner mismatch'
        else:
            result = await execute('register_subnet', {'hotkey_ss58': validator.ss58_address}, alice)
            netuid = int(result.data['netuid'])
            STATE.write_text(json.dumps({'netuid': netuid}) + '\n')
        print('NETUID', netuid, flush=True)
        mg = await chain.subnets.metagraph(netuid)
        print('NEURONS', str(mg.neurons), flush=True)
        if mg.by_hotkey(miner.ss58_address) is None:
            await execute('burned_register', {'netuid': netuid, 'hotkey_ss58': miner.ss58_address}, alice)
        mg = await chain.subnets.metagraph(netuid)
        uid = mg.by_hotkey(miner.ss58_address).uid
        print('STAKE_THRESHOLD', await chain.query(bt.storage.SubtensorModule.StakeThreshold), flush=True)
        if mg.by_hotkey(miner.ss58_address).axon != '127.0.0.2:8091':
            await execute('serve_axon', {'netuid': netuid, 'ip': '127.0.0.2', 'port': 8091}, miner)
        if args.setup_only:
            print('DEVELOPMENT_SETUP_PASS', flush=True)
            return
        enabled = bool(await chain.query(bt.storage.SubtensorModule.CommitRevealWeightsEnabled, [netuid]))
        if args.plaintext and enabled:
            await execute('set_hyperparameter', {'netuid': netuid, 'name': 'commit_reveal_weights_enabled', 'value': 0}, alice)
        try:
            await execute('set_weights', {'netuid': netuid, 'uids': [uid], 'weights': [1.0]}, validator)
            weights = await chain.weights.weights(netuid=netuid)
            print('READ_BACK_WEIGHTS', weights, flush=True)
            if args.plaintext:
                validator_uid = mg.by_hotkey(validator.ss58_address).uid
                assert weights.get(validator_uid, {}).get(uid, 0) > 0, 'Weights were not stored on chain'
        finally:
            if args.plaintext and enabled:
                await execute('set_hyperparameter', {'netuid': netuid, 'name': 'commit_reveal_weights_enabled', 'value': 1}, alice)
        print('CHAIN_ACCEPTANCE_PASS', flush=True)

if __name__ == '__main__':
    asyncio.run(asyncio.wait_for(main(), timeout=120))
