"""Docker-backed local miners. No host mounts, wallet keys, or simulated state."""
import hashlib
import asyncio
import io
import json
import os
import tarfile
import threading
from contextlib import contextmanager
from uuid import uuid4
from urllib.parse import urlsplit

import docker
import bittensor as bt
from docker.errors import DockerException, NotFound
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from bittensor.keyfiles import Keypair

from . import execution
from .funding import assert_development_chain
from subcreate.assemble import render
from subcreate.recipe import Recipe

router = APIRouter()
LABEL = 'studio.bitcode.node'
NETWORK = 'bitcode-nodes'
launch_lock = threading.Lock()
DOCKERFILE = '''FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdir /state && chown 10001:10001 /state
USER 10001:10001
'''


class MinerLaunch(BaseModel):
    model_config = ConfigDict(extra='forbid')
    project: str = Field(pattern=r'^subcreate-[a-f0-9]{32}$')
    netuid: int = Field(gt=0, lt=65536)
    hotkey: str = Field(min_length=47, max_length=48)
    validators: list[str] = Field(min_length=1, max_length=32)


class ValidatorLaunch(BaseModel):
    model_config = ConfigDict(extra='forbid')
    project: str = Field(pattern=r'^subcreate-[a-f0-9]{32}$')
    netuid: int = Field(gt=0, lt=65536)
    dev_hotkey: str = Field(pattern=r'^bitcode-[a-z0-9-]{1,48}$')


def node_network(client):
    try:
        network = client.networks.get(NETWORK)
        if (network.attrs.get('Labels') or {}).get(LABEL) != 'true':
            raise HTTPException(409, 'Node network name belongs to an unmanaged network.')
    except NotFound:
        network = client.networks.create(NETWORK, driver='bridge', labels={LABEL: 'true'})
    return network


async def validator_preflight(body):
    async with asyncio.timeout(20):
        await assert_development_chain()
        address = Keypair.create_from_uri('//Alice//' + body.dev_hotkey).ss58_address
        async with bt.Subtensor('ws://127.0.0.1:9944', fallback_endpoints=[]) as chain:
            metagraph = await chain.subnets.metagraph(body.netuid)
            if metagraph is None or not any(neuron.hotkey == address for neuron in metagraph.neurons):
                raise HTTPException(409, 'This development hotkey is not registered on the requested local subnet.')
        return address


@contextmanager
def connection():
    client = None
    try:
        client = docker.from_env(timeout=600)
        yield client
    except NotFound:
        raise HTTPException(404, 'Node not found.') from None
    except DockerException:
        raise HTTPException(503, 'Docker operation failed. Check Docker availability and image build logs in Docker.') from None
    finally:
        if client:
            client.close()


def require_client(request):
    if request.headers.get('x-bitcode-client') != 'studio':
        raise HTTPException(403, 'Missing Bitcode client header.')


def owned(client, node_id):
    container = client.containers.get(node_id)
    if container.labels.get(LABEL) != 'true':
        raise HTTPException(403, 'This container is not a Bitcode node.')
    return container


def build_context(project):
    """Only reviewed template bytes plus validated user data enter the image."""
    folder = execution.ROOT / project
    if folder.is_symlink() or not folder.is_dir():
        raise HTTPException(404, 'Assembled project not found.')
    try:
        def read(name):
            path = folder / name
            if path.is_symlink() or not path.resolve().is_relative_to(folder.resolve()) or path.stat().st_size > 2 * 1024 * 1024:
                raise ValueError('Invalid project file')
            return path.read_text()
        recipe = Recipe.model_validate_json(read('recipe.json'))
        dataset = [json.loads(line) for line in read('data/custom.jsonl').splitlines()]
        files = render(recipe, dataset)
        # Reject changed source rather than silently launching a different project.
        for name, content in files.items():
            if read(name) != content:
                raise ValueError('Project source differs from current reviewed templates')
    except (OSError, ValueError, KeyError):
        raise HTTPException(409, 'Reassemble this project with the current SubCreate templates before launching. Modified source is not accepted by this launcher.') from None
    files['Dockerfile'] = DOCKERFILE
    archive = io.BytesIO()
    with tarfile.open(fileobj=archive, mode='w') as tar:
        for name, content in files.items():
            data = content.encode()
            info = tarfile.TarInfo(name)
            info.size = len(data)
            info.mode = 0o644
            tar.addfile(info, io.BytesIO(data))
    archive.seek(0)
    digest = hashlib.sha256(archive.getvalue()).hexdigest()
    return archive, 'bitcode-miner:' + digest[:24]


