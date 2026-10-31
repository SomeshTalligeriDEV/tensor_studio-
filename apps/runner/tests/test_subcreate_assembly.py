import json
from pathlib import Path
import pytest
from pydantic import ValidationError
from subcreate.assemble import assemble, render
from subcreate.recipe import Recipe
from subcreate.blocks.scoring import score_answers, normalize_weights

ROOT = Path(__file__).resolve().parent / 'fixtures' / 'subcreate'

def saved(task='qa'):
    return json.loads((ROOT / 'recipes' / f'{task}.json').read_text())


def dataset(task='qa'):
    filename = 'bittensor_faq.jsonl' if task == 'qa' else 'reviews.jsonl'
    return [json.loads(line) for line in (ROOT / 'data' / filename).read_text().splitlines()]


@pytest.mark.parametrize('task', ['qa', 'classify'])
def test_reproducible_complete_project_and_selfcheck(tmp_path, task):
    first = assemble(saved(task), tmp_path / 'one', dataset(task))
    second = assemble(saved(task), tmp_path / 'two', dataset(task))
    assert first == second
    assert first['self_check']['passed']
    if task == 'qa':
        assert first['self_check']['scores'][0] < first['self_check']['solo_score']
    for name in first['files']:
        assert (tmp_path / 'one' / name).read_bytes() == (tmp_path / 'two' / name).read_bytes()
    assert len((tmp_path / 'one' / 'data' / saved(task)['ground_truth']['params']['file']).read_text().splitlines()) == 40
    with pytest.raises(ValueError, match='never overwritten'):
        assemble(saved(task), tmp_path / 'one', dataset(task))


def test_untrusted_recipe_cannot_inject_code_or_paths(tmp_path):
    for change in [lambda r: r.update(code='print(1)'), lambda r: r['task'].update(block='exec'), lambda r: r['ground_truth']['params'].update(file='../../secret'), lambda r: r['weights']['params'].update(k=3), lambda r: r['scoring'][0].update(weight=0.1), lambda r: r['task'].update(block='unreviewed')]:
        recipe = saved()
        change(recipe)
        with pytest.raises(ValidationError):
            assemble(recipe, tmp_path / 'never')
        assert not (tmp_path / 'never').exists()
    recipe = saved()
    recipe['problem'] = "'); import os; raise RuntimeError('injected') #"
    files = render(Recipe.model_validate(recipe), dataset())
    assert recipe['problem'] in json.loads(files['recipe.json'])['problem']
    assert all(recipe['problem'] not in content for name, content in files.items() if name.endswith('.py'))


def test_bad_answers_speed_and_weights():
    recipe = saved('classify')
    assert score_answers(recipe, ['fake', 'real', None], [0, 9, 0], 'real') == [0, 0, 0]
    assert normalize_weights([1, 2, 3], [0, 0, 0], 'top_k', k=1) == [0, 0, 1]
    assert normalize_weights([0, 0], [0, 0], 'ema_normalize') == [0, 0]
    with pytest.raises(ValueError):
        normalize_weights([float('nan')], [0], 'ema_normalize')
