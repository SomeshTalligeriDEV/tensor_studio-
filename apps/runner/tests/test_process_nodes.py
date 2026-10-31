"""Local supervisor tests: real child processes, no chain or Docker."""
from contextlib import asynccontextmanager
import json
from pathlib import Path
import sys
import time

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from bitcode_runner import process_nodes as nodes
from bitcode_runner import execution
from subcreate.assemble import assemble

HEADERS = {'X-Bitcode-Client': 'studio'}
PROJECT = 'subcreate-' + 'a' * 32
BODY = {'project': PROJECT, 'netuid': 1, 'hotkey': '5' * 48, 'validators': ['5' * 48]}


@pytest.fixture
def client():
    @asynccontextmanager
    async def lifespan(app):
        yield
        await nodes.shutdown()
    app = FastAPI(lifespan=lifespan)
    app.include_router(nodes.router)
    with TestClient(app, headers={'Authorization': 'Bearer test-runner-token-01234567890123456789'}) as value:
        yield value


def fixture_plan(tmp_path, monkeypatch, source):
    script = tmp_path / 'fixture.py'
    script.write_text(source)
    def prepare(body, role):
        return nodes.LaunchPlan([sys.executable, '-I', str(script)], tmp_path,
                                {'PATH': '/usr/bin:/bin', 'TEST_SECRET': 'secret-fixture-key'},
                                ['secret-fixture-key'])
    monkeypatch.setattr(nodes, 'prepare', prepare)


def wait_for(client, identifier, predicate):
    until = time.monotonic() + 5
    while time.monotonic() < until:
        result = client.get('/process-nodes/' + identifier).json()
        if predicate(result):
            return result
        time.sleep(.03)
    pytest.fail('Process state did not settle: ' + str(result))


def test_real_process_stop_restart_and_redacted_logs(client, tmp_path, monkeypatch):
    fixture_plan(tmp_path, monkeypatch, 'import os,time\nprint(os.environ["TEST_SECRET"], flush=True)\ntime.sleep(30)\n')
    response = client.post('/process-nodes/miner', json=BODY, headers=HEADERS)
    assert response.status_code == 200
    identifier = response.json()['id']
    assert response.json()['chain_status'] == 'registration_and_serving_not_verified'
    wait_for(client, identifier, lambda value: value['status'] == 'running')
    time.sleep(.1)
    logs = client.get(f'/process-nodes/{identifier}/logs').json()['text']
    assert 'secret-fixture-key' not in logs
    assert '[redacted]' in logs
    stopped = client.post(f'/process-nodes/{identifier}/stop', headers=HEADERS).json()
    assert stopped['status'] == 'stopped'
    restarted = client.post(f'/process-nodes/{identifier}/start', headers=HEADERS).json()
    assert restarted['status'] == 'running'
    assert len(client.get('/process-nodes').json()['nodes']) == 1


def test_exit_failure_is_reported_and_not_restarted(client, tmp_path, monkeypatch):
    fixture_plan(tmp_path, monkeypatch, 'raise SystemExit(7)\n')
    identifier = client.post('/process-nodes/miner', json=BODY, headers=HEADERS).json()['id']
    result = wait_for(client, identifier, lambda value: value['status'] == 'failed')
    assert result['exit_code'] == 7
    assert result['health'] == 'unavailable'


def test_requests_cannot_inject_commands_or_skip_client_header(client):
    assert client.post('/process-nodes/miner', json=BODY).status_code == 403
    assert client.post('/process-nodes/miner', json={**BODY, 'command': 'sh'}, headers=HEADERS).status_code == 422
    assert client.post('/process-nodes/miner', json={**BODY, 'project': '../outside'}, headers=HEADERS).status_code == 422
    assert client.get('/process-nodes/not-owned').status_code == 404


def test_reviewed_snapshot_rejects_modified_sources(tmp_path, monkeypatch):
    monkeypatch.setattr(execution, 'ROOT', tmp_path)
    recipe = json.loads((Path(__file__).parent / 'fixtures/subcreate/recipes/qa.json').read_text())
    project = tmp_path / PROJECT
    assemble(recipe, project, [json.loads(line) for line in (Path(__file__).parent / 'fixtures/subcreate/data/bittensor_faq.jsonl').read_text().splitlines()])
    (project / 'miner.py').write_text('raise RuntimeError("untrusted")')
    with pytest.raises(nodes.HTTPException) as error:
        nodes.reviewed_files(PROJECT)
    assert error.value.status_code == 409


