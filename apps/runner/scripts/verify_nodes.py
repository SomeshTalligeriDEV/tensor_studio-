"""Real Docker verification without pretend model credentials or answers."""
import json
import sys
from pathlib import Path
from uuid import uuid4
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import docker
from fastapi.testclient import TestClient
from bitcode_runner import nodes
from bitcode_runner.main import app
from subcreate.assemble import assemble


def main():
    source = Path(sys.argv[1])
    project = 'subcreate-' + uuid4().hex
    assemble(json.loads((source / 'recipe.json').read_text()), nodes.execution.ROOT / project,
             [json.loads(line) for line in (source / 'data/custom.jsonl').read_text().splitlines()])
    context, image = nodes.build_context(project)
    client = docker.from_env(timeout=600)
    print('Building reviewed project image ' + image, flush=True)
    for event in client.api.build(fileobj=context, custom_context=True, tag=image, rm=True, forcerm=True, decode=True, use_config_proxy=False):
        if event.get('error'):
            raise RuntimeError(event['error'])
        text = event.get('stream', '').strip()
        if text and ('Step ' in text or 'Successfully' in text):
            print(text, flush=True)
    api = TestClient(app)
    node = None
    try:
        output = client.containers.run(image, ['python', 'self_check.py'], remove=True, network_disabled=True)
        assert json.loads(output)['passed']
        print('Container compile and scoring checks passed.', flush=True)
        node = client.containers.create(image, ['python', 'miner.py', '--host', '0.0.0.0', '--hotkey',
            '5GTH5UfpYdnLtmZbAKibrfepNEzJTqWedVizMyzeYey6ME6G', '--validator',
            '5H49n5au3sxtSbPKpLy35mJ8mAZALWqrv8cRWCtvVuBT9XR7'],
            labels={nodes.LABEL: 'true', 'bitcode.role': 'miner-verification', 'bitcode.project': project},
            read_only=True, cap_drop=['ALL'], security_opt=['no-new-privileges:true'])
        node.start()
        assert node.wait(timeout=30)['StatusCode'] != 0
        detail = api.get('/nodes/' + node.id).json()
        assert detail['status'] == 'exited' and detail['exit_code'] != 0
        logs = api.get('/nodes/' + node.id + '/logs').json()['text']
        assert 'No fallback answer' in logs
        assert any(value['id'] == node.id for value in api.get('/nodes').json()['nodes'])
        headers = {'X-Bitcode-Client': 'studio'}
        assert api.post('/nodes/' + node.id + '/start', headers=headers).status_code == 200
        node.wait(timeout=30)
        assert api.post('/nodes/' + node.id + '/stop', headers=headers).status_code == 200
        node.reload()
        assert not node.attrs.get('Mounts')
        assert not any(item.split('=', 1)[0] in {'BITCODE_MODEL_API_KEY', 'PRIVATE_KEY', 'MNEMONIC'} for item in node.attrs['Config']['Env'])
        print(json.dumps({'docker_image': image, 'project': project, 'real_container_checks': True,
                          'missing_credentials_fail_closed': True, 'status_logs_start_stop_verified': True,
                          'inference_verified': False, 'chain_registration_verified': False}), flush=True)
    finally:
        if node:
            node.remove(force=True)
        client.close()


if __name__ == '__main__':
    main()