def model_environment():
    base = os.getenv('BITCODE_MODEL_BASE_URL', 'https://llm.chutes.ai/v1')
    model = os.getenv('BITCODE_MODEL_ID', '')
    key = os.getenv('BITCODE_MODEL_API_KEY', '')
    url = urlsplit(base)
    if not model or not key:
        raise HTTPException(409, 'Configure BITCODE_MODEL_ID and BITCODE_MODEL_API_KEY in the local runner environment, then restart the runner. No fallback inference is available.')
    if url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment:
        raise HTTPException(409, 'Container miners currently require an HTTPS model endpoint.')
    return {'BITCODE_MODEL_BASE_URL': base, 'BITCODE_MODEL_ID': model, 'BITCODE_MODEL_API_KEY': key}


def describe(container, metrics=False):
    container.reload()
    state = container.attrs['State']
    ports = container.attrs.get('NetworkSettings', {}).get('Ports') or {}
    bindings = ports.get('8091/tcp') or []
    networks = container.attrs.get('NetworkSettings', {}).get('Networks', {})
    ip = networks.get(NETWORK, {}).get('IPAddress')
    result = {'id': container.id, 'name': container.name, 'role': container.labels.get('bitcode.role'),
              'project': container.labels.get('bitcode.project'), 'netuid': container.labels.get('bitcode.netuid'),
              'hotkey': container.labels.get('bitcode.hotkey'), 'status': state['Status'],
              'started_at': state.get('StartedAt'), 'exit_code': state.get('ExitCode') if state['Status'] == 'exited' else None,
              'health': state.get('Health', {}).get('Status', 'unknown'),
              'host_url': 'http://127.0.0.1:' + bindings[0]['HostPort'] if bindings else None,
              'container_endpoint': f'{ip}:8091' if ip and container.labels.get('bitcode.role') == 'miner' else None,
              'cpu_percent': None, 'memory_bytes': None, 'metrics_error': None,
              'chain_status': 'registration_and_serving_not_verified'}
    if metrics and state['Status'] == 'running':
        try:
            stats = container.stats(stream=False)
            cpu, previous = stats['cpu_stats'], stats['precpu_stats']
            delta = cpu['cpu_usage']['total_usage'] - previous.get('cpu_usage', {}).get('total_usage', 0)
            system = cpu.get('system_cpu_usage', 0) - previous.get('system_cpu_usage', 0)
            if system > 0 and delta >= 0:
                result['cpu_percent'] = delta / system * cpu.get('online_cpus', 1) * 100
            result['memory_bytes'] = stats.get('memory_stats', {}).get('usage')
        except (DockerException, KeyError, TypeError):
            result['metrics_error'] = 'Docker metrics unavailable'
    return result


@router.get('/nodes')
def list_nodes():
    with connection() as client:
        return {'nodes': [describe(node) for node in client.containers.list(all=True, filters={'label': LABEL + '=true'})]}


@router.get('/nodes/{node_id}')
def node_details(node_id: str):
    with connection() as client:
        return describe(owned(client, node_id), metrics=True)


@router.get('/nodes/{node_id}/logs')
def node_logs(node_id: str):
    with connection() as client:
        logs = owned(client, node_id).logs(tail=200, timestamps=True).decode('utf-8', errors='replace')[-65536:]
        # Inference code never logs credentials. Also redact the configured key.
        key = os.getenv('BITCODE_MODEL_API_KEY')
        if key:
            logs = logs.replace(key, '[redacted]')
        return {'text': logs}


@router.post('/nodes/miner')
def launch_miner(body: MinerLaunch, request: Request):
    require_client(request)
    env = model_environment()
    async def check_chain():
        async with asyncio.timeout(5):
            await assert_development_chain()
    try:
        asyncio.run(check_chain())
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, 'Start the local Bittensor development chain before launching nodes.') from None
    try:
        for address in [body.hotkey, *body.validators]:
            Keypair(ss58_address=address)
    except (ValueError, TypeError):
        raise HTTPException(422, 'Use valid SS58 public addresses.') from None
    if not launch_lock.acquire(blocking=False):
        raise HTTPException(409, 'Another node is being built. Wait for that launch to finish.')
    try:
        context, image = build_context(body.project)
        with connection() as client:
            existing = client.containers.list(all=True, filters={'label': [LABEL + '=true', 'bitcode.hotkey=' + body.hotkey, 'bitcode.netuid=' + str(body.netuid)]})
            if existing:
                raise HTTPException(409, 'A node already exists for this hotkey and subnet. Start the existing node.')
            if len(client.containers.list(all=True, filters={'label': LABEL + '=true'})) >= 8:
                raise HTTPException(409, 'Local node limit (8) reached.')
            try:
                client.images.get(image)
            except NotFound:
                client.images.build(fileobj=context, custom_context=True, tag=image, rm=True, forcerm=True, timeout=600, use_config_proxy=False)
            network = node_network(client)
            command = ['python', 'miner.py', '--host', '0.0.0.0', '--hotkey', body.hotkey]
            for validator in body.validators:
                command.extend(['--validator', validator])
            node = client.containers.create(image, command=command, name='bitcode-miner-' + uuid4().hex[:12],
                labels={LABEL: 'true', 'bitcode.role': 'miner', 'bitcode.project': body.project, 'bitcode.netuid': str(body.netuid), 'bitcode.hotkey': body.hotkey},
                environment=env, network=network.name, ports={'8091/tcp': ('127.0.0.1', None)},
                restart_policy={'Name': 'unless-stopped'}, read_only=True, tmpfs={'/tmp': 'rw,noexec,nosuid,size=64m'},
                cap_drop=['ALL'], security_opt=['no-new-privileges:true'], mem_limit='512m', nano_cpus=1_000_000_000, pids_limit=128,
                log_config=docker.types.LogConfig(type='json-file', config={'max-size': '5m', 'max-file': '2'}),
                healthcheck={'test': ['CMD', 'python', '-c', "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8091/health',timeout=2)"], 'interval': 5_000_000_000, 'timeout': 3_000_000_000, 'retries': 3})
            node.start()
            return describe(node)
    finally:
        launch_lock.release()


