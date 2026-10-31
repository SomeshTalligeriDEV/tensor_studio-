"""Bounded local processes, replayable output, and no shell interpolation."""
import asyncio
import os
from pathlib import Path
import shutil
import signal
import sys
from uuid import uuid4
from dataclasses import dataclass, field

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from .chain_config import chain_endpoint

router = APIRouter()
ROOT = Path(os.getenv("BITCODE_PROJECTS_ROOT", "projects")).resolve()
ORIGIN = os.getenv("BITCODE_WEB_ORIGIN", "http://localhost:5173")
LIMIT = 256 * 1024


class Command(BaseModel):
    binary: str
    args: list[str] = Field(default_factory=list, max_length=128)
    cwd: str = "."


@dataclass
class Job:
    events: list[dict] = field(default_factory=list)
    done: bool = False
    task: asyncio.Task | None = None


jobs: dict[str, Job] = {}


def resolve_command(command: Command):
    if command.binary not in {"btcli", "python", "uv"}:
        raise HTTPException(400, "Binary must be btcli, python, or uv.")
    if any('\0' in arg for arg in command.args) or sum(map(len, command.args)) > 32768:
        raise HTTPException(400, "Invalid or oversized arguments.")
    directory = (ROOT / command.cwd).resolve()
    if not directory.is_relative_to(ROOT) or not directory.is_dir():
        raise HTTPException(400, "cwd must be an existing folder inside the projects directory.")
    sibling = Path(sys.executable).parent / command.binary
    executable = (
        sys.executable if command.binary == "python"
        else str(sibling) if sibling.is_file() and os.access(sibling, os.X_OK)
        else shutil.which(command.binary)
    )
    if not executable:
        raise HTTPException(400, f"{command.binary} is not installed in the runner environment.")
    return executable, directory


async def execute(job: Job, executable: str, directory: Path, args: list[str]):
    process = None
    try:
        # Never inherit API keys or wallet configuration from the server.
        environment = {key: os.environ[key] for key in ('PATH', 'HOME', 'TMPDIR', 'LANG') if key in os.environ}
        environment['PYTHONUNBUFFERED'] = '1'
        environment['BT_NETWORK'] = chain_endpoint()
        environment['BT_FALLBACK_ENDPOINTS'] = 'none'
        # Copied virtualenv launchers can retain obsolete absolute shebangs.
        invocation = [executable, *args]
        if Path(executable) == Path(sys.executable).parent / "btcli":
            invocation = [sys.executable, executable, *args]
        process = await asyncio.create_subprocess_exec(
            *invocation, cwd=directory, env=environment,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
            stdin=asyncio.subprocess.DEVNULL, start_new_session=True,
        )
        size = 0
        async with asyncio.timeout(120):
            while chunk := await process.stdout.read(4096):
                size += len(chunk)
                if size > LIMIT:
                    job.events.append({'type': 'error', 'message': 'Output limit exceeded; process stopped.'})
                    break
                job.events.append({'type': 'output', 'text': chunk.decode('utf-8', errors='replace')})
            else:
                code = await process.wait()
                job.events.append({'type': 'exit', 'code': code})
                return
    except TimeoutError:
        job.events.append({'type': 'error', 'message': 'Command timed out after 120 seconds.'})
    except asyncio.CancelledError:
        job.events.append({'type': 'error', 'message': 'Runner is shutting down.'})
        raise
    except OSError:
        job.events.append({'type': 'error', 'message': 'Could not start command.'})
    finally:
        if process:
            # Also clean up descendants after the parent exits.
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            await process.wait()
        job.done = True


@router.post('/exec')
async def start(command: Command, request: Request):
    if request.headers.get('x-bitcode-client') != 'studio':
        raise HTTPException(403, 'Missing Bitcode client header.')
    ROOT.mkdir(parents=True, exist_ok=True)
    executable, directory = resolve_command(command)
    chain_endpoint()  # Report invalid configuration before starting a background job.
    if sum(not job.done for job in jobs.values()) >= 4:
        raise HTTPException(429, 'Four commands are already running.')
    if len(jobs) >= 32:
        for key in list(jobs):
            if jobs[key].done:
                del jobs[key]
                break
    identifier = uuid4().hex
    job = Job()
    jobs[identifier] = job
    job.task = asyncio.create_task(execute(job, executable, directory, command.args))
    return {'id': identifier}


@router.websocket('/ws/exec/{identifier}')
async def logs(websocket: WebSocket, identifier: str):
    if websocket.headers.get('origin') != ORIGIN or identifier not in jobs:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    job = jobs[identifier]
    position = 0
    try:
        while True:
            while position < len(job.events):
                await websocket.send_json(job.events[position])
                position += 1
            if job.done:
                await websocket.close()
                return
            await asyncio.sleep(.1)
    except WebSocketDisconnect:
        pass


async def shutdown():
    tasks = [job.task for job in jobs.values() if job.task and not job.task.done()]
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
