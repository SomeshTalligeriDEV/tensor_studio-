"""Text project files confined to the runner workspace."""
import re
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from . import execution

router = APIRouter()
MAX_BYTES = 1024 * 1024


class FileContent(BaseModel):
    content: str = Field(max_length=MAX_BYTES)


def resolve_file(project: str, filename: str) -> Path:
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}', project):
        raise HTTPException(400, 'Invalid project ID.')
    root = execution.ROOT / project
    if root.is_symlink():
        raise HTTPException(400, 'Project symlinks are not supported.')
    relative = Path(filename)
    if relative.is_absolute() or any(part in {'.', '..'} for part in relative.parts) or not relative.parts:
        raise HTTPException(400, 'Invalid file path.')
    current = root
    for part in relative.parts:
        current = current / part
        if current.is_symlink():
            raise HTTPException(400, 'Symlinks are not supported.')
    if not current.resolve().is_relative_to(root.resolve()):
        raise HTTPException(400, 'File must remain inside its project.')
    return current


@router.get('/projects/{project}/files/{filename:path}')
def read_file(project: str, filename: str):
    path = resolve_file(project, filename)
    if not path.is_file():
        raise HTTPException(404, 'File not found.')
    if path.stat().st_size > MAX_BYTES:
        raise HTTPException(413, 'File exceeds the 1 MiB text limit.')
    try:
        return {'content': path.read_text(encoding='utf-8')}
    except UnicodeDecodeError:
        raise HTTPException(415, 'Only UTF-8 text files are supported.')
    except OSError:
        raise HTTPException(500, 'Could not read the project file.')


@router.put('/projects/{project}/files/{filename:path}')
def write_file(project: str, filename: str, body: FileContent, request: Request):
    if request.headers.get('x-bitcode-client') != 'studio':
        raise HTTPException(403, 'Missing Bitcode client header.')
    if len(body.content.encode('utf-8')) > MAX_BYTES:
        raise HTTPException(413, 'File exceeds the 1 MiB text limit.')
    path = resolve_file(project, filename)
    if path.exists() and not path.is_file():
        raise HTTPException(409, 'Path is not a regular file.')
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body.content, encoding='utf-8')
    except OSError:
        raise HTTPException(507, 'Could not save the file. Check disk space and permissions.')
    return {'project': project, 'path': filename, 'saved': True}
