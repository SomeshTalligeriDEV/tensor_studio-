"""Exercise genuine scoring with generated, controlled evaluation data."""
import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from bitcode_runner import execution, harness
from subcreate.assemble import assemble

PROJECT = 'subcreate-' + 'b' * 32
HEADERS = {'X-Bitcode-Client': 'studio'}
FIXTURES = Path(__file__).parent / 'fixtures/subcreate'


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(execution, 'ROOT', tmp_path)
    app = FastAPI()
    app.include_router(harness.router)
    with TestClient(app, headers={'Authorization': 'Bearer test-runner-token-01234567890123456789'}) as value:
        yield value


def project(tmp_path, task='qa', copy_penalty=True):
    recipe = json.loads((FIXTURES / f'recipes/{task}.json').read_text())
    if not copy_penalty:
        recipe['anti_cheat'] = ['timeout_zero']
    dataset = [{'input': 'First question', 'answer': 'alpha'}, {'input': 'Second question', 'answer': 'beta'}]
    # Pure correctness gives hand-computable fixture scores.
    recipe['scoring'] = [{'block': 'exact_or_fuzzy', 'weight': 1.0}]
    recipe['weights'] = {'block': 'ema_normalize', 'params': {'alpha': .2}}
    assemble(recipe, tmp_path / PROJECT, dataset)


def test_copycat_weakness_is_reported_not_hidden(client, tmp_path):
    project(tmp_path)
    response = client.post('/harness/run', json={'project': PROJECT, 'rounds': 2}, headers=HEADERS)
    assert response.status_code == 200, response.text
    report = response.json()
    miners = {miner['id']: miner for miner in report['miners']}
    assert miners['honest']['average_score'] == .5
    assert miners['copycat']['average_score'] == .5
    assert miners['copycat']['score_ratio_to_honest'] == 1.0
    assert miners['slow']['average_score'] == 0
    assert miners['empty']['average_score'] == 0
    checks = {check['id']: check for check in report['checks']}
    assert checks['copycat_half_honest']['status'] == 'failed'
    assert report['passed'] is False
    assert report['mode'] == 'synthetic_offline'
    assert report['latency_mode'] == 'simulated_elapsed_values'
    assert report['rounds'] == 2
    assert report['chain_used'] is False and report['live_inference'] is False
    assert client.get('/harness/' + report['id']).json() == report


def test_classification_does_not_claim_identical_labels_are_cheating(client, tmp_path):
    project(tmp_path, 'classify', copy_penalty=False)
    report = client.post('/harness/run', json={'project': PROJECT, 'rounds': 3}, headers=HEADERS).json()
    miners = {miner['id']: miner for miner in report['miners']}
    assert miners['honest']['average_score'] == 1.0
    assert miners['incorrect']['average_score'] == 0.0
    assert miners['slow']['final_weight'] == 0.0
    assert miners['honest']['final_weight'] == .5
    assert miners['copycat']['final_weight'] == .5
    checks = {check['id']: check for check in report['checks']}
    assert checks['copycat_half_honest']['status'] == 'not_applicable'
    assert report['passed'] is True


def test_no_copy_penalty_exposes_full_copycat_score(client, tmp_path):
    project(tmp_path, copy_penalty=False)
    report = client.post('/harness/run', json={'project': PROJECT, 'rounds': 1}, headers=HEADERS).json()
    miners = {miner['id']: miner for miner in report['miners']}
    assert miners['honest']['average_score'] == 1.0
    assert miners['copycat']['average_score'] == 1.0
    assert report['passed'] is False


def test_harness_rejects_changed_code_and_unbounded_requests(client, tmp_path):
    project(tmp_path)
    assert client.post('/harness/run', json={'project': PROJECT}).status_code == 403
    assert client.post('/harness/run', json={'project': PROJECT, 'rounds': 10001}, headers=HEADERS).status_code == 422
    assert client.post('/harness/run', json={'project': PROJECT, 'command': 'sh'}, headers=HEADERS).status_code == 422
    (tmp_path / PROJECT / 'blocks/scoring.py').write_text('raise RuntimeError("untrusted")')
    response = client.post('/harness/run', json={'project': PROJECT}, headers=HEADERS)
    assert response.status_code == 409
    assert client.get('/harness/missing').status_code == 404


def test_reports_persist_between_app_instances_without_dataset_contents(client, tmp_path):
    project(tmp_path)
    report = client.post('/harness/run', json={'project': PROJECT}, headers=HEADERS).json()
    app = FastAPI()
    app.include_router(harness.router)
    with TestClient(app, headers={'Authorization': 'Bearer test-runner-token-01234567890123456789'}) as restarted:
        assert restarted.get('/harness/' + report['id']).json() == report
    assert 'First question' not in json.dumps(report)
    assert 'Second question' not in json.dumps(report)


def test_report_retention_is_bounded(client, tmp_path, monkeypatch):
    project(tmp_path)
    monkeypatch.setattr(harness, 'MAX_REPORTS', 2)
    reports = [client.post('/harness/run', json={'project': PROJECT, 'rounds': 1}, headers=HEADERS).json() for _ in range(3)]
    assert client.get('/harness/' + reports[0]['id']).status_code == 404
    assert client.get('/harness/' + reports[-1]['id']).status_code == 200


def test_equivalent_classification_labels_do_not_crash(client, tmp_path):
    recipe = json.loads((FIXTURES / 'recipes/classify.json').read_text())
    assemble(recipe, tmp_path / PROJECT, [{'input': 'One', 'answer': 'Alpha'}, {'input': 'Two', 'answer': 'alpha'}])
    response = client.post('/harness/run', json={'project': PROJECT, 'rounds': 2}, headers=HEADERS)
    assert response.status_code == 200
    assert next(miner for miner in response.json()['miners'] if miner['id'] == 'incorrect')['average_score'] == 0


def test_main_app_exposes_harness_without_chain_or_model(client, tmp_path):
    from bitcode_runner.main import app
    project(tmp_path)
    with TestClient(app, headers={'Authorization': 'Bearer test-runner-token-01234567890123456789'}) as integrated:
        response = integrated.post('/harness/run', json={'project': PROJECT, 'rounds': 1}, headers=HEADERS)
        assert response.status_code == 200
        assert integrated.get('/harness/' + response.json()['id']).json()['live_inference'] is False


def test_cli_emits_real_report_and_nonzero_status_for_failed_checks(client, tmp_path):
    import os
    import subprocess
    import sys
    project(tmp_path)
    result = subprocess.run([sys.executable, '-m', 'bitcode_runner.harness', '--project', PROJECT, '--rounds', '2'],
                            cwd=Path(__file__).parents[1], env={'PATH': os.defpath, 'BITCODE_PROJECTS_ROOT': str(tmp_path)},
                            capture_output=True, text=True, timeout=10)
    assert result.returncode == 1
    report = json.loads(result.stdout)
    assert report['passed'] is False and report['rounds'] == 2
    assert client.get('/harness/' + report['id']).json() == report
