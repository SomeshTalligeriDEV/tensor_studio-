"""Loopback-only localnet controller. No keys or arbitrary commands accepted."""
import asyncio
import json
import os
from contextlib import contextmanager, asynccontextmanager

import docker
import uvicorn
from docker.errors import DockerException, NotFound
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware
from websockets.asyncio.client import connect

from .authentication import RunnerAuthenticationMiddleware
from .chain_config import chain_endpoint
from . import process_nodes, harness
from .execution import router, shutdown
from .projects import router as projects_router
from .funding import router as funding_router
from .subcreate import router as subcreate_router
from .nodes import router as nodes_router
from .node_chain import router as node_chain_router


@asynccontextmanager
async def lifespan(app):
    yield
    await process_nodes.shutdown()
    await shutdown()


IMAGE = "ghcr.io/raofoundation/subtensor-localnet:devnet"
NAME = "bitcode-localnet"
LABEL = "studio.bitcode.managed"
ORIGIN = os.getenv("BITCODE_WEB_ORIGIN", "http://localhost:5173")
app = FastAPI(title="TensorStudio runner", lifespan=lifespan)
app.include_router(router)
app.include_router(projects_router)
app.include_router(funding_router)
app.include_router(subcreate_router)
app.include_router(node_chain_router)
app.include_router(nodes_router)
app.include_router(process_nodes.router)
app.include_router(harness.router)
runner_hosts = ["localhost", "127.0.0.1", "testserver"]
render_hostname = os.getenv("RENDER_EXTERNAL_HOSTNAME", "")
if render_hostname and all(part and all(c.isalnum() or c == '-' for c in part) for part in render_hostname.split('.')):
    runner_hosts.append(render_hostname)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=runner_hosts)
app.add_middleware(CORSMiddleware, allow_origins=[ORIGIN], allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Content-Type", "X-Bitcode-Client", "Authorization", "X-Runner-Token"])
app.add_middleware(RunnerAuthenticationMiddleware, origin=ORIGIN)
lock = asyncio.Lock()


@app.middleware("http")
async def check_origin(request: Request, call_next):
    # CORS alone does not reject cross-origin mutations.
    origin = request.headers.get("origin")
    if origin and origin != ORIGIN:
        return JSONResponse({"detail": "Origin is not allowed"}, status_code=403)
    return await call_next(request)


@contextmanager
def client():
    connection = docker.from_env(timeout=10)
    try:
        yield connection
    finally:
        connection.close()


def owned_container(connection):
    container = connection.containers.get(NAME)
    if container.labels.get(LABEL) != "true":
        raise HTTPException(409, "Container name is occupied by an unmanaged container.")
    return container


def docker_status():
    try:
        with client() as connection:
            connection.ping()
            try:
                state = owned_container(connection).status
            except NotFound:
                state = "absent"
            return {"available": True, "container": state}
    except DockerException:
        return {"available": False, "container": "unknown"}


async def latest_block():
    try:
        async with asyncio.timeout(2):
            async with connect(chain_endpoint(), open_timeout=1) as websocket:
                await websocket.send(json.dumps({"jsonrpc": "2.0", "id": 1, "method": "chain_getHeader", "params": []}))
                result = json.loads(await websocket.recv())
                return int(result["result"]["number"], 16)
    except Exception:
        return None


@app.get("/healthz")
async def liveness():
    return {"service": "tensorstudio-runner", "status": "ok"}


@app.get("/chain/status")
async def chain_status():
    block = await latest_block()
    return {"ready": block is not None, "block": block}


@app.get("/health")
async def health():
    status, block = await asyncio.gather(asyncio.to_thread(docker_status), latest_block())
    return {"runner": "online", "docker": status, "localnet": {"ready": block is not None, "block": block}}


def change_localnet(start: bool):
    try:
        with client() as connection:
            try:
                container = owned_container(connection)
            except NotFound:
                if not start:
                    return {"state": "absent"}
                # Pull explicitly before startup, so missing images produce a useful error.
                try:
                    connection.images.get(IMAGE)
                except NotFound:
                    raise HTTPException(409, f"Pull the localnet image first: docker pull {IMAGE}")
                container = connection.containers.run(
                    IMAGE, command=["True", "--no-purge"], name=NAME, detach=True, labels={LABEL: "true"},
                    ports={"9944/tcp": ("127.0.0.1", 9944), "9945/tcp": ("127.0.0.1", 9945)},
                )
            if start:
                container.start()
            else:
                container.stop(timeout=10)
            container.reload()
            return {"state": container.status}
    except DockerException:
        raise HTTPException(503, "Docker is unavailable or the operation failed. Check Docker and port availability.")


@app.post("/localnet/start")
async def start_localnet():
    async with lock:
        return await asyncio.to_thread(change_localnet, True)


@app.post("/localnet/stop")
async def stop_localnet():
    async with lock:
        return await asyncio.to_thread(change_localnet, False)


def run():
    uvicorn.run(app, host="127.0.0.1", port=8787)
