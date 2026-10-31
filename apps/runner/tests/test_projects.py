import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from bitcode_runner.main import app
from bitcode_runner import execution
from bitcode_runner.projects import resolve_file


def test_roundtrip_and_write_auth(tmp_path, monkeypatch):
    monkeypatch.setattr(execution, 'ROOT', tmp_path)
    with TestClient(app, headers={'Authorization': 'Bearer test-runner-token-01234567890123456789'}) as client:
        url = '/projects/demo/files/src/miner.py'
        assert client.put(url, json={'content': 'hello'}).status_code == 403
        assert client.put(url, json={'content': 'print("hello")'}, headers={'X-Bitcode-Client': 'studio'}).status_code == 200
        assert client.get(url).json() == {'content': 'print("hello")'}
        assert client.get('/projects/demo/files/missing.py').status_code == 404


def test_traversal_and_symlinks(tmp_path, monkeypatch):
    monkeypatch.setattr(execution, 'ROOT', tmp_path / 'projects')
    for project, path in [('..', 'x'), ('demo', '../secret'), ('demo', '/tmp/secret')]:
        with pytest.raises(HTTPException):
            resolve_file(project, path)
    root = execution.ROOT / 'demo'
    root.mkdir(parents=True)
    (root / 'outside').symlink_to(tmp_path, target_is_directory=True)
    with pytest.raises(HTTPException):
        resolve_file('demo', 'outside/secret')


def test_saved_project_runs_and_streams(tmp_path, monkeypatch):
    monkeypatch.setattr(execution, 'ROOT', tmp_path)
    headers = {'X-Bitcode-Client': 'studio', 'Origin': execution.ORIGIN}
    with TestClient(app, headers={'Authorization': 'Bearer test-runner-token-01234567890123456789'}) as client:
        saved = client.put('/projects/project-roundtrip/files/main.py', json={'content': 'print("synced project works")'}, headers=headers)
        assert saved.status_code == 200
        job = client.post('/exec', json={'binary': 'python', 'args': ['main.py'], 'cwd': 'project-roundtrip'}, headers=headers)
        assert job.status_code == 200
        output = ''
        with client.websocket_connect('/ws/exec/' + job.json()['id'], headers={'Origin': execution.ORIGIN}) as websocket:
            while True:
                event = websocket.receive_json()
                if event['type'] == 'exit':
                    assert event['code'] == 0
                    break
                output += event.get('text', '')
        assert 'synced project works' in output
