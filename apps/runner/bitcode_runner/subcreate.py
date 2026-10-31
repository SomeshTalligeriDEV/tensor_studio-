"""Validated custom datasets and deterministic project assembly."""
import subprocess
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Request
from subcreate.assemble import assemble
from subcreate.recipe import LiveAssembly
from . import execution

router = APIRouter()


@router.get('/subcreate/schema')
def recipe_schema():
    return {'schema': LiveAssembly.model_json_schema()}


@router.post('/subcreate/assemble-live')
def assemble_live_project(body: LiveAssembly, request: Request):
    if request.headers.get('x-bitcode-client') != 'studio':
        raise HTTPException(403, 'Missing Bitcode client header.')
    project = 'subcreate-' + uuid4().hex
    try:
        result = assemble(body.recipe.model_dump(), execution.ROOT / project, [row.model_dump() for row in body.dataset])
        return {'project': project, 'dataset_source': 'user_supplied', 'chain_status': 'not_deployed', **result}
    except subprocess.TimeoutExpired:
        raise HTTPException(504, 'Offline scoring self-check timed out. No project was saved.')
    except (ValueError, RuntimeError):
        raise HTTPException(422, 'Project checks failed. Check the recipe and labelled dataset.')
    except OSError:
        raise HTTPException(503, 'Project storage is unavailable.')
