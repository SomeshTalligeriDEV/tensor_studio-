"""Launch a real preview-only development validator through the live runner."""
import json
from pathlib import Path
import sys
import time
import httpx

project = sys.argv[1]
with httpx.Client(base_url='http://127.0.0.1:8787', timeout=600, trust_env=False) as client:
    response = client.post('/nodes/validator', headers={'X-Bitcode-Client': 'studio'}, json={
        'project': project, 'netuid': 2, 'dev_hotkey': 'bitcode-validator'})
    response.raise_for_status()
    node = response.json()
    print(json.dumps({'launched': node}), flush=True)
    deadline = time.monotonic() + 60
    report = None
    while time.monotonic() < deadline:
        logs = client.get('/nodes/' + node['id'] + '/logs').json()['text']
        for line in logs.splitlines():
            start = line.find('{"round":')
            if start >= 0:
                report = json.loads(line[start:])
        if report:
            break
        time.sleep(1)
    if not report:
        print(logs, flush=True)
        raise RuntimeError('Validator did not produce a real observation report within 60 seconds')
    assert report['submitted'] is False and report['observations']
    response = client.post('/nodes/' + node['id'] + '/stop', headers={'X-Bitcode-Client': 'studio'})
    response.raise_for_status()
    response = client.post('/nodes/' + node['id'] + '/start', headers={'X-Bitcode-Client': 'studio'})
    response.raise_for_status()
    deadline = time.monotonic() + 60
    resumed = None
    while time.monotonic() < deadline:
        logs = client.get('/nodes/' + node['id'] + '/logs').json()['text']
        for line in logs.splitlines():
            start = line.find('{"round":')
            if start >= 0:
                value = json.loads(line[start:])
                if value['round'] > report['round']:
                    resumed = value
        if resumed:
            break
        time.sleep(1)
    assert resumed is not None, logs
    detail = client.get('/nodes/' + node['id']).json()
    assert detail['status'] == 'running'
    print(json.dumps({'node': detail, 'first_round': report, 'resumed_round': resumed,
                      'checkpoint_survived_restart': True, 'inference_verified': False}), flush=True)
