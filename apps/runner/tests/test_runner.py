from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from bitcode_runner.main import app, change_localnet, LABEL

client = TestClient(app, headers={'Authorization': 'Bearer test-runner-token-01234567890123456789'})


def test_foreign_origin_cannot_start_container():
    response = client.post('/localnet/start', headers={'Origin': 'https://evil.example'})
    assert response.status_code == 403


def test_unmanaged_container_is_never_stopped():
    connection = MagicMock()
    connection.containers.get.return_value.labels = {}
    with patch('bitcode_runner.main.docker.from_env', return_value=connection):
        response = client.post('/localnet/stop')
    assert response.status_code == 409
    connection.containers.get.return_value.stop.assert_not_called()


def test_managed_container_can_stop():
    connection = MagicMock()
    container = connection.containers.get.return_value
    container.labels = {LABEL: 'true'}
    container.status = 'exited'
    with patch('bitcode_runner.main.docker.from_env', return_value=connection):
        assert change_localnet(False) == {'state': 'exited'}
    container.stop.assert_called_once()
    connection.close.assert_called_once()


def test_new_localnet_preserves_chain_on_restart():
    from docker.errors import NotFound
    connection = MagicMock()
    connection.containers.get.side_effect = NotFound('absent')
    connection.containers.run.return_value.status = 'running'
    with patch('bitcode_runner.main.docker.from_env', return_value=connection):
        assert change_localnet(True) == {'state': 'running'}
    assert connection.containers.run.call_args.kwargs['command'] == ['True', '--no-purge']