def test_reviewed_snapshot_excludes_extra_files(tmp_path, monkeypatch):
    monkeypatch.setattr(execution, 'ROOT', tmp_path)
    recipe = json.loads((Path(__file__).parent / 'fixtures/subcreate/recipes/qa.json').read_text())
    project = tmp_path / PROJECT
    assemble(recipe, project, [json.loads(line) for line in (Path(__file__).parent / 'fixtures/subcreate/data/bittensor_faq.jsonl').read_text().splitlines()])
    (project / 'sitecustomize.py').write_text('raise RuntimeError("untrusted")')
    (project / '.env').write_text('FAKE_SECRET=do-not-copy')
    files = nodes.reviewed_files(PROJECT)
    assert '.env' not in files and 'sitecustomize.py' not in files
    assert 'miner.py' in files


def test_output_limit_stops_noisy_process(client, tmp_path, monkeypatch):
    fixture_plan(tmp_path, monkeypatch, 'import sys,time\nfor _ in range(10000): print("x" * 1000, flush=True)\ntime.sleep(30)\n')
    monkeypatch.setattr(nodes, 'MAX_OUTPUT', 4096)
    identifier = client.post('/process-nodes/miner', json=BODY, headers=HEADERS).json()['id']
    result = wait_for(client, identifier, lambda value: value['status'] == 'failed')
    assert result['error']
    assert len(client.get(f'/process-nodes/{identifier}/logs').json()['text']) <= 4096


def test_runtime_limit_stops_process(client, tmp_path, monkeypatch):
    fixture_plan(tmp_path, monkeypatch, 'import time\ntime.sleep(30)\n')
    monkeypatch.setattr(nodes, 'MAX_RUNTIME', .1)
    identifier = client.post('/process-nodes/miner', json=BODY, headers=HEADERS).json()['id']
    result = wait_for(client, identifier, lambda value: value['status'] == 'failed')
    assert 'runtime limit' in result['error']


def test_concurrent_starts_launch_only_one_child(tmp_path, monkeypatch):
    import asyncio
    fixture_plan(tmp_path, monkeypatch, 'import time\ntime.sleep(30)\n')
    async def run():
        body = nodes.MinerLaunch(**BODY)
        node = nodes.Node('test', 'miner', body, nodes.prepare(body, 'miner'))
        original = nodes.asyncio.create_subprocess_exec
        children = []
        async def record(*args, **kwargs):
            child = await original(*args, **kwargs)
            children.append(child)
            return child
        monkeypatch.setattr(nodes.asyncio, 'create_subprocess_exec', record)
        try:
            await asyncio.gather(nodes.start_node(node), nodes.start_node(node))
            assert len(children) == 1
        finally:
            for child in children:
                if child.returncode is None:
                    child.kill()
                await child.wait()
            if node.task:
                await node.task
    asyncio.run(run())


def test_real_generated_cli_runs_in_clean_private_snapshot(tmp_path, monkeypatch):
    import subprocess
    import shutil
    from bittensor.keyfiles import Keypair
    monkeypatch.setattr(execution, 'ROOT', tmp_path)
    recipe = json.loads((Path(__file__).parent / 'fixtures/subcreate/recipes/qa.json').read_text())
    dataset = [json.loads(line) for line in (Path(__file__).parent / 'fixtures/subcreate/data/bittensor_faq.jsonl').read_text().splitlines()]
    assemble(recipe, tmp_path / PROJECT, dataset)
    monkeypatch.setenv('BITCODE_MODEL_BASE_URL', 'http://127.0.0.1:8765/v1')
    monkeypatch.setenv('BITCODE_MODEL_ID', 'test-model')
    monkeypatch.setenv('BITCODE_MODEL_API_KEY', 'fake-test-key')
    monkeypatch.setenv('UNRELATED_SECRET', 'do-not-inherit')
    address = Keypair.create_from_uri('//Alice').ss58_address
    plan = nodes.prepare(nodes.MinerLaunch(**{**BODY, 'hotkey': address, 'validators': [address]}), 'miner')
    try:
        assert 'UNRELATED_SECRET' not in plan.environment
        assert Path(plan.environment['HOME']).is_relative_to(plan.directory)
        assert not (plan.directory / '.env').exists()
        result = subprocess.run([*plan.command, '--help'], cwd=plan.directory, env=plan.environment,
                                capture_output=True, text=True, timeout=10)
        assert result.returncode == 0, result.stderr
        assert '--validator' in result.stdout
        assert 'fake-test-key' not in result.stdout + result.stderr
    finally:
        shutil.rmtree(plan.directory)


