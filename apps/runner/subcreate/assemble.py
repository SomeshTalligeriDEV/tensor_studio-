"""Validate data, then copy fixed reviewed sources. Never interpolate code."""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from .recipe import Recipe, LiveAssembly

ROOT = Path(__file__).resolve().parent


def canonical(value) -> str:
    return json.dumps(value, sort_keys=True, ensure_ascii=False, indent=2) + '\n'


def render(recipe: Recipe, dataset: list[dict] | None = None) -> dict[str, str]:
    data = recipe.model_dump()
    files = {
        'recipe.json': canonical(data),
        'skeleton.py': (ROOT / 'skeleton.py').read_text(),
        'blocks/__init__.py': '',
        'blocks/scoring.py': (ROOT / 'blocks/scoring.py').read_text(),
        'requirements.txt': 'bittensor==11.3.0\nfastapi>=0.115,<1\nhttpx>=0.27,<1\nuvicorn>=0.30,<1\nwebsockets>=14,<16\n',
    }
    filename = recipe.ground_truth.params.file
    checked = LiveAssembly.model_validate({'recipe': data, 'dataset': dataset})
    files[f'data/{filename}'] = ''.join(json.dumps(row.model_dump(), sort_keys=True, ensure_ascii=False) + '\n' for row in checked.dataset)
    for filename in ['miner.py', 'model_client.py', 'validator.py', 'self_check.py']:
        files[filename] = (ROOT / 'templates' / filename).read_text()
    files['README.md'] = (ROOT / 'templates' / 'README.md').read_text()
    files['project-status.json'] = canonical({
        'dataset_source': 'user_supplied',
        'inference': 'requires_configured_model', 'chain_status': 'not_deployed',
        'self_check_scope': 'compile_and_scoring_only',
    })
    files['manifest.json'] = canonical({path: hashlib.sha256(content.encode()).hexdigest() for path, content in sorted(files.items())})
    return files


def assemble(value: dict, destination: Path, dataset: list[dict] | None = None) -> dict:
    recipe = Recipe.model_validate(value)
    destination = Path(destination)
    if destination.exists() or destination.is_symlink():
        raise ValueError('Choose a new project folder; existing projects are never overwritten.')
    files = render(recipe, dataset)
    destination.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix='.subcreate-', dir=destination.parent))
    try:
        for name, content in files.items():
            path = staging / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding='utf-8')
        env = {'PATH': os.defpath, 'PYTHONDONTWRITEBYTECODE': '1', 'PYTHONIOENCODING': 'utf-8'}
        result = subprocess.run([sys.executable, '-I', '-c', "import runpy,sys; sys.path.insert(0,sys.argv[1]); runpy.run_path(sys.argv[1]+'/self_check.py',run_name='__main__')", str(staging.resolve())], capture_output=True, text=True, timeout=10, env=env)
        if result.returncode:
            raise RuntimeError('Generated scoring self-check failed: ' + result.stderr[-1000:])
        checks = json.loads(result.stdout)
        if not checks.get('passed'):
            raise RuntimeError('Scoring self-check did not pass.')
        # mkdir provides no-overwrite semantics even if another process wins the race.
        destination.mkdir()
        try:
            for path in staging.iterdir():
                shutil.move(str(path), destination / path.name)
        except Exception:
            shutil.rmtree(destination)
            raise
        return {'files': sorted(files), 'self_check': checks, 'recipe_sha256': hashlib.sha256(files['recipe.json'].encode()).hexdigest()}
    finally:
        shutil.rmtree(staging)
