"""Offline controlled-fixture scoring reports for reviewed generated projects.

No user Python is imported, no miners or models are called, and no chain is used.
Fixture timings are inputs to the real scoring functions, not wall-clock latency.
"""
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
import sqlite3
import time
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from subcreate.blocks.scoring import score_answers, normalize_weights, normalize_answer
from . import execution
from .process_nodes import reviewed_files, require_client

router = APIRouter(prefix='/harness')
MAX_REPORTS = 64
FIXTURES = [
    ('honest', 'Ground-truth answer'),
    ('copycat', 'Exact copy of the honest answer'),
    ('incorrect', 'Controlled incorrect answer'),
    ('slow', 'Correct answer with simulated elapsed time beyond the timeout'),
    ('empty', 'Empty answer'),
]


class EvaluationRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    project: str = Field(pattern=r'^subcreate-[a-f0-9]{32}$')
    rounds: int = Field(default=20, ge=1, le=100, strict=True)


def database():
    execution.ROOT.mkdir(parents=True, exist_ok=True)
    path = execution.ROOT / '.harness-reports.sqlite3'
    if path.is_symlink():
        raise HTTPException(409, 'Harness report storage cannot be a symlink.')
    connection = sqlite3.connect(path, timeout=5)
    connection.execute('CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, data TEXT NOT NULL)')
    return connection


def save_report(report):
    try:
        with closing(database()) as connection, connection:
            connection.execute('INSERT INTO reports (id, created_at, data) VALUES (?, ?, ?)',
                               (report['id'], report['created_at'], json.dumps(report, allow_nan=False)))
            connection.execute('DELETE FROM reports WHERE id NOT IN (SELECT id FROM reports ORDER BY rowid DESC LIMIT ?)', (MAX_REPORTS,))
    except (sqlite3.Error, OSError):
        raise HTTPException(503, 'Could not save the evaluation report. Check the projects directory permissions and disk space.') from None


