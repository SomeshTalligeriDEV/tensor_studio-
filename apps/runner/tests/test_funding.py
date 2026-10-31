from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from bitcode_runner.main import app

client = TestClient(app, headers={'Authorization': 'Bearer test-runner-token-01234567890123456789'})
ALICE = '5GrwvaEF5zXb26Fz9rcQpDWS64bBXdYZ1Y4ic5wPqPpHctVb'
HEADERS = {'X-Bitcode-Client': 'studio'}


def test_funding_requires_client_header_and_rejects_foreign_origin():
    assert client.post('/localnet/fund', json={'address': ALICE}).status_code == 403
    assert client.post('/localnet/fund', json={'address': ALICE}, headers={**HEADERS, 'Origin': 'https://evil.example'}).status_code == 403


def test_funding_accepts_only_address_and_fixed_amount():
    assert client.post('/localnet/fund', json={'address': ALICE, 'amount': 999999}, headers=HEADERS).status_code == 422
    assert client.post('/localnet/fund', json={'address': 'invalid'}, headers=HEADERS).status_code == 422


def test_funding_is_serialized_and_rate_limited():
    with patch('bitcode_runner.funding.last_funded', 0), patch('bitcode_runner.funding.fund', new_callable=AsyncMock, return_value={'amount_tao': 1000}) as fund:
        assert client.post('/localnet/fund', json={'address': ALICE}, headers=HEADERS).status_code == 200
        assert client.post('/localnet/fund', json={'address': ALICE}, headers=HEADERS).status_code == 429
        fund.assert_awaited_once_with(ALICE)


def test_funding_forwards_expected_genesis():
    genesis = '0x' + 'ab' * 32
    with patch('bitcode_runner.funding.last_funded', 0), patch('bitcode_runner.funding.fund', new_callable=AsyncMock, return_value={'amount_tao': 1000}) as fund:
        assert client.post('/localnet/fund', json={'address': ALICE, 'expected_genesis': genesis}, headers=HEADERS).status_code == 200
        fund.assert_awaited_once_with(ALICE, genesis)


def test_funding_rejects_genesis_mismatch_before_signing():
    import asyncio
    import json
    import pytest
    from fastapi import HTTPException
    from unittest.mock import MagicMock
    from bitcode_runner.funding import fund
    socket = AsyncMock()
    socket.recv.side_effect = [json.dumps({'result': 'Local'}), json.dumps({'result': {'specName': 'subtensor'}}), json.dumps({'result': '0x' + 'aa' * 32})]
    context = MagicMock()
    context.__aenter__ = AsyncMock(return_value=socket)
    context.__aexit__ = AsyncMock(return_value=False)
    with patch('bitcode_runner.funding.connect', return_value=context), patch('bitcode_runner.funding.Keypair.create_from_uri') as signer:
        with pytest.raises(HTTPException) as error:
            asyncio.run(fund(ALICE, '0x' + 'bb' * 32))
        assert error.value.status_code == 409
        signer.assert_not_called()
