"""Strict dependency-free verification of short lived owner HS256 sessions."""
import base64
import hashlib
import hmac
import json
import time


def verify_session(token: str, secret: str, origin: str, now=None) -> bool:
    if len(secret.encode()) < 32 or len(token) > 8192:
        return False
    try:
        header, payload, signature = token.split('.')
        def decode(value):
            if not value or any(c not in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_' for c in value):
                raise ValueError('Invalid base64url')
            return base64.urlsafe_b64decode(value + '=' * (-len(value) % 4))
        metadata = json.loads(decode(header))
        if metadata != {'alg': 'HS256', 'typ': 'JWT'}:
            return False
        expected = hmac.new(secret.encode(), f'{header}.{payload}'.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, decode(signature)):
            return False
        claims = json.loads(decode(payload))
        if not isinstance(claims, dict):
            return False
        current = time.time() if now is None else now
        issued, expires = claims.get('iat'), claims.get('exp')
        return (claims.get('aud') == 'tensorstudio-runner' and claims.get('sub') == 'studio'
                and claims.get('iss') == origin and claims.get('scope') == 'runner:owner'
                and type(issued) is int and type(expires) is int
                and issued <= current < expires and 0 < expires - issued <= 300
                and ('nbf' not in claims or (type(claims['nbf']) is int and claims['nbf'] <= current)))
    except (ValueError, TypeError, KeyError, UnicodeError):
        return False
