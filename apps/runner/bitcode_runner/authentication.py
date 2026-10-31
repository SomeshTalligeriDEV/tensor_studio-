"""Authenticate all runner routes, including WebSockets, before dispatch."""
import os
import secrets
from urllib.parse import urlsplit
from .session_tokens import verify_session

from starlette.datastructures import Headers
from starlette.responses import JSONResponse


class RunnerAuthenticationMiddleware:
    def __init__(self, app, origin: str):
        self.app = app
        self.origin = origin

    async def __call__(self, scope, receive, send):
        if scope['type'] not in {'http', 'websocket'}:
            return await self.app(scope, receive, send)
        if scope['type'] == 'http' and scope.get('method') == 'GET' and scope.get('path') == '/healthz':
            return await self.app(scope, receive, send)
        headers = Headers(scope=scope)
        origin = headers.get('origin')
        websocket = scope['type'] == 'websocket'
        error = None
        status = 401
        if (origin and origin != self.origin) or (websocket and origin != self.origin):
            error, status = 'Origin is not allowed', 403
        elif not websocket and scope['method'] == 'OPTIONS' and headers.get('access-control-request-method'):
            # Browser preflight carries no credentials; CORS validates its headers.
            return await self.app(scope, receive, send)
        else:
            expected = os.getenv('RUNNER_TOKEN', '')
            supplied = headers.get('x-runner-token') or headers.get('authorization', '').removeprefix('Bearer ')
            if websocket:
                supplied = next((p.removeprefix('runner-token.') for p in scope.get('subprotocols', []) if p.startswith('runner-token.')), supplied)
            local = urlsplit(self.origin).hostname in {'localhost', '127.0.0.1', '::1'}
            if not local:
                secret = os.getenv('RUNNER_SESSION_SECRET', '')
                if len(secret.encode()) < 32:
                    error, status = 'Runner session authentication is not configured.', 503
                elif origin != self.origin or not self.origin.startswith('https://') or not verify_session(supplied, secret, self.origin):
                    error = 'Invalid or expired runner session'
            elif not expected:
                error, status = 'Runner authentication is not configured. Set RUNNER_TOKEN.', 503
            elif not secrets.compare_digest(expected.encode(), supplied.encode()):
                error = 'Invalid or missing runner token'
        if error:
            if websocket:
                await send({'type': 'websocket.close', 'code': 1008})
            else:
                await JSONResponse({'detail': error}, status_code=status)(scope, receive, send)
            return
        async def authenticated_send(message):
            # Browsers require the offered authentication protocol to be selected.
            if websocket and message['type'] == 'websocket.accept':
                protocol = next((p for p in scope.get('subprotocols', []) if p.startswith('runner-token.')), None)
                if protocol:
                    message = {**message, 'subprotocol': protocol}
            await send(message)

        await self.app(scope, receive, authenticated_send)
