import io
import json
import tarfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from bitcode_runner.main import app
from bitcode_runner import nodes
from subcreate.assemble import assemble

client = TestClient(app, headers={'Authorization': 'Bearer test-runner-token-01234567890123456789'})
FIXTURES = Path(__file__).parent / 'fixtures/subcreate'


def project(tmp_path):
    name = 'subcreate-' + 'a' * 32
    recipe = json.loads((FIXTURES / 'recipes/qa.json').read_text())
    data = [json.loads(line) for line in (FIXTURES / 'data/bittensor_faq.jsonl').read_text().splitlines()]
    assemble(recipe, tmp_path / name, data)
    return name


def test_build_context_excludes_secrets_and_rejects_changed_code(tmp_path, monkeypatch):
    monkeypatch.setattr(nodes.execution, 'ROOT', tmp_path)
    name = project(tmp_path)
    (tmp_path / name / '.env').write_text('SECRET=do-not-package')
    archive, tag = nodes.build_context(name)
    with tarfile.open(fileobj=archive) as tar:
        assert '.env' not in tar.getnames()
        assert b'USER 10001:10001' in tar.extractfile('Dockerfile').read()
    (tmp_path / name / 'miner.py').write_text('print("changed")')
    with pytest.raises(HTTPException) as error:
        nodes.build_context(name)
    assert error.value.status_code == 409


def test_build_rejects_symlink_source(tmp_path, monkeypatch):
    monkeypatch.setattr(nodes.execution, 'ROOT', tmp_path)
    name = project(tmp_path)
    miner = tmp_path / name / 'miner.py'
    contents = miner.read_text()
    miner.unlink()
    (tmp_path / 'external.py').write_text(contents)
    miner.symlink_to(tmp_path / 'external.py')
    with pytest.raises(HTTPException):
        nodes.build_context(name)


def test_launch_requires_real_configuration_and_browser_header(monkeypatch):
    monkeypatch.delenv('BITCODE_MODEL_ID', raising=False)
    body = {'project': 'subcreate-' + 'a' * 32, 'netuid': 2, 'hotkey': '5' * 48, 'validators': ['5' * 48]}
    assert client.post('/nodes/miner', json=body).status_code == 403
    with patch.object(nodes.docker, 'from_env') as docker:
        response = client.post('/nodes/miner', json=body, headers={'X-Bitcode-Client': 'studio'})
        assert response.status_code == 409
        docker.assert_not_called()
    assert client.post('/nodes/miner', json=body, headers={'Origin': 'https://foreign.test'}).status_code == 403


def test_unmanaged_container_is_not_stopped_or_read():
    docker = MagicMock()
    docker.containers.get.return_value.labels = {}
    with patch.object(nodes.docker, 'from_env', return_value=docker):
        assert client.post('/nodes/not-owned/stop', headers={'X-Bitcode-Client': 'studio'}).status_code == 403
        assert client.get('/nodes/not-owned/logs').status_code == 403
    docker.containers.get.return_value.stop.assert_not_called()
    docker.containers.get.return_value.logs.assert_not_called()


def test_metrics_unavailable_is_not_zero():
    node = MagicMock()
    node.id = 'test'; node.name = 'test'; node.labels = {}
    node.attrs = {'State': {'Status': 'running'}}
    node.stats.side_effect = nodes.DockerException('offline')
    result = nodes.describe(node, metrics=True)
    assert result['cpu_percent'] is None and result['memory_bytes'] is None
    assert result['metrics_error']


def test_validator_rejects_secret_fields_and_invalid_development_identity():
    body = {'project': 'subcreate-' + 'a' * 32, 'netuid': 2, 'dev_hotkey': 'bitcode-validator'}
    headers = {'X-Bitcode-Client': 'studio'}
    for change in [{'seed': 'private'}, {'dev_hotkey': '//Bob'}, {'submit': True}, {'netuid': 0}]:
        assert client.post('/nodes/validator', json={**body, **change}, headers=headers).status_code == 422
    assert client.post('/nodes/validator', json=body).status_code == 403


@pytest.mark.parametrize('metagraph', [None, MagicMock(neurons=[])])
def test_validator_preflight_requires_registered_identity(metagraph):
    import asyncio
    from unittest.mock import AsyncMock
    body = nodes.ValidatorLaunch(project='subcreate-' + 'a' * 32, netuid=2, dev_hotkey='bitcode-validator')
    chain = MagicMock()
    chain.subnets.metagraph = AsyncMock(return_value=metagraph)
    context = MagicMock()
    context.__aenter__ = AsyncMock(return_value=chain)
    context.__aexit__ = AsyncMock(return_value=False)
    with patch.object(nodes, 'assert_development_chain', new=AsyncMock()), patch.object(nodes.bt, 'Subtensor', return_value=context):
        with pytest.raises(HTTPException) as error:
            asyncio.run(nodes.validator_preflight(body))
        assert error.value.status_code == 409


def test_private_network_is_explicit_and_bounded(monkeypatch):
    from subcreate.skeleton import local_miner_url
    monkeypatch.delenv('BITCODE_MINER_SUBNET', raising=False)
    with pytest.raises(ValueError):
        local_miner_url('172.20.0.4:8091')
    monkeypatch.setenv('BITCODE_MINER_SUBNET', '172.20.0.0/16')
    assert local_miner_url('172.20.0.4:8091') == 'http://172.20.0.4:8091'
    for endpoint in ['172.21.0.4:8091', '169.254.169.254:80', 'example.com:80']:
        with pytest.raises(ValueError):
            local_miner_url(endpoint)
    monkeypatch.setenv('BITCODE_MINER_SUBNET', '0.0.0.0/0')
    with pytest.raises(ValueError):
        local_miner_url('8.8.8.8:80')
