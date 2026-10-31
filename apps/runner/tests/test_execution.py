from fastapi.testclient import TestClient
from bitcode_runner.main import app
from bitcode_runner import execution
import pytest

HEADERS = {'X-Bitcode-Client': 'studio', 'Origin': execution.ORIGIN}


def test_rejects_unknown_binary_and_escape(tmp_path, monkeypatch):
    monkeypatch.setattr(execution, 'ROOT', tmp_path)
    with TestClient(app, headers={'Authorization': 'Bearer test-runner-token-01234567890123456789'}) as client:
        assert client.post('/exec', json={'binary': 'sh'}, headers=HEADERS).status_code == 400
        assert client.post('/exec', json={'binary': 'python', 'cwd': '..'}, headers=HEADERS).status_code == 400
        assert client.post('/exec', json={'binary': 'python'}).status_code == 403


def test_real_process_output_and_exit(tmp_path, monkeypatch):
    monkeypatch.setattr(execution, 'ROOT', tmp_path)
    with TestClient(app, headers={'Authorization': 'Bearer test-runner-token-01234567890123456789'}) as client:
        response = client.post('/exec', json={'binary': 'python', 'args': ['-c', 'print("runner works"); raise SystemExit(3)']}, headers=HEADERS)
        assert response.status_code == 200
        events = []
        with client.websocket_connect('/ws/exec/' + response.json()['id'], headers={'Origin': execution.ORIGIN}) as websocket:
            while True:
                event = websocket.receive_json()
                events.append(event)
                if event['type'] == 'exit':
                    break
        assert 'runner works' in ''.join(event.get('text', '') for event in events)
        assert events[-1]['code'] == 3


def test_bundled_btcli_streams_help(tmp_path, monkeypatch):
    monkeypatch.setattr(execution, 'ROOT', tmp_path)
    with TestClient(app, headers={'Authorization': 'Bearer test-runner-token-01234567890123456789'}) as client:
        response = client.post('/exec', json={'binary': 'btcli', 'args': ['--help']}, headers=HEADERS)
        assert response.status_code == 200
        output = ''
        with client.websocket_connect('/ws/exec/' + response.json()['id'], headers={'Origin': execution.ORIGIN}) as websocket:
            while True:
                event = websocket.receive_json()
                if event['type'] == 'exit':
                    assert event['code'] == 0
                    break
                assert event['type'] != 'error'
                output += event.get('text', '')
        assert 'Usage' in output
        assert 'query' in output


@pytest.mark.parametrize('endpoint', ['ws://127.0.0.1:9944', 'ws://192.0.2.1:9944'])
def test_subprocess_uses_configured_chain(tmp_path, monkeypatch, endpoint):
    monkeypatch.setenv('CHAIN_WS', endpoint)
    monkeypatch.setattr(execution, 'ROOT', tmp_path)
    headers = HEADERS
    with TestClient(app, headers={'Authorization': 'Bearer test-runner-token-01234567890123456789'}) as client:
        response = client.post('/exec', json={'binary': 'python', 'args': ['-c', 'import os; print(os.environ["BT_NETWORK"], os.environ["BT_FALLBACK_ENDPOINTS"])']}, headers=headers)
        output = ''
        with client.websocket_connect('/ws/exec/' + response.json()['id'], headers={'Origin': execution.ORIGIN}) as websocket:
            while True:
                event = websocket.receive_json()
                if event['type'] == 'exit':
                    assert event['code'] == 0
                    break
                output += event.get('text', '')
        assert f'{endpoint} none' in output
