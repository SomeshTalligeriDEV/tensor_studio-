"""Authenticated Bittensor v11 miner backed by real model inference."""
import argparse
import json
from pathlib import Path
import uvicorn
from fastapi import HTTPException
from skeleton import create_miner
from model_client import ModelClient, InferenceUnavailable


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--hotkey', required=True, help='Miner public SS58 address')
    parser.add_argument('--validator', required=True, action='append', help='Allowed validator address; repeat for more')
    parser.add_argument('--host', choices=['127.0.0.1', '127.0.0.2', '0.0.0.0'], default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8091)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    recipe = json.loads((root / 'recipe.json').read_text())
    labels = []
    if recipe['task']['block'] == 'classify':
        labels = sorted({json.loads(line)['answer'] for line in (root / 'data' / recipe['ground_truth']['params']['file']).read_text().splitlines()})
    # Fail startup if inference is unconfigured. Never answer from evaluation data.
    model = ModelClient()
    async def answer(text):
        try:
            return await model.answer(recipe['task']['block'], text, labels)
        except InferenceUnavailable as error:
            raise HTTPException(503, str(error))
    app = create_miner(args.hotkey, set(args.validator), answer)
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == '__main__':
    main()
