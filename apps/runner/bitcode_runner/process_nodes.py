"""Bounded local development processes; no Docker, wallets, or chain writes.

Session-only supervision is not an OS security sandbox. Running does not mean
registered, serving on-chain, or healthy. No automatic restart is performed.
"""
import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import signal
import sys
import tempfile
import time
from typing import Literal
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from bittensor.keyfiles import Keypair
from subcreate.assemble import render
from subcreate.recipe import Recipe
from . import execution
from .chain_config import chain_endpoint

router = APIRouter(prefix='/process-nodes')
MAX_NODES = 8
MAX_OUTPUT = 1024 * 1024
MAX_RUNTIME = 24 * 60 * 60


class MinerLaunch(BaseModel):
    model_config = ConfigDict(extra='forbid')
    project: str = Field(pattern=r'^subcreate-[a-f0-9]{32}$')
    netuid: int = Field(gt=0, lt=65536)
    hotkey: str = Field(min_length=47, max_length=48)
    validators: list[str] = Field(min_length=1, max_length=32)
    port: int = Field(default=8091, ge=1024, le=65535)


class ValidatorLaunch(BaseModel):
    model_config = ConfigDict(extra='forbid')
    project: str = Field(pattern=r'^subcreate-[a-f0-9]{32}$')
    netuid: int = Field(gt=0, lt=65536)
    dev_hotkey: str = Field(pattern=r'^bitcode-[a-z0-9-]{1,48}$')


@dataclass
class LaunchPlan:
    command: list[str]
    directory: Path
    environment: dict[str, str] = field(repr=False)
    secrets: list[str] = field(default_factory=list, repr=False)
    temporary: bool = False


@dataclass
class Node:
    id: str
    role: str
    body: MinerLaunch | ValidatorLaunch
    plan: LaunchPlan = field(repr=False)
    process: asyncio.subprocess.Process | None = None
    task: asyncio.Task | None = None
    status: str = 'stopped'
    exit_code: int | None = None
    started_at: str | None = None
    started: float = 0
    logs: str = ''
    error: str | None = None
    lock: asyncio.Lock = field(default_factory=asyncio.Lock, repr=False)
    deleted: bool = False
    group_cleaned: bool = False


registry: dict[str, Node] = {}


def require_client(request):
    if request.headers.get('x-bitcode-client') != 'studio':
        raise HTTPException(403, 'Missing Bitcode client header.')


def reviewed_files(project: str) -> dict[str, str]:
    folder = execution.ROOT / project
    if folder.is_symlink() or not folder.is_dir():
        raise HTTPException(404, 'Assembled project not found.')
    try:
        def read(name):
            path = folder / name
            current = path
            while current != folder:
                if current.is_symlink():
                    raise ValueError('Symlink')
                current = current.parent
            if not path.resolve().is_relative_to(folder.resolve()) or path.stat().st_size > 2 * 1024 * 1024:
                raise ValueError('Invalid project file')
            return path.read_text(encoding='utf-8')
        recipe = Recipe.model_validate_json(read('recipe.json'))
        dataset = [json.loads(line) for line in read('data/' + recipe.ground_truth.params.file).splitlines()]
        files = render(recipe, dataset)
        if any(read(name) != content for name, content in files.items()):
            raise ValueError('Modified source')
        return files
    except (OSError, ValueError, KeyError):
        raise HTTPException(409, 'Reassemble with the current SubCreate templates. Modified sources cannot be launched.') from None


