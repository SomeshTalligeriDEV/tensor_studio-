"""Fixed-amount development TAO funding; never accepts user signing material."""
import asyncio
import json
import time

import bittensor as bt
from bittensor.keyfiles import Keypair
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, ConfigDict
from websockets.asyncio.client import connect
from .chain_config import chain_endpoint

router = APIRouter()
# Legacy container-node routes remain loopback-only until their process migration.
ENDPOINT = 'ws://127.0.0.1:9944'
funding_lock = asyncio.Lock()
last_funded = 0.0


class FundingRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    expected_genesis: str | None = Field(default=None, pattern=r'^0x[0-9a-fA-F]{64}$')
    address: str = Field(min_length=47, max_length=48, pattern=r'^5[1-9A-HJ-NP-Za-km-z]+$')


async def assert_development_chain(endpoint: str = ENDPOINT, expected_genesis: str | None = None):
    async with connect(endpoint, open_timeout=3) as socket:
        await socket.send(json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'system_chainType', 'params': []}))
        if json.loads(await socket.recv()).get('result') not in ('Development', 'Local'):
            raise HTTPException(403, 'Test funding requires a development chain.')
        await socket.send(json.dumps({'jsonrpc': '2.0', 'id': 2, 'method': 'state_getRuntimeVersion', 'params': []}))
        runtime = json.loads(await socket.recv()).get('result', {})
        if 'subtensor' not in runtime.get('specName', '').lower():
            raise HTTPException(403, 'Test funding requires the Bittensor Subtensor runtime.')

        if expected_genesis:
            await socket.send(json.dumps({'jsonrpc': '2.0', 'id': 3, 'method': 'chain_getBlockHash', 'params': [0]}))
            genesis = json.loads(await socket.recv()).get('result', '')
            if genesis.lower() != expected_genesis.lower():
                raise HTTPException(409, 'Runner and playground are connected to different chains. Check CHAIN_WS.')


async def fund(address: str, expected_genesis: str | None = None):
    endpoint = chain_endpoint()
    await assert_development_chain(endpoint, expected_genesis)
    alice = Keypair.create_from_uri('//Alice')
    intent = bt.intents.build('transfer', {'dest_ss58': address, 'amount_tao': 1000, 'keep_alive': True})
    async with bt.Subtensor(endpoint, fallback_endpoints=[], policy=bt.Policy(max_spend_tao=1000, max_fee_tao=1)) as chain:
        plan = await chain.plan(intent, alice)
        if not plan.ok:
            raise HTTPException(409, 'Local test funding failed its policy preview.')
        result = await chain.execute(intent, alice)
        if not result.success:
            raise HTTPException(409, {'code': str(result.error.code) if result.error else 'FUNDING_FAILED', 'message': result.error.remediation if result.error else 'Local test funding failed.'})
        return {'amount_tao': 1000, 'block_hash': result.block_hash, 'extrinsic_id': result.extrinsic_id}


@router.post('/localnet/fund')
async def fund_local_wallet(body: FundingRequest, request: Request):
    global last_funded
    if request.headers.get('x-bitcode-client') != 'studio':
        raise HTTPException(403, 'Missing Bitcode client header.')
    async with funding_lock:
        if time.monotonic() - last_funded < 10:
            raise HTTPException(429, 'Wait 10 seconds before requesting more test TAO.')
        try:
            async with asyncio.timeout(60):
                result = await fund(body.address, body.expected_genesis) if body.expected_genesis else await fund(body.address)
            last_funded = time.monotonic()
            return result
        except HTTPException:
            raise
        except TimeoutError:
            raise HTTPException(504, 'Funding confirmation timed out. Check your balance before retrying.')
        except Exception:
            raise HTTPException(503, 'Local Bittensor funding is unavailable. Start localnet and retry.')
