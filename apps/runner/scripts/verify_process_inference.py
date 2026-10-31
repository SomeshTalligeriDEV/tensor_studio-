"""Opt-in signed-HTTP miner/provider smoke test; isolated data, no chain calls.

Reads only explicitly supplied BITCODE_MODEL_* config. Prints no credentials,
provider diagnostics, or model text. All temporary files/processes are removed.
"""
import argparse
import asyncio
from contextlib import asynccontextmanager
import json
import os
from pathlib import Path
import shlex
import socket
import sys
import tempfile
import time
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx
from bittensor.keyfiles import Keypair
from fastapi import FastAPI
from fastapi.testclient import TestClient
from bitcode_runner import execution, harness, process_nodes
from subcreate.assemble import assemble
from subcreate.skeleton import query_miner

MODEL_KEYS = {'BITCODE_MODEL_BASE_URL', 'BITCODE_MODEL_ID', 'BITCODE_MODEL_API_KEY'}


def load_model_configuration(path):
    for line in path.read_text().splitlines():
        line = line.strip()
        if line.startswith('export '):
            line = line[7:]
        key, separator, raw = line.partition('=')
        if separator and key.strip() in MODEL_KEYS:
            values = shlex.split(raw, comments=True)
            if len(values) != 1:
                raise ValueError('Invalid model configuration')
            os.environ[key.strip()] = values[0]
    if not all(os.environ.get(key) for key in MODEL_KEYS):
        raise ValueError('Incomplete model configuration')


def verify(env_file, port):
    original = {key: os.environ.get(key) for key in MODEL_KEYS | {'CHAIN_WS'}}
    original_root = execution.ROOT
    stage = 'configuration'
    summary = {'live_provider_request': False, 'chain_used': False, 'fixture': 'isolated_arithmetic_and_geography_test'}
    try:
        load_model_configuration(env_file)
        os.environ['CHAIN_WS'] = 'ws://127.0.0.1:9944'
        stage = 'loopback_port_check'
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', port))
        with tempfile.TemporaryDirectory(prefix='tensorstudio-live-inference-check-') as directory:
            execution.ROOT = Path(directory)
            project = 'subcreate-' + 'd' * 32
            recipe = json.loads((Path(__file__).resolve().parents[1] / 'tests/fixtures/subcreate/recipes/qa.json').read_text())
            recipe['problem'] = 'Controlled live-inference smoke test; not application demo data.'
            dataset = [{'input': 'What is 2 plus 2?', 'answer': '4'}, {'input': 'What is the capital of France?', 'answer': 'Paris'}]
            stage = 'trusted_project_assembly'
            assemble(recipe, execution.ROOT / project, dataset)
            validator = Keypair.create_from_uri('//Alice//tensorstudio-provider-smoke')
            miner = Keypair.create_from_uri('//Bob//tensorstudio-provider-smoke')
            @asynccontextmanager
            async def lifespan(app):
                yield
                await process_nodes.shutdown()
            app = FastAPI(lifespan=lifespan)
            app.include_router(process_nodes.router)
            app.include_router(harness.router)
            headers = {'X-Bitcode-Client': 'studio'}
            with TestClient(app) as client:
                stage = 'miner_launch'
                response = client.post('/process-nodes/miner', headers=headers, json={
                    'project': project, 'netuid': 1, 'hotkey': miner.ss58_address,
                    'validators': [validator.ss58_address], 'port': port})
                if response.status_code != 200:
                    raise RuntimeError('Miner launch failed')
                identifier = response.json()['id']
                node = process_nodes.registry[identifier]
                snapshot = node.plan.directory
                stage = 'miner_health'
                with httpx.Client(timeout=2, trust_env=False) as http:
                    deadline = time.monotonic() + 15
                    while time.monotonic() < deadline:
                        if client.get('/process-nodes/' + identifier).json()['status'] != 'running':
                            raise RuntimeError('Miner exited')
                        try:
                            if http.get(f'http://127.0.0.1:{port}/health').status_code == 200:
                                break
                        except httpx.TransportError:
                            pass
                        time.sleep(.1)
                    else:
                        raise RuntimeError('Miner readiness timeout')
                    stage = 'unsigned_request_rejection'
                    unsigned = http.post(f'http://127.0.0.1:{port}/task', json={'input': 'Unsigned test'})
                    if unsigned.status_code != 401:
                        raise RuntimeError('Unsigned request not rejected')
                    summary['unsigned_request_status'] = unsigned.status_code
                stage = 'signed_live_inference'
                answer = asyncio.run(query_miner(validator, miner.ss58_address, f'127.0.0.1:{port}',
                    'What is 2 plus 2? Return only the single digit, with no punctuation.', timeout=40))
                if not answer.strip():
                    raise RuntimeError('Empty response')
                summary.update(live_provider_request=True, signed_inference_nonempty=True,
                    arithmetic_answer_correct=answer.strip() == '4', response_characters=len(answer))
                stage = 'offline_harness_api'
                response = client.post('/harness/run', headers=headers, json={'project': project, 'rounds': 2})
                if response.status_code != 200:
                    raise RuntimeError('Harness API failed')
                report = response.json()
                if client.get('/harness/' + report['id']).json() != report:
                    raise RuntimeError('Saved report differs')
                summary.update(harness_api_status=200, harness_mode=report['mode'], harness_checks_passed=report['passed'],
                    harness_failed_checks=[item['id'] for item in report['checks'] if item['status'] == 'failed'])
                stage = 'credential_redaction'
                exposed = json.dumps(client.get('/process-nodes/' + identifier).json()) + client.get('/process-nodes/' + identifier + '/logs').json()['text'] + json.dumps(report)
                if os.environ['BITCODE_MODEL_API_KEY'] in exposed:
                    raise RuntimeError('Credential exposed')
                summary['credential_absent_from_api_and_logs'] = True
                stage = 'stop_and_cleanup'
                stopped = client.post('/process-nodes/' + identifier + '/stop', headers=headers)
                if stopped.status_code != 200 or stopped.json()['status'] != 'stopped' or node.process.returncode is None:
                    raise RuntimeError('Miner not stopped')
                summary['miner_stopped'] = True
            if snapshot.exists() or process_nodes.registry:
                raise RuntimeError('Runtime cleanup failed')
        summary['temporary_files_removed'] = not Path(directory).exists()
        summary['passed'] = summary['arithmetic_answer_correct']
        print(json.dumps(summary, sort_keys=True))
        return 0 if summary['passed'] else 1
    except Exception as error:
        print(json.dumps({'passed': False, 'stage': stage, 'error_type': type(error).__name__, 'chain_used': False}))
        return 1
    finally:
        execution.ROOT = original_root
        for key, value in original.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', type=Path, required=True)
    parser.add_argument('--port', type=int, default=8099)
    args = parser.parse_args()
    raise SystemExit(verify(args.env_file, args.port))
