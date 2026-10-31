from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from bitcode_runner.main import app


def test_chain_status_reports_real_block_without_docker():
    with patch('bitcode_runner.main.latest_block', new=AsyncMock(return_value=42)), patch('bitcode_runner.main.docker_status') as docker:
        response = TestClient(app, headers={'Authorization': 'Bearer test-runner-token-01234567890123456789'}).get('/chain/status')
    assert response.status_code == 200
    assert response.json()['block'] == 42
    assert response.json()['ready'] is True
    docker.assert_not_called()


def test_chain_status_reports_unreachable_chain_without_fabricated_block():
    with patch('bitcode_runner.main.latest_block', new=AsyncMock(return_value=None)):
        response = TestClient(app, headers={'Authorization': 'Bearer test-runner-token-01234567890123456789'}).get('/chain/status')
    assert response.status_code == 200
    assert response.json()['ready'] is False
    assert response.json()['block'] is None