@router.post('/nodes/validator')
def launch_validator(body: ValidatorLaunch, request: Request):
    require_client(request)
    try:
        address = asyncio.run(validator_preflight(body))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, 'Local chain registration check failed. Start localnet and verify the subnet.') from None
    if not launch_lock.acquire(blocking=False):
        raise HTTPException(409, 'Another node is being built. Wait for that launch to finish.')
    try:
        context, image = build_context(body.project)
        with connection() as client:
            existing = client.containers.list(all=True, filters={'label': [LABEL + '=true', 'bitcode.hotkey=' + address, 'bitcode.netuid=' + str(body.netuid)]})
            if existing:
                raise HTTPException(409, 'A node already exists for this identity and subnet.')
            if len(client.containers.list(all=True, filters={'label': LABEL + '=true'})) >= 8:
                raise HTTPException(409, 'Local node limit (8) reached.')
            localnet = client.containers.get('bitcode-localnet')
            if localnet.labels.get('studio.bitcode.managed') != 'true' or localnet.status != 'running':
                raise HTTPException(409, 'The managed localnet container must be running.')
            network = node_network(client)
            localnet.reload()
            if NETWORK not in localnet.attrs['NetworkSettings']['Networks']:
                network.connect(localnet, aliases=['bitcode-localnet'])
            network.reload()
            configs = network.attrs.get('IPAM', {}).get('Config', [])
            subnet = next((value['Subnet'] for value in configs if ':' not in value.get('Subnet', ':')), None)
            if not subnet:
                raise HTTPException(409, 'Docker node network has no IPv4 subnet.')
            try:
                client.images.get(image)
            except NotFound:
                client.images.build(fileobj=context, custom_context=True, tag=image, rm=True, forcerm=True, timeout=600, use_config_proxy=False)
            name = 'bitcode-validator-' + uuid4().hex[:12]
            volume = client.volumes.create(name=name + '-state', labels={LABEL: 'true'})
            node = None
            try:
                node = client.containers.create(image,
                    command=['python', 'validator.py', '--dev-hotkey', body.dev_hotkey, '--netuid', str(body.netuid), '--rounds', '0'],
                    name=name, labels={LABEL: 'true', 'bitcode.role': 'validator', 'bitcode.project': body.project,
                                      'bitcode.netuid': str(body.netuid), 'bitcode.hotkey': address, 'bitcode.weights': 'preview_only'},
                    environment={'BITCODE_CHAIN_ENDPOINT': 'ws://bitcode-localnet:9944', 'BITCODE_MINER_SUBNET': subnet,
                                 'BITCODE_STATE_DIR': '/state'}, network=network.name,
                    volumes={volume.name: {'bind': '/state', 'mode': 'rw'}},
                    restart_policy={'Name': 'unless-stopped'}, read_only=True, tmpfs={'/tmp': 'rw,noexec,nosuid,size=64m'},
                    cap_drop=['ALL'], security_opt=['no-new-privileges:true'], mem_limit='512m', nano_cpus=1_000_000_000,
                    pids_limit=128, log_config=docker.types.LogConfig(type='json-file', config={'max-size': '5m', 'max-file': '2'}))
                node.start()
                return describe(node)
            except Exception:
                # Keep a created container and its checkpoint volume for inspection/retry.
                if node is None:
                    volume.remove()
                raise
    finally:
        launch_lock.release()


@router.post('/nodes/{node_id}/{action}')
def control_node(node_id: str, action: str, request: Request):
    require_client(request)
    if action not in ('start', 'stop'):
        raise HTTPException(422, 'Supported actions: start, stop.')
    with connection() as client:
        node = owned(client, node_id)
        if action == 'start':
            node.start()
        else:
            node.stop(timeout=10)
        return describe(node)
