import json
from pathlib import Path
from blocks.scoring import score_answers, normalize_weights


def check():
    root = Path(__file__).resolve().parent
    recipe = json.loads((root / 'recipe.json').read_text())
    sample = json.loads((root / 'data' / recipe['ground_truth']['params']['file']).read_text().splitlines()[0])
    expected = sample['answer']
    solo = score_answers(recipe, [expected], [0.1], expected)[0]
    scores = score_answers(recipe, [expected, expected, None, 'incorrect answer'], [0.1, 0.1, 6, 0.1], expected)
    assert solo > 0 and scores[2] == 0
    if 'copy_penalty' in recipe['anti_cheat']:
        assert scores[0] == scores[1] and scores[0] < solo
    params = recipe['weights']['params']
    weights = normalize_weights(scores, [0.0] * len(scores), recipe['weights']['block'], **params)
    assert abs(sum(weights) - 1) < 1e-9
    for path in root.rglob('*.py'):
        compile(path.read_text(), str(path), 'exec')
    return {'passed': True, 'task': recipe['task']['block'], 'solo_score': solo, 'scores': scores, 'weights': weights}


if __name__ == '__main__':
    print(json.dumps(check()))