def test_oversized_unterminated_log_line_is_stopped_without_exposure(client, tmp_path, monkeypatch):
    fixture_plan(tmp_path, monkeypatch, 'import os,time\nos.write(1, b"x" * 2000000)\ntime.sleep(30)\n')
    identifier = client.post('/process-nodes/miner', json=BODY, headers=HEADERS).json()['id']
    result = wait_for(client, identifier, lambda value: value['status'] == 'failed')
    assert 'safely' in result['error']
    assert client.get(f'/process-nodes/{identifier}/logs').json()['text'] == ''


def test_main_app_integrates_local_nodes_and_stops_on_shutdown(tmp_path, monkeypatch):
    from bitcode_runner.main import app
    fixture_plan(tmp_path, monkeypatch, 'import time\ntime.sleep(30)\n')
    with TestClient(app, headers={'Authorization': 'Bearer test-runner-token-01234567890123456789'}) as app_client:
        assert app_client.get('/process-nodes').status_code == 200
        response = app_client.post('/process-nodes/miner', json=BODY, headers=HEADERS)
        assert response.status_code == 200
        child = nodes.registry[response.json()['id']].process
        assert child.returncode is None
        denied = app_client.post('/process-nodes/miner', json=BODY,
                                 headers={**HEADERS, 'Origin': 'https://foreign.test'})
        assert denied.status_code == 403
    assert child.returncode is not None
    assert nodes.registry == {}


def test_validator_uses_configured_chain_and_rejects_live_before_signing(tmp_path, monkeypatch):
    import asyncio
    import runpy
    from types import SimpleNamespace
    monkeypatch.setattr(execution, 'ROOT', tmp_path)
    recipe = json.loads((Path(__file__).parent / 'fixtures/subcreate/recipes/qa.json').read_text())
    dataset = [json.loads(line) for line in (Path(__file__).parent / 'fixtures/subcreate/data/bittensor_faq.jsonl').read_text().splitlines()]
    folder = tmp_path / PROJECT
    assemble(recipe, folder, dataset)
    monkeypatch.setenv('CHAIN_WS', 'ws://192.0.2.1:9944')
    monkeypatch.delenv('BITCODE_CHAIN_ENDPOINT', raising=False)
    monkeypatch.syspath_prepend(str(folder))
    module = runpy.run_path(str(folder / 'validator.py'))
    assert module['CHAIN_ENDPOINT'] == 'ws://192.0.2.1:9944'
    calls = []
    class Socket:
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def send(self, value): calls.append(json.loads(value)['method'])
        async def recv(self): return json.dumps({'result': 'Live'})
    def connect(endpoint, **kwargs):
        assert endpoint == 'ws://192.0.2.1:9944'
        return Socket()
    def signer(args):
        pytest.fail('Signer must not be loaded before verifying a development chain.')
    namespace = module['run'].__globals__
    monkeypatch.setitem(namespace, 'connect', connect)
    monkeypatch.setitem(namespace, 'validator_signer', signer)
    with pytest.raises(RuntimeError, match='development chains only'):
        asyncio.run(module['run'](SimpleNamespace(rounds=1, interval=1, netuid=1)))
    assert calls == ['system_chainType']
    plan = nodes.prepare(nodes.ValidatorLaunch(project=PROJECT, netuid=1, dev_hotkey='bitcode-validator'), 'validator')
    try:
        assert plan.environment['BITCODE_CHAIN_ENDPOINT'] == 'ws://192.0.2.1:9944'
        assert '--submit' not in plan.command
    finally:
        __import__('shutil').rmtree(plan.directory)