def evaluate(body: EvaluationRequest) -> dict:
    started = time.monotonic()
    files = reviewed_files(body.project)
    recipe = json.loads(files['recipe.json'])
    dataset = [json.loads(line) for line in files['data/' + recipe['ground_truth']['params']['file']].splitlines()]
    timeout = 5.0
    fast = .1
    timings = [fast, fast, fast, timeout + 1, fast]
    previous = [0.0] * len(FIXTURES)
    totals = [0.0] * len(FIXTURES)
    solo_total = 0.0
    observations = []
    settings = recipe['weights']
    for index in range(body.rounds):
        expected = dataset[index % len(dataset)]['answer']
        incorrect = 'deliberately incorrect fixture response'
        if normalize_answer(incorrect) == normalize_answer(expected):
            incorrect = 'another deliberately incorrect fixture response'
        if recipe['task']['block'] == 'classify':
            incorrect = next((row['answer'] for row in dataset if normalize_answer(row['answer']) != normalize_answer(expected)), incorrect)
        answers = [expected, expected, incorrect, expected, '']
        scores = score_answers(recipe, answers, timings, expected, timeout=timeout)
        weights = normalize_weights(scores, previous, settings['block'], **settings['params'])
        if settings['block'] == 'ema_normalize':
            alpha = settings['params']['alpha']
            previous = [alpha * score + (1 - alpha) * old for score, old in zip(scores, previous)]
        else:
            previous = scores
        totals = [total + score for total, score in zip(totals, scores)]
        solo_total += score_answers(recipe, [expected], [fast], expected, timeout=timeout)[0]
        observations.append({'round': index + 1, 'sample_index': index % len(dataset),
                             'scores': dict(zip((name for name, _ in FIXTURES), scores)),
                             'weights': dict(zip((name for name, _ in FIXTURES), weights))})
    averages = [total / body.rounds for total in totals]
    honest = averages[0]
    ratio = lambda score: score / honest if honest > 0 else None
    checks = []
    def check(identifier, label, passed, explanation):
        checks.append({'id': identifier, 'label': label,
                       'status': 'not_applicable' if passed is None else 'passed' if passed else 'failed',
                       'explanation': explanation})
    check('honest_positive', 'Correct answers receive a positive score', honest > 0,
          'The honest fixture reads the supplied ground truth; it is not a model prediction.')
    check('honest_top_weight', 'Honest fixture has a highest final weight', weights[0] > 0 and weights[0] >= max(weights) - 1e-12,
          'Ties count as a highest weight. See the copycat check for whether copying is distinguished.')
    classification = recipe['task']['block'] == 'classify'
    check('copycat_half_honest', 'Copycat score is at most half of honest',
          None if classification else honest > 0 and averages[1] <= honest * .5 + 1e-12,
          'Identical classification labels are not evidence of cheating.' if classification else
          'Duplicate-answer penalties treat honest and copied identical answers equally; they cannot identify who copied whom.')
    check('incorrect_near_zero', 'Incorrect fixture score is at most 10% of honest',
          honest > 0 and averages[2] <= honest * .1 + 1e-12,
          'Q&A fuzzy similarity may reward an incorrect answer that shares text with the ground truth. This is a controlled incorrect fixture, not a random-model benchmark.')
    check('slow_zero', 'Answers after the timeout score zero', averages[3] == 0,
          'Elapsed time is set to six seconds against a five-second timeout; no actual delay or network call occurs.')
    check('empty_zero', 'Empty answers score zero', averages[4] == 0,
          'The empty fixture supplies an empty string.')
    return {
        'id': uuid4().hex, 'created_at': datetime.now(timezone.utc).isoformat(),
        'project': body.project, 'recipe_sha256': hashlib.sha256(files['recipe.json'].encode()).hexdigest(),
        'dataset_sha256': hashlib.sha256(files['data/' + recipe['ground_truth']['params']['file']].encode()).hexdigest(),
        'task': recipe['task']['block'], 'mode': 'synthetic_offline',
        'latency_mode': 'simulated_elapsed_values', 'chain_used': False, 'live_inference': False,
        'rounds': body.rounds, 'dataset_rows': len(dataset), 'distinct_samples_used': min(body.rounds, len(dataset)),
        'timeout_seconds': timeout, 'duration_seconds': round(time.monotonic() - started, 6),
        'weight_block': settings['block'], 'anti_cheat': recipe['anti_cheat'],
        'isolated_honest_average_score': solo_total / body.rounds,
        'miners': [{'id': name, 'description': description, 'average_score': averages[index],
                    'final_weight': weights[index], 'score_ratio_to_honest': ratio(averages[index]),
                    'simulated_elapsed_seconds': timings[index]}
                   for index, (name, description) in enumerate(FIXTURES)],
        'checks': checks, 'passed': not any(item['status'] == 'failed' for item in checks),
        'observations': observations,
        'limitations': [
            'Controlled fixtures test scoring and weight calculations only; they do not prove miner quality, authentication, network performance, registration or rewards.',
            'No model inference, signed miner HTTP calls or chain execution occurred.',
            'Q&A exact_or_fuzzy measures text similarity, not semantic truth.',
            'Only the supplied dataset is sampled in order, repeating when rounds exceed dataset size.',
        ],
    }


@router.post('/run')
def run_harness(body: EvaluationRequest, request: Request):
    require_client(request)
    report = evaluate(body)
    save_report(report)
    return report


@router.get('/{identifier}')
def get_report(identifier: str):
    try:
        with closing(database()) as connection:
            row = connection.execute('SELECT data FROM reports WHERE id = ?', (identifier,)).fetchone()
        if row is None:
            raise HTTPException(404, 'Evaluation report not found. The latest 64 reports are retained.')
        return json.loads(row[0])
    except (sqlite3.Error, OSError, ValueError):
        raise HTTPException(503, 'Evaluation report storage is unavailable.') from None


def main():
    import argparse
    import sys
    from pydantic import ValidationError
    parser = argparse.ArgumentParser(description='Run controlled offline scoring fixtures against a generated SubCreate project.')
    parser.add_argument('--project', required=True, help='Generated project ID inside BITCODE_PROJECTS_ROOT')
    parser.add_argument('--rounds', type=int, default=20)
    args = parser.parse_args()
    try:
        report = evaluate(EvaluationRequest(project=args.project, rounds=args.rounds))
        save_report(report)
    except ValidationError:
        print(json.dumps({'error': 'Use a generated project ID and 1–100 rounds.'}), file=sys.stderr)
        return 2
    except HTTPException as error:
        print(json.dumps({'error': error.detail}), file=sys.stderr)
        return 2
    print(json.dumps(report, allow_nan=False))
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
