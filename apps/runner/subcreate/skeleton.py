"""Bittensor v11 signed-HTTP skeleton. No Axon/Synapse dependencies.

The miner gets only its public hotkey and an explicit validator allowlist.
Task handlers are supplied by reviewed blocks. Chain writes are preview-only
until launch integration supplies a registered validator and user approval.
"""
import inspect
import ipaddress
import json
import os
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from urllib.parse import urlsplit

import bittensor as bt
import httpx
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError

MAX_BODY = 16 * 1024


class TaskRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    input: str = Field(min_length=1, max_length=4096)


class TaskResponse(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    answer: str = Field(max_length=4096)


def create_miner(hotkey: str, allowed_validators: set[str], handler: Callable[[str], str | Awaitable[str]]) -> FastAPI:
    app = FastAPI(title='Bitcode v11 miner')
    nonces = bt.http_auth.InMemoryNonceStore()
    allowed = frozenset(allowed_validators)

    @app.get('/health')
    async def health():
        return {'process': 'ready', 'inference': 'not_probed'}

    @app.post('/task')
    async def task(request: Request):
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > MAX_BODY:
                raise HTTPException(413, 'Task exceeds the 16 KiB request limit.')
        raw = bytes(body)
        target = request.scope['raw_path'].decode('ascii')
        if request.scope['query_string']:
            target += '?' + request.scope['query_string'].decode('ascii')
        try:
            caller = bt.http_auth.verify(request.headers, raw, method=request.method,
                                         path=target, self_hotkey_ss58=hotkey, nonce_store=nonces)
        except bt.http_auth.AuthError as error:
            raise HTTPException(401, str(error))
        if caller.hotkey_ss58 not in allowed:
            raise HTTPException(403, 'Validator is not in this miner\'s allowlist.')
        try:
            payload = TaskRequest.model_validate_json(raw)
        except ValidationError:
            raise HTTPException(422, 'Task must contain one non-empty input string (up to 4096 characters).')
        # The handler is a fixed reviewed block, never generated Python from a prompt.
        answer = handler(payload.input)
        if inspect.isawaitable(answer):
            answer = await answer
        try:
            return TaskResponse(answer=answer).model_dump()
        except ValidationError:
            raise HTTPException(500, 'Task block returned an invalid answer.')

    return app


def local_miner_url(endpoint: str) -> str:
    """This first skeleton supports localnet only, with no redirects/proxies."""
    url = urlsplit('http://' + endpoint)
    try:
        address = ipaddress.ip_address(url.hostname or '')
        valid = address.is_loopback
        configured = os.getenv('BITCODE_MINER_SUBNET', '')
        if configured:
            network = ipaddress.ip_network(configured)
            private_ranges = [ipaddress.ip_network(value) for value in ('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16')]
            if network.version != 4 or network.prefixlen < 16 or not any(network.subnet_of(value) for value in private_ranges):
                raise ValueError('Expected a bounded private Docker network')
            valid = valid or address in network
        port = url.port
    except ValueError:
        valid, port = False, None
    if not valid or not port or url.username or url.password or url.path or url.query or url.fragment:
        raise ValueError('Localnet miner must advertise a loopback or configured Docker subnet IP and port.')
    return f'http://{endpoint}'


async def query_miner(wallet, receiver: str, endpoint: str, task_input: str,
                      *, transport: httpx.AsyncBaseTransport | None = None, timeout: float = 30) -> str:
    payload = TaskRequest(input=task_input)
    body = json.dumps(payload.model_dump(), ensure_ascii=False, separators=(',', ':')).encode()
    headers = bt.http_auth.sign(wallet, method='POST', path='/task', body=body, receiver_ss58=receiver)
    headers['Content-Type'] = 'application/json'
    async with httpx.AsyncClient(transport=transport, timeout=timeout, follow_redirects=False, trust_env=False) as client:
        async with client.stream('POST', local_miner_url(endpoint) + '/task', content=body, headers=headers) as response:
            response.raise_for_status()
            received = bytearray()
            async for chunk in response.aiter_bytes():
                received.extend(chunk)
                if len(received) > MAX_BODY:
                    raise ValueError('Miner response exceeds the 16 KiB limit.')
            return TaskResponse.model_validate_json(bytes(received)).answer


@dataclass(frozen=True)
class MinerEndpoint:
    uid: int
    hotkey: str
    endpoint: str


async def discover_miners(chain, netuid: int) -> list[MinerEndpoint]:
    metagraph = await chain.subnets.metagraph(netuid)
    miners = []
    for neuron in metagraph.neurons:
        if not neuron.axon:
            continue
        try:
            local_miner_url(neuron.axon)
        except ValueError:
            continue
        miners.append(MinerEndpoint(neuron.uid, neuron.hotkey, neuron.axon))
    return miners


async def preview_weights(chain, wallet, netuid: int, scores: dict[int, float]):
    """Use v11 policy/preflight; never submit from this foundation helper."""
    return await chain.plan(bt.SetWeights(netuid=netuid, weights=scores), wallet)
