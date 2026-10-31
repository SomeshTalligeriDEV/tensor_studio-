import json
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from bitcode_runner.main import app

client = TestClient(app, headers={'Authorization': 'Bearer test-runner-token-01234567890123456789'})
FIXTURES = Path(__file__).parent / 'fixtures' / 'subcreate'


def test_live_assembly_requires_supplied_data(tmp_path):
    assert client.get('/subcreate/recipes').status_code == 404
    assert client.get('/subcreate/schema').status_code == 200
    recipe = json.loads((FIXTURES / 'recipes' / 'classify.json').read_text())
    payload = {'recipe': recipe, 'dataset': [{'input': 'First test input', 'answer': 'A'}, {'input': 'Second test input', 'answer': 'B'}]}
    assert client.post('/subcreate/assemble-live', json=payload).status_code == 403
    with patch('bitcode_runner.execution.ROOT', tmp_path):
        result = client.post('/subcreate/assemble-live', json=payload, headers={'X-Bitcode-Client': 'studio'})
        assert result.status_code == 200
        body = result.json()
        assert body['chain_status'] == 'not_deployed'
        assert body['dataset_source'] == 'user_supplied'
        project = tmp_path / body['project']
        assert json.loads((project / 'data/custom.jsonl').read_text().splitlines()[0]) == payload['dataset'][0]
        assert 'lookup.get' not in (project / 'miner.py').read_text()
        assert 'ModelClient()' in (project / 'miner.py').read_text()
        assert client.post('/subcreate/assemble-live', json={'recipe': recipe}, headers={'X-Bitcode-Client': 'studio'}).status_code == 422
        payload['dataset'][1] = payload['dataset'][0]
        assert client.post('/subcreate/assemble-live', json=payload, headers={'X-Bitcode-Client': 'studio'}).status_code == 422
