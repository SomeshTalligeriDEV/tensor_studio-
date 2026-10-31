import base64
import hashlib
import hmac
import json
from bitcode_runner.session_tokens import verify_session
from test_authentication import TOKEN

SECRET = 'disposable-session-secret-' + 'x' * 32
ORIGIN = 'https://studio.example.test'


def token(**changes):
    claims = dict(aud='tensorstudio-runner', sub='studio', iss=ORIGIN, scope='runner:owner', iat=1000, exp=1300)
    claims.update(changes)
    encode = lambda value: base64.urlsafe_b64encode(json.dumps(value).encode()).rstrip(b'=').decode()
    content = encode({'alg': 'HS256', 'typ': 'JWT'}) + '.' + encode(claims)
    signature = base64.urlsafe_b64encode(hmac.new(SECRET.encode(), content.encode(), hashlib.sha256).digest()).rstrip(b'=').decode()
    return content + '.' + signature


def test_claims_and_signature():
    assert verify_session(token(), SECRET, ORIGIN, now=1100)
    assert not verify_session(token(), SECRET, ORIGIN, now=1300)
    assert not verify_session(token(), SECRET, ORIGIN, now=999)
    assert not verify_session(token(), 'short', ORIGIN, now=1100)
    assert not verify_session(token(), SECRET, 'https://evil.example', now=1100)
    assert not verify_session(token()[:-3] + 'xxx', SECRET, ORIGIN, now=1100)
    for change in [dict(aud='other'), dict(scope='read'), dict(sub='other'), dict(exp=1600), dict(iat=True), dict(exp=None), dict(nbf=1200)]:
        assert not verify_session(token(**change), SECRET, ORIGIN, now=1100)
    for value in ['', 'a.b.c', 'null', 'a.' * 5000]:
        assert not verify_session(value, SECRET, ORIGIN, now=1100)


def test_remote_middleware_rejects_shared_token_and_accepts_session(monkeypatch):
    import time
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from bitcode_runner.authentication import RunnerAuthenticationMiddleware
    monkeypatch.setenv('RUNNER_TOKEN', TOKEN)
    monkeypatch.setenv('RUNNER_SESSION_SECRET', SECRET)
    app = FastAPI()
    app.add_middleware(RunnerAuthenticationMiddleware, origin=ORIGIN)
    @app.get('/health')
    def health(): return {'ok': True}
    @app.get('/healthz')
    def healthz(): return {'status': 'ok'}
    client = TestClient(app)
    assert client.get('/healthz').status_code == 200
    assert client.get('/health', headers={'Origin': ORIGIN, 'X-Runner-Token': TOKEN}).status_code == 401
    current = int(time.time())
    headers = {'Origin': ORIGIN, 'X-Runner-Token': token(iat=current, exp=current + 300)}
    assert client.get('/health', headers=headers).status_code == 200
    assert client.get('/health', headers={'X-Runner-Token': headers['X-Runner-Token']}).status_code == 401
    assert client.get('/health', headers={**headers, 'Origin': 'https://evil.example'}).status_code == 403
    monkeypatch.delenv('RUNNER_SESSION_SECRET')
    assert client.get('/health', headers=headers).status_code == 503


def test_remote_websocket_session(monkeypatch):
    import time
    import pytest
    from fastapi import FastAPI, WebSocket
    from fastapi.testclient import TestClient
    from starlette.websockets import WebSocketDisconnect
    from bitcode_runner.authentication import RunnerAuthenticationMiddleware
    monkeypatch.setenv('RUNNER_SESSION_SECRET', SECRET)
    app = FastAPI()
    app.add_middleware(RunnerAuthenticationMiddleware, origin=ORIGIN)
    @app.websocket('/ws')
    async def socket(ws: WebSocket):
        await ws.accept()
        await ws.send_json({'ok': True})
        await ws.close()
    client = TestClient(app)
    current = int(time.time())
    protocol = 'runner-token.' + token(iat=current, exp=current + 300)
    with client.websocket_connect('/ws', subprotocols=[protocol], headers={'Origin': ORIGIN}) as ws:
        assert ws.accepted_subprotocol == protocol
        assert ws.receive_json() == {'ok': True}
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect('/ws', subprotocols=[protocol], headers={'Origin': 'https://evil.example'}):
            pass
