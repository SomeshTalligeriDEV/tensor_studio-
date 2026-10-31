import asyncio
import json
from unittest.mock import AsyncMock
from types import SimpleNamespace

import bittensor as bt
import httpx
import pytest
from bittensor.keyfiles import Keypair
from fastapi.testclient import TestClient
from subcreate.skeleton import create_miner, query_miner, discover_miners, local_miner_url, preview_weights

validator = Keypair.create_from_uri('//Alice')
miner = Keypair.create_from_uri('//Bob')


def setup():
    return create_miner(miner.ss58_address, {validator.ss58_address}, lambda text: 'answer: ' + text)


def signed(body=b'{"input":"hello"}', receiver=None, path='/task', signer=validator):
    return bt.http_auth.sign(signer, method='POST', path=path, body=body, receiver_ss58=receiver or miner.ss58_address)


def test_signed_miner_validator_roundtrip():
    answer = asyncio.run(query_miner(validator, miner.ss58_address, '127.0.0.1:8091', 'Bittensor', transport=httpx.ASGITransport(app=setup())))
    assert answer == 'answer: Bittensor'


def test_replay_tampering_wrong_receiver_and_untrusted_validator():
    client = TestClient(setup())
    body = b'{"input":"hello"}'
    headers = signed(body)
    assert client.post('/task', content=body, headers=headers).status_code == 200
    assert client.post('/task', content=body, headers=headers).status_code == 401
    assert client.post('/task', content=b'{"input":"changed"}', headers=signed(body)).status_code == 401
    assert client.post('/task', content=body, headers=signed(body, receiver=validator.ss58_address)).status_code == 401
    assert client.post('/task', content=body, headers=signed(body, signer=miner)).status_code == 403
    assert client.post('/task?x=1', content=body, headers=signed(body)).status_code == 401
    assert client.post('/task?x=1', content=body, headers=signed(body, path='/task?x=1')).status_code == 200


def test_limits_and_strict_payload():
    client = TestClient(setup())
    assert client.post('/task', content=b'x' * 17000).status_code == 413
    for payload in ({'input': ''}, {'input': 'hello', 'code': 'print(1)'}, {'input': 12}):
        body = json.dumps(payload).encode()
        assert client.post('/task', content=body, headers=signed(body)).status_code == 422


def test_local_endpoint_guard():
    assert local_miner_url('127.0.0.1:8091') == 'http://127.0.0.1:8091'
    for endpoint in ['example.com:80', '10.0.0.1:8091', '127.0.0.1:8091/path', 'user@127.0.0.1:8091', '127.0.0.1:0']:
        with pytest.raises(ValueError):
            local_miner_url(endpoint)


def test_v11_discovery_and_weight_preview():
    neurons = [SimpleNamespace(uid=1, hotkey=miner.ss58_address, axon='127.0.0.1:8091'), SimpleNamespace(uid=2, hotkey='unused', axon=None)]
    chain = SimpleNamespace(subnets=SimpleNamespace(metagraph=AsyncMock(return_value=SimpleNamespace(neurons=neurons))), plan=AsyncMock(return_value='preview'))
    assert asyncio.run(discover_miners(chain, 1))[0].uid == 1
    assert asyncio.run(preview_weights(chain, validator, 1, {1: 1.0})) == 'preview'
    intent = chain.plan.call_args.args[0]
    assert isinstance(intent, bt.SetWeights)
    assert intent.uids == [1]
