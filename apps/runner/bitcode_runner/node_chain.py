"""Observed chain status and previewed local development endpoint publication."""
import asyncio
import json
import secrets
import time
from functools import wraps

import bittensor as bt
from bittensor.keyfiles import Keypair
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from websockets.asyncio.client import connect

from .funding import ENDPOINT, assert_development_chain
from .nodes import connection, owned, describe, require_client

router = APIRouter()
previews = {}
write_lock = asyncio.Lock()


class ServePreview(BaseModel):
    model_config = ConfigDict(extra='forbid')
    dev_hotkey: str = Field(pattern=r'^bitcode-[a-z0-9-]{1,48}$')


class ServeConfirm(BaseModel):
    model_config = ConfigDict(extra='forbid')
    token: str = Field(min_length=32, max_length=128)


def bounded(function):
    @wraps(function)
    async def run(*args, **kwargs):
        try:
            async with asyncio.timeout(45):
                return await function(*args, **kwargs)
        except HTTPException:
            raise
        except TimeoutError:
            raise HTTPException(504, 'Local chain request timed out. Refresh chain status before retrying a transaction.') from None
        except Exception:
            raise HTTPException(503, 'Local chain operation failed. Check localnet and refresh chain status.') from None
    return run


def snapshot(node_id):
    with connection() as client:
        return describe(owned(client, node_id))


async def chain_head():
    async with connect(ENDPOINT, open_timeout=3) as ws:
        await ws.send(json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'chain_getHeader', 'params': []}))
        header = json.loads(await ws.recv())['result']
        await ws.send(json.dumps({'jsonrpc': '2.0', 'id': 2, 'method': 'chain_getBlockHash', 'params': [0]}))
        genesis = json.loads(await ws.recv())['result']
        return {'observed_block': int(header['number'], 16), 'genesis': genesis}


async def observe(node):
    await assert_development_chain()
    head = await chain_head()
    async with bt.Subtensor(ENDPOINT, fallback_endpoints=[]) as chain:
        metagraph = await chain.subnets.metagraph(int(node['netuid']))
        neuron = metagraph.by_hotkey(node['hotkey']) if metagraph else None
        if neuron is None:
            return {**head, 'registered': False, 'uid': None, 'served_endpoint': None,
                    'endpoint_matches': False, 'validator_permit': None, 'rank': None,
                    'incentive': None, 'dividends': None}
        return {**head, 'registered': True, 'uid': neuron.uid, 'served_endpoint': neuron.axon,
                'endpoint_matches': bool(node['container_endpoint'] and neuron.axon == node['container_endpoint']),
                'validator_permit': neuron.validator_permit, 'rank': neuron.rank,
                'incentive': neuron.incentive, 'dividends': neuron.dividends}


@router.get('/nodes/{node_id}/chain')
@bounded
async def node_chain_status(node_id: str):
    return await observe(await asyncio.to_thread(snapshot, node_id))


def serve_identity(node, dev_hotkey):
    if node['role'] != 'miner' or node['status'] != 'running' or node['health'] != 'healthy' or not node['container_endpoint']:
        raise HTTPException(409, 'A running miner with a healthy HTTP endpoint is required. HTTP health does not prove inference.')
    signer = Keypair.create_from_uri('//Alice//' + dev_hotkey)
    if signer.ss58_address != node['hotkey']:
        raise HTTPException(409, 'Development identity does not match this miner public hotkey.')
    ip, port = node['container_endpoint'].rsplit(':', 1)
    intent = bt.intents.build('serve_axon', {'netuid': int(node['netuid']), 'ip': ip, 'port': int(port)})
    return signer, intent


def fingerprint(node):
    return tuple(node[key] for key in ('id', 'hotkey', 'netuid', 'container_endpoint'))


@router.post('/nodes/{node_id}/serve-preview')
@bounded
async def preview_serve(node_id: str, body: ServePreview, request: Request):
    require_client(request)
    node = await asyncio.to_thread(snapshot, node_id)
    signer, intent = serve_identity(node, body.dev_hotkey)
    state = await observe(node)
    if not state['registered']:
        raise HTTPException(409, 'Register this miner on the local subnet first.')
    async with bt.Subtensor(ENDPOINT, fallback_endpoints=[], policy=bt.Policy(max_spend_tao=0, max_fee_tao=1, allowed_netuids=[int(node['netuid'])])) as chain:
        plan = await chain.plan(intent, signer)
    if not plan.ok:
        raise HTTPException(409, 'Endpoint publication was refused by policy preview.')
    now = time.monotonic()
    for token in list(previews):
        if previews[token]['expires'] < now:
            del previews[token]
    if len(previews) >= 32:
        raise HTTPException(429, 'Too many pending previews. Wait one minute.')
    token = secrets.token_urlsafe(32)
    previews[token] = {'fingerprint': fingerprint(node), 'dev_hotkey': body.dev_hotkey,
                       'genesis': state['genesis'], 'expires': now + 60, 'fee': plan.fee}
    return {'token': token, 'expires_in_seconds': 60, 'endpoint': node['container_endpoint'],
            'fee': str(plan.fee), 'effects': plan.effects, 'warnings': plan.warnings,
            'currently_served': state['served_endpoint']}


@router.post('/nodes/{node_id}/serve')
@bounded
async def confirm_serve(node_id: str, body: ServeConfirm, request: Request):
    require_client(request)
    async with write_lock:
        saved = previews.pop(body.token, None)
        if saved is None or time.monotonic() > saved['expires']:
            raise HTTPException(409, 'Preview expired or already used. Preview again.')
        node = await asyncio.to_thread(snapshot, node_id)
        if fingerprint(node) != saved['fingerprint']:
            raise HTTPException(409, 'Miner identity or endpoint changed. Preview again.')
        signer, intent = serve_identity(node, saved['dev_hotkey'])
        state = await observe(node)
        if not state['registered'] or state['genesis'] != saved['genesis']:
            raise HTTPException(409, 'Chain identity or miner registration changed. Preview again.')
        async with bt.Subtensor(ENDPOINT, fallback_endpoints=[], policy=bt.Policy(max_spend_tao=0, max_fee_tao=1, allowed_netuids=[int(node['netuid'])])) as chain:
            plan = await chain.plan(intent, signer)
            if not plan.ok or plan.fee > saved['fee']:
                raise HTTPException(409, 'Policy or estimated fee changed. Preview again.')
            result = await chain.execute(intent, signer)
            if not result.success:
                raise HTTPException(409, {'code': str(result.error.code) if result.error else 'SERVE_FAILED',
                                          'message': result.error.remediation if result.error else 'Endpoint publication failed.'})
        return {'submitted': True, 'block_hash': result.block_hash, 'endpoint': node['container_endpoint'],
                'message': 'Transaction included. Refresh chain status to verify the served endpoint.'}
