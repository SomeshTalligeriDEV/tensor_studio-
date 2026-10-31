"""Live API audit using facts read from the running local chain, not fixture answers."""
import asyncio
import json
from pathlib import Path
import httpx
from websockets.asyncio.client import connect

async def main():
    async with connect('ws://127.0.0.1:9944', open_timeout=3) as socket:
        async def rpc(method, params):
            await socket.send(json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}))
            return json.loads(await socket.recv())['result']
        genesis = await rpc('chain_getBlockHash', [0])
        name = await rpc('system_chain', [])
    dataset = [{'input': 'What is the genesis hash of this running local chain?', 'answer': genesis}, {'input': 'What name does this running local chain report?', 'answer': name}]
    recipe = {'problem': 'Check responses about the current local chain metadata.', 'task': {'block': 'qa', 'params': {}}, 'ground_truth': {'block': 'dataset', 'params': {'file': 'custom.jsonl'}}, 'scoring': [{'block': 'exact_or_fuzzy', 'weight': 1.0}], 'anti_cheat': ['timeout_zero'], 'weights': {'block': 'ema_normalize', 'params': {'alpha': 0.2}}, 'brief': {'problem': 'Check local chain metadata answers.', 'who_benefits': 'Local developers', 'what_miners_do': 'Answer metadata questions through configured inference.', 'how_validators_check': 'Compare with observed chain facts.', 'how_rewards_flow': 'Preview normalized scores; no earnings claim.', 'how_cheaters_lose': 'Unavailable responses score zero.', 'why_this_design': 'API integration verification using observed values.', 'alternative_considered': 'Static test fixtures, not used in this audit.'}}
    async with httpx.AsyncClient(timeout=20) as client:
        old = await client.get('http://127.0.0.1:8787/subcreate/recipes')
        assert old.status_code == 404
        response = await client.post('http://127.0.0.1:8787/subcreate/assemble-live', headers={'X-Bitcode-Client': 'studio'}, json={'recipe': recipe, 'dataset': dataset})
        response.raise_for_status()
        result = response.json()
        project = Path('projects') / result['project']
        saved = [json.loads(line) for line in (project / 'data/custom.jsonl').read_text().splitlines()]
        assert saved == dataset
        assert result['chain_status'] == 'not_deployed'
        assert json.loads((project / 'project-status.json').read_text())['self_check_scope'] == 'compile_and_scoring_only'
        # Verify live service missing-provider behavior only if no models are configured.
        models = (await client.get('http://127.0.0.1:5173/api/models')).json()
        ai_status = 'configured; inference not invoked by this assembly audit'
        if not models['models'] and not models['fallback']:
            generation = await client.post('http://127.0.0.1:5173/api/subcreate', json={'problem': 'Answer questions about current local chain metadata.'})
            assert generation.status_code == 503
            assert 'CHUTES_API_KEY' in generation.text
            ai_status = '503 configuration error verified; no recipe substituted'
        print(json.dumps({'assembly': 'PASS', 'dataset_source': 'live_chain_rpc', 'project': result['project'], 'retired_fixture_route': old.status_code, 'AI': ai_status, 'inference_verified': False, 'deployment_verified': False}))

asyncio.run(main())
