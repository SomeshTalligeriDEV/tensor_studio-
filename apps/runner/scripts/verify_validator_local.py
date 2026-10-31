"""Exercise the actual local validator and checkpoint with no canned miner replies."""
import asyncio
import json
from pathlib import Path
import subprocess
import sys
import tempfile
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from subcreate.assemble import assemble
from bitcode_runner.nodes import ValidatorLaunch, validator_preflight


def main():
    address = asyncio.run(validator_preflight(ValidatorLaunch(project='subcreate-' + 'a' * 32, netuid=2, dev_hotkey='bitcode-validator')))
    source = Path(sys.argv[1])
    with tempfile.TemporaryDirectory(prefix='bitcode-validator-check-') as temporary:
        project = Path(temporary) / 'project'
        assemble(json.loads((source / 'recipe.json').read_text()), project,
                 [json.loads(line) for line in (source / 'data/custom.jsonl').read_text().splitlines()])
        reports = []
        for expected_round in (0, 1):
            result = subprocess.run([sys.executable, str(project / 'validator.py'), '--dev-hotkey', 'bitcode-validator',
                                     '--netuid', '2', '--rounds', '1'], capture_output=True, text=True, timeout=60)
            if result.returncode:
                raise RuntimeError(result.stderr[-2000:])
            report = json.loads(result.stdout.splitlines()[-1])
            assert report['round'] == expected_round and report['submitted'] is False
            assert report['observations']
            reports.append(report)
        print(json.dumps({'registered_address': address, 'rounds': reports, 'checkpoint_resume_verified': True,
                          'docker_runtime_verified': False}), flush=True)


if __name__ == '__main__':
    main()
