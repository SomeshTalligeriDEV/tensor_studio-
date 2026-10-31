"""Unit tests use an explicit HTTP test transport, never production fallback data."""
import asyncio
import importlib.util
import json
from pathlib import Path
import httpx
import pytest

SOURCE = Path(__file__).resolve().parents[1] / 'subcreate' / 'templates' / 'model_client.py'
spec = importlib.util.spec_from_file_location('model_client_under_test', SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def configured(monkeypatch):
    monkeypatch.setenv('BITCODE_MODEL_BASE_URL', 'https://inference.example/v1')
    monkeypatch.setenv('BITCODE_MODEL_ID', 'test-model')
    monkeypatch.setenv('BITCODE_MODEL_API_KEY', 'test-only-key')
    return module.ModelClient()


def test_missing_configuration_and_unencrypted_remote_refused(monkeypatch):
    for key in ['BITCODE_MODEL_ID', 'BITCODE_MODEL_API_KEY', 'BITCODE_MODEL_BASE_URL']:
        monkeypatch.delenv(key, raising=False)
    with pytest.raises(module.InferenceUnavailable, match='No fallback'):
        module.ModelClient()
    monkeypatch.setenv('BITCODE_MODEL_BASE_URL', 'http://example.com/v1')
    with pytest.raises(module.InferenceUnavailable, match='HTTPS'):
        module.ModelClient()


def test_actual_request_contract_and_provider_failure(monkeypatch):
    model = configured(monkeypatch)
    real_client = httpx.AsyncClient
    requests = []
    def handle(request):
        requests.append(json.loads(request.content))
        assert request.headers['authorization'] == 'Bearer test-only-key'
        return httpx.Response(200, json={'choices': [{'message': {'content': 'label-A'}}]})
    monkeypatch.setattr(module.httpx, 'AsyncClient', lambda **kwargs: real_client(transport=httpx.MockTransport(handle), **kwargs))
    assert asyncio.run(model.answer('classify', 'previously unseen input', ['label-A', 'label-B'])) == 'label-A'
    assert requests[0]['messages'][1]['content'] == 'previously unseen input'
    assert requests[0]['model'] == 'test-model'
    def failure(request):
        return httpx.Response(503, text='private provider diagnostics with test-only-key')
    monkeypatch.setattr(module.httpx, 'AsyncClient', lambda **kwargs: real_client(transport=httpx.MockTransport(failure), **kwargs))
    with pytest.raises(module.InferenceUnavailable, match='No substitute') as error:
        asyncio.run(model.answer('qa', 'question', []))
    assert 'test-only-key' not in str(error.value)


def test_invalid_label_is_a_failure_not_a_guessed_label(monkeypatch):
    model = configured(monkeypatch)
    real_client = httpx.AsyncClient
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={'choices': [{'message': {'content': 'not in labels'}}]}))
    monkeypatch.setattr(module.httpx, 'AsyncClient', lambda **kwargs: real_client(transport=transport, **kwargs))
    with pytest.raises(module.InferenceUnavailable):
        asyncio.run(model.answer('classify', 'input', ['A', 'B']))
