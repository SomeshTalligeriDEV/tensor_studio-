"""One credential-free chain endpoint for runner operations."""
import os
from urllib.parse import urlsplit

from fastapi import HTTPException


def chain_endpoint() -> str:
    endpoint = os.getenv('CHAIN_WS', 'ws://127.0.0.1:9944').strip()
    try:
        parsed = urlsplit(endpoint)
        valid = (parsed.scheme in ('ws', 'wss') and parsed.hostname
                 and not parsed.username and not parsed.password
                 and not parsed.query and not parsed.fragment)
        _ = parsed.port
    except ValueError:
        valid = False
    if not valid:
        raise HTTPException(409, 'CHAIN_WS must be a WebSocket URL without credentials, query or fragment.')
    return endpoint
