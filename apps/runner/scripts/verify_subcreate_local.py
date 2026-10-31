"""Live signed HTTP check plus read-only local Subtensor metagraph discovery."""
import asyncio
import argparse
import json
import socket
import threading
import time
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import bittensor as bt
import uvicorn
from bittensor.keyfiles import Keypair
from bitcode_runner.funding import assert_development_chain
from subcreate.skeleton import create_miner, query_miner, discover_miners


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--registered', action='store_true', help='Use published 127.0.0.2 endpoint; requires macOS loopback alias')
    parser.add_argument('--netuid', type=int, default=2)
    args = parser.parse_args()
    host = '127.0.0.2' if args.registered else '127.0.0.1'
    validator = Keypair.create_from_uri('//Alice//bitcode-validator')
    miner = Keypair.create_from_uri('//Alice//bitcode-miner')
    app = create_miner(miner.ss58_address, {validator.ss58_address}, lambda text: 'TAO' if text == 'Bittensor native token?' else 'unknown')
    with socket.socket() as listener:
        try:
            listener.bind((host, 8091 if args.registered else 0))
        except OSError as error:
            raise SystemExit(f'Cannot bind {host}: {error}. On macOS the registered test requires an administrator to configure the loopback alias.')
        listener.listen()
        port = listener.getsockname()[1]
        server = uvicorn.Server(uvicorn.Config(app, log_level='error', lifespan='off'))
        thread = threading.Thread(target=server.run, kwargs={'sockets': [listener]}, daemon=True)
        thread.start()
        try:
            for _ in range(100):
                if server.started:
                    break
                time.sleep(0.02)
            assert server.started, 'Miner server failed to start'
            async def verify():
                await assert_development_chain()
                answer = await query_miner(validator, miner.ss58_address, f'{host}:{port}', 'Bittensor native token?')
                assert answer == 'TAO'
                async with bt.Subtensor('ws://127.0.0.1:9944', fallback_endpoints=[], policy=bt.Policy(max_spend_tao=0)) as chain:
                    graph = await chain.subnets.metagraph(args.netuid)
                    endpoints = await discover_miners(chain, args.netuid)
                    if args.registered:
                        registered = next(item for item in endpoints if item.hotkey == miner.ss58_address)
                        assert await query_miner(validator, registered.hotkey, registered.endpoint, 'Bittensor native token?') == 'TAO'
                    weights = await chain.weights.weights(netuid=args.netuid)
                    print('CHAIN_WEIGHTS', weights)
                    return {'discovered_signed_http': 'PASS' if args.registered else 'not tested', 'signed_http': 'PASS', 'answer': answer, 'netuid': args.netuid, 'neurons': len(graph.neurons), 'served_loopback_miners': len(endpoints), 'weights_submitted': False}
            print(json.dumps(asyncio.run(verify())))
        finally:
            server.should_exit = True
            thread.join(timeout=5)


if __name__ == '__main__':
    main()