def prepare(body, role: str) -> LaunchPlan:
    files = reviewed_files(body.project)
    environment = {'PATH': os.defpath, 'LANG': 'en_US.UTF-8', 'PYTHONUNBUFFERED': '1',
                   'PYTHONDONTWRITEBYTECODE': '1', 'BT_NETWORK': 'ws://127.0.0.1:9944',
                   'BT_FALLBACK_ENDPOINTS': 'none', 'BITCODE_CHAIN_ENDPOINT': 'ws://127.0.0.1:9944'}
    endpoint = chain_endpoint()
    environment['BT_NETWORK'] = endpoint
    environment['BITCODE_CHAIN_ENDPOINT'] = endpoint
    secrets = []
    if role == 'miner':
        try:
            for address in [body.hotkey, *body.validators]:
                Keypair(ss58_address=address)
        except (ValueError, TypeError):
            raise HTTPException(422, 'Use valid SS58 public addresses.') from None
        from subcreate.templates.model_client import ModelClient, InferenceUnavailable
        try:
            model = ModelClient()
        except InferenceUnavailable:
            raise HTTPException(409, 'Configure the runner model endpoint, model ID and API key (optional for a loopback model) before starting a miner.') from None
        environment.update(BITCODE_MODEL_BASE_URL=model.base, BITCODE_MODEL_ID=model.model, BITCODE_MODEL_API_KEY=model.key)
        secrets = [model.key] if model.key else []
        arguments = ['miner.py', '--host', '127.0.0.1', '--port', str(body.port), '--hotkey', body.hotkey]
        for address in body.validators:
            arguments.extend(['--validator', address])
    else:
        arguments = ['validator.py', '--dev-hotkey', body.dev_hotkey, '--netuid', str(body.netuid), '--rounds', '0']
    directory = Path(tempfile.mkdtemp(prefix='tensorstudio-node-'))
    try:
        for name, content in files.items():
            path = directory / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding='utf-8')
        home = directory / 'home'
        home.mkdir(mode=0o700)
        environment['HOME'] = str(home)
        environment['BITCODE_STATE_DIR'] = str(home)
        bootstrap = "import runpy,sys; sys.path.insert(0,sys.argv[1]); root=sys.argv.pop(1); name=sys.argv.pop(1); runpy.run_path(root+'/'+name,run_name='__main__')"
        return LaunchPlan([sys.executable, '-I', '-u', '-c', bootstrap, str(directory), *arguments], directory, environment, secrets, True)
    except Exception:
        shutil.rmtree(directory)
        raise


def describe(node):
    alive = node.process is not None and node.process.returncode is None
    return {'id': node.id, 'name': 'local-' + node.role + '-' + node.id[:8], 'role': node.role,
            'project': node.body.project, 'netuid': node.body.netuid,
            'hotkey': node.body.hotkey if node.role == 'miner' else Keypair.create_from_uri('//Alice//' + node.body.dev_hotkey).ss58_address,
            'status': node.status, 'started_at': node.started_at, 'exit_code': node.exit_code,
            'uptime_seconds': round(time.monotonic() - node.started, 1) if alive else 0,
            'health': 'not_checked' if alive else 'unavailable',
            'host_url': f'http://127.0.0.1:{node.body.port}' if node.role == 'miner' else None,
            'cpu_percent': None, 'memory_bytes': None, 'metrics_error': 'Process resource metrics not collected.',
            'chain_status': 'registration_and_serving_not_verified', 'weights_mode': 'preview_only',
            'error': node.error, 'runtime': 'local_process', 'persistence': 'runner_session_only'}


def owned(identifier):
    if identifier not in registry:
        raise HTTPException(404, 'Local process node not found.')
    return registry[identifier]


async def terminate(node, drain=False):
    process = node.process
    if process is None or node.group_cleaned:
        return
    async def discard_output():
        while await process.stdout.read(4096):
            pass
    # The supervisor owns stdout. Draining after it stops logging prevents a
    # full pipe from keeping Process.wait() blocked after the child is killed.
    reader = asyncio.create_task(discard_output()) if drain else None
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    try:
        await asyncio.wait_for(process.wait(), 2)
    except TimeoutError:
        pass
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    await process.wait()
    node.group_cleaned = True
    if reader:
        await reader


