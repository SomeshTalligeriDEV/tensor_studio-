import math
from collections import Counter
from difflib import SequenceMatcher


def normalize_answer(text: str) -> str:
    return ' '.join(text.casefold().split())


def exact_or_fuzzy(answer: str, expected: str, task: str) -> float:
    a, b = normalize_answer(answer), normalize_answer(expected)
    if not a or not b:
        return 0.0
    if task == 'classify':
        return float(a == b)
    return SequenceMatcher(None, a, b).ratio()


def latency_bonus(seconds: float, timeout: float) -> float:
    if not math.isfinite(seconds) or seconds < 0 or timeout <= 0 or seconds >= timeout:
        return 0.0
    return 1.0 - seconds / timeout


def score_answers(recipe: dict, answers: list[str | None], elapsed: list[float], expected: str, timeout: float = 5) -> list[float]:
    if len(answers) != len(elapsed) or not math.isfinite(timeout) or timeout <= 0:
        raise ValueError('Answer timing data is invalid.')
    scores = []
    valid = [isinstance(a, str) and bool(a.strip()) and math.isfinite(t) and 0 <= t < timeout for a, t in zip(answers, elapsed)]
    duplicates = Counter(normalize_answer(a) for a, ok in zip(answers, valid) if ok)
    for answer, seconds, ok in zip(answers, elapsed, valid):
        if not ok:
            scores.append(0.0)
            continue
        correctness = exact_or_fuzzy(answer, expected, recipe['task']['block'])
        # Speed never rewards an incorrect label or empty response.
        score = sum(part['weight'] * (correctness if part['block'] == 'exact_or_fuzzy' else correctness * latency_bonus(seconds, timeout)) for part in recipe['scoring'])
        if 'copy_penalty' in recipe['anti_cheat']:
            score /= duplicates[normalize_answer(answer)]
        scores.append(min(1.0, max(0.0, score)))
    return scores


def normalize_weights(scores: list[float], previous: list[float], block: str, alpha: float = 0.2, k: int = 2) -> list[float]:
    if len(scores) != len(previous) or any(not math.isfinite(x) or x < 0 for x in scores + previous):
        raise ValueError('Scores must be finite, nonnegative and aligned.')
    if block == 'ema_normalize':
        if not 0 < alpha <= 1:
            raise ValueError('EMA alpha must be in (0, 1].')
        values = [alpha * score + (1 - alpha) * old for score, old in zip(scores, previous)]
    elif block == 'top_k':
        if k < 1:
            raise ValueError('Top k must be positive.')
        selected = set(sorted(range(len(scores)), key=lambda i: (-scores[i], i))[:k])
        values = [score if i in selected else 0 for i, score in enumerate(scores)]
    else:
        raise ValueError('Unknown weight block.')
    total = sum(values)
    return [value / total if total else 0.0 for value in values]
