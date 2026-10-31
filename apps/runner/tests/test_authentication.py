import pytest
from fastapi import FastAPI, WebSocket
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from bitcode_runner.authentication import RunnerAuthenticationMiddleware

TOKEN = 'test-runner-token-01234567890123456789'
ORIGIN = 'http://localhost:5173'


def make_client(monkeypatch, token=TOKEN):
    monkeypatch.setenv('RUNNER_TOKEN', token)
    app = FastAPI()
    app.add_middleware(RunnerAuthenticationMiddleware, origin=ORIGIN)

    @app.get('/health')
    def health():
        return {'ok': True}

    @app.websocket('/ws')
    async def socket(ws: WebSocket):
        await ws.accept()
        await ws.send_json({'ok': True})
        await ws.close()

    return TestClient(app)


def test_http_requires_configured_token(monkeypatch):
    client = make_client(monkeypatch)
    assert client.get('/health').status_code == 401
    assert client.get('/health', headers={'Authorization': 'Bearer wrong'}).status_code == 401
    headers = {'X-Runner-Token': TOKEN}
    assert client.get('/health', headers=headers).status_code == 200
    assert client.get('/health', headers={**headers, 'Origin': 'https://evil.example'}).status_code == 403
    assert client.get('/health', headers={**headers, 'Origin': ORIGIN}).status_code == 200
    monkeypatch.delenv('RUNNER_TOKEN')
    assert client.get('/health', headers=headers).status_code == 503


@pytest.mark.parametrize('protocols,origin', [([], ORIGIN), (['runner-token.wrong'], ORIGIN), ([f'runner-token.{TOKEN}'], 'https://evil.example'), ([f'runner-token.{TOKEN}'], None)])
def test_websocket_rejects_missing_wrong_token_and_origin(monkeypatch, protocols, origin):
    client = make_client(monkeypatch)
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect('/ws', subprotocols=protocols, headers={'Origin': origin} if origin else {}):
            pass


def test_websocket_accepts_token_subprotocol(monkeypatch):
    client = make_client(monkeypatch)
    with client.websocket_connect('/ws', subprotocols=[f'runner-token.{TOKEN}'], headers={'Origin': ORIGIN}) as socket:
        assert socket.accepted_subprotocol == f'runner-token.{TOKEN}'
        assert socket.receive_json() == {'ok': True}