async def supervise(node):
    size = 0
    try:
        async with asyncio.timeout(MAX_RUNTIME):
            while line := await node.process.stdout.readline():
                size += len(line)
                if size > MAX_OUTPUT:
                    node.error = 'Output limit reached; process stopped.'
                    break
                text = line.decode('utf-8', errors='replace')
                for secret in node.plan.secrets:
                    text = text.replace(secret, '[redacted]')
                node.logs = (node.logs + text)[-65536:]
            else:
                await node.process.wait()
    except TimeoutError:
        node.error = '24-hour session runtime limit reached; start again to continue.'
    except (ValueError, OSError):
        node.error = 'Process output could not be read safely; process stopped.'
    finally:
        await terminate(node, drain=True)
        node.exit_code = node.process.returncode
        if node.status != 'stopped':
            node.status = 'failed' if node.exit_code or node.error else 'exited'


async def start_node(node):
    async with node.lock:
        if node.deleted:
            raise HTTPException(404, 'Local process node not found.')
        return await _start_node(node)


async def _start_node(node):
    if node.process and node.process.returncode is None:
        return describe(node)
    if node.task:
        await node.task
    node.error = None
    node.exit_code = None
    node.group_cleaned = False
    try:
        node.process = await asyncio.create_subprocess_exec(*node.plan.command, cwd=node.plan.directory,
            env=node.plan.environment, stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT, start_new_session=True)
    except OSError:
        node.status = 'failed'
        node.error = 'Could not start the local node process.'
        raise HTTPException(503, node.error) from None
    node.started_at = datetime.now(timezone.utc).isoformat()
    node.started = time.monotonic()
    node.status = 'running'
    node.task = asyncio.create_task(supervise(node))
    return describe(node)


async def launch(body, role, request):
    require_client(request)
    if len(registry) >= MAX_NODES:
        raise HTTPException(409, 'Local node limit (8) reached. Delete a stopped node first.')
    for node in registry.values():
        same_identity = node.role == role and node.body.netuid == body.netuid and (
            node.body.hotkey == body.hotkey if role == 'miner' else node.body.dev_hotkey == body.dev_hotkey)
        if same_identity:
            raise HTTPException(409, 'A node already exists for this identity and subnet.')
        if role == 'miner' and node.role == 'miner' and node.body.port == body.port:
            raise HTTPException(409, 'A local miner already uses this port.')
    node = Node(uuid4().hex, role, body, prepare(body, role))
    registry[node.id] = node
    return await start_node(node)


@router.get('')
async def list_nodes():
    return {'nodes': [describe(node) for node in registry.values()]}


@router.post('/miner')
async def launch_miner(body: MinerLaunch, request: Request):
    return await launch(body, 'miner', request)


@router.post('/validator')
async def launch_validator(body: ValidatorLaunch, request: Request):
    return await launch(body, 'validator', request)


@router.get('/{identifier}')
async def details(identifier: str):
    return describe(owned(identifier))


@router.get('/{identifier}/logs')
async def logs(identifier: str):
    return {'text': owned(identifier).logs}


@router.post('/{identifier}/{action}')
async def control(identifier: str, action: Literal['start', 'stop'], request: Request):
    require_client(request)
    node = owned(identifier)
    if action == 'start':
        return await start_node(node)
    async with node.lock:
        node.status = 'stopped'
        await terminate(node)
        if node.task:
            await node.task
        return describe(node)


@router.delete('/{identifier}')
async def delete(identifier: str, request: Request):
    require_client(request)
    node = owned(identifier)
    async with node.lock:
        if node.process and node.process.returncode is None:
            raise HTTPException(409, 'Stop this node before deleting it.')
        if node.task:
            await node.task
        if node.plan.temporary:
            shutil.rmtree(node.plan.directory, ignore_errors=True)
        node.deleted = True
        registry.pop(identifier, None)
        return {'deleted': True}



async def shutdown():
    for node in list(registry.values()):
        node.status = 'stopped'
        await terminate(node)
        if node.task:
            await node.task
        if node.plan.temporary:
            shutil.rmtree(node.plan.directory, ignore_errors=True)
    registry.clear()
