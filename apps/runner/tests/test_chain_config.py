import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from bitcode_runner.chain_config import chain_endpoint
from bitcode_runner import funding


@pytest.mark.parametrize('endpoint', [
    'https://example.org', 'ws://user:secret@example.org',
    'wss://example.org?key=secret', 'ws://example.org#secret',
    'ws://example.org:invalid', '',
])
def test_invalid_endpoints_rejected_without_disclosing_value(monkeypatch, endpoint):
    monkeypatch.setenv('CHAIN_WS', endpoint)
    with pytest.raises(HTTPException) as error:
        chain_endpoint()
    assert error.value.status_code == 409
    assert 'secret' not in error.value.detail


def test_default_is_loopback(monkeypatch):
    monkeypatch.delenv('CHAIN_WS', raising=False)
    assert chain_endpoint() == 'ws://127.0.0.1:9944'


def test_funding_checks_configured_chain_before_creating_signer(monkeypatch):
    endpoint = 'ws://192.0.2.1:9944'
    monkeypatch.setenv('CHAIN_WS', endpoint)
    guard = AsyncMock(side_effect=HTTPException(403, 'Not development'))
    with patch.object(funding, 'assert_development_chain', guard), patch.object(funding.Keypair, 'create_from_uri') as signer:
        with pytest.raises(HTTPException):
            asyncio.run(funding.fund('unused'))
        guard.assert_awaited_once_with(endpoint, None)
        signer.assert_not_called()
