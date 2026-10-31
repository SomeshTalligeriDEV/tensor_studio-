from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
import time

import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
from bittensor.keyfiles import Keypair
from bitcode_runner.main import app
from bitcode_runner import node_chain as module

client = TestClient(app, headers={'Authorization': 'Bearer test-runner-token-01234567890123456789'})
HEADERS = {'X-Bitcode-Client': 'studio'}


def miner():
    return {'id': 'node1', 'role': 'miner', 'status': 'running', 'health': 'healthy',
            'hotkey': Keypair.create_from_uri('//Alice//bitcode-miner').ss58_address,
            'netuid': '2', 'container_endpoint': '172.20.0.4:8091'}


@pytest.fixture(autouse=True)
def clear_previews():
    module.previews.clear()
    yield
    module.previews.clear()


def test_only_healthy_matching_development_miner_can_publish():
    for changed in [{'role': 'validator'}, {'health': 'unhealthy'}, {'status': 'exited'}, {'container_endpoint': None}]:
        with pytest.raises(HTTPException):
            module.serve_identity({**miner(), **changed}, 'bitcode-miner')
    with pytest.raises(HTTPException):
        module.serve_identity(miner(), 'bitcode-someone-else')


def test_expired_preview_and_replay_cannot_execute():
    token = 'a' * 43
    module.previews[token] = {'expires': time.monotonic() - 1}
    with patch.object(module, 'snapshot') as snapshot:
        for _ in range(2):
            result = client.post('/nodes/node1/serve', headers=HEADERS, json={'token': token})
            assert result.status_code == 409
        snapshot.assert_not_called()


def test_changed_container_endpoint_invalidates_preview():
    node = miner()
    token = 'a' * 43
    module.previews[token] = {'expires': time.monotonic() + 60, 'fingerprint': module.fingerprint(node)}
    with patch.object(module, 'snapshot', return_value={**node, 'container_endpoint': '172.20.0.9:8091'}), patch.object(module, 'observe', new=AsyncMock()) as observe:
        result = client.post('/nodes/node1/serve', headers=HEADERS, json={'token': token})
        assert result.status_code == 409
        observe.assert_not_called()


def test_preview_has_no_write_and_changed_fee_requires_new_preview():
    node = miner()
    chain = SimpleNamespace(plan=AsyncMock(return_value=SimpleNamespace(ok=True, fee=1, effects=['serve endpoint'], warnings=[])), execute=AsyncMock())
    context = AsyncMock()
    context.__aenter__.return_value = chain
    observed = {'registered': True, 'genesis': '0xchain', 'served_endpoint': '127.0.0.2:8091'}
    with patch.object(module, 'snapshot', return_value=node), patch.object(module, 'observe', new=AsyncMock(return_value=observed)), patch.object(module.bt, 'Subtensor', return_value=context):
        preview = client.post('/nodes/node1/serve-preview', headers=HEADERS, json={'dev_hotkey': 'bitcode-miner'})
        assert preview.status_code == 200, preview.text
        chain.execute.assert_not_called()
        chain.plan.return_value.fee = 2
        response = client.post('/nodes/node1/serve', headers=HEADERS, json={'token': preview.json()['token']})
        assert response.status_code == 409
        chain.execute.assert_not_called()


def test_serve_routes_require_origin_header_and_reject_private_material():
    assert client.post('/nodes/node1/serve-preview', json={'dev_hotkey': 'bitcode-miner'}).status_code == 403
    assert client.post('/nodes/node1/serve-preview', headers={'Origin': 'https://foreign.test'}, json={'dev_hotkey': 'bitcode-miner'}).status_code == 403
    assert client.post('/nodes/node1/serve-preview', headers=HEADERS, json={'dev_hotkey': 'bitcode-miner', 'seed': 'secret'}).status_code == 422


def test_confirm_executes_exact_preview_once():
    node = miner()
    chain = SimpleNamespace(plan=AsyncMock(return_value=SimpleNamespace(ok=True, fee=1, effects=['serve endpoint'], warnings=[])),
                            execute=AsyncMock(return_value=SimpleNamespace(success=True, block_hash='0xblock')))
    context = AsyncMock()
    context.__aenter__.return_value = chain
    observed = {'registered': True, 'genesis': '0xchain', 'served_endpoint': None}
    with patch.object(module, 'snapshot', return_value=node), patch.object(module, 'observe', new=AsyncMock(return_value=observed)), patch.object(module.bt, 'Subtensor', return_value=context):
        preview = client.post('/nodes/node1/serve-preview', headers=HEADERS, json={'dev_hotkey': 'bitcode-miner'}).json()
        response = client.post('/nodes/node1/serve', headers=HEADERS, json={'token': preview['token']})
        assert response.status_code == 200, response.text
        assert response.json()['submitted'] is True
        assert response.json()['endpoint'] == node['container_endpoint']
        chain.execute.assert_awaited_once()
        assert client.post('/nodes/node1/serve', headers=HEADERS, json={'token': preview['token']}).status_code == 409
        chain.execute.assert_awaited_once()


@pytest.mark.parametrize('changed', [{'registered': False}, {'genesis': '0xnewchain'}])
def test_changed_chain_or_registration_blocks_confirmation(changed):
    node = miner()
    token = 'a' * 43
    module.previews[token] = {'expires': time.monotonic() + 60, 'fingerprint': module.fingerprint(node),
                              'genesis': '0xchain', 'dev_hotkey': 'bitcode-miner'}
    observed = {'registered': True, 'genesis': '0xchain', **changed}
    with patch.object(module, 'snapshot', return_value=node), patch.object(module, 'observe', new=AsyncMock(return_value=observed)), patch.object(module.bt, 'Subtensor') as chain:
        assert client.post('/nodes/node1/serve', headers=HEADERS, json={'token': token}).status_code == 409
        chain.assert_not_called()
