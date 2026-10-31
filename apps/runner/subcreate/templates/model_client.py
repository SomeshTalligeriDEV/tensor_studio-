"""Real OpenAI-compatible inference. No canned responses or dataset lookups."""
import ipaddress
import json
import os
from urllib.parse import urlsplit
import httpx


class InferenceUnavailable(RuntimeError):
    pass


class ModelClient:
    def __init__(self):
        self.base = os.environ.get('BITCODE_MODEL_BASE_URL', 'https://llm.chutes.ai/v1').rstrip('/')
        self.model = os.environ.get('BITCODE_MODEL_ID', '')
        self.key = os.environ.get('BITCODE_MODEL_API_KEY', '')
        parsed = urlsplit(self.base)
        try:
            local = ipaddress.ip_address(parsed.hostname or '').is_loopback
        except ValueError:
            local = parsed.hostname == 'localhost'
        if parsed.username or parsed.password or parsed.query or parsed.fragment or not parsed.hostname or (parsed.scheme != 'https' and not (parsed.scheme == 'http' and local)):
            raise InferenceUnavailable('Model endpoint must use HTTPS, or HTTP on loopback for a local model.')
        if not self.model or (not self.key and not local):
            raise InferenceUnavailable('Set BITCODE_MODEL_ID and BITCODE_MODEL_API_KEY on the miner. No fallback answer is configured.')

    async def answer(self, task: str, text: str, labels: list[str]) -> str:
        instruction = 'Answer the user question accurately and concisely. If unsure, say you do not know.'
        if task == 'classify':
            instruction = 'Classify the user input. Return exactly one of these labels, with no explanation: ' + json.dumps(labels)
        headers = {'Content-Type': 'application/json'}
        if self.key:
            headers['Authorization'] = 'Bearer ' + self.key
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(25, connect=5), follow_redirects=False, trust_env=False) as client:
                async with client.stream('POST', self.base + '/chat/completions', headers=headers, json={'model': self.model, 'messages': [{'role': 'system', 'content': instruction}, {'role': 'user', 'content': text}], 'max_tokens': 512, 'temperature': 0}) as response:
                    response.raise_for_status()
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        body.extend(chunk)
                        if len(body) > 256 * 1024:
                            raise ValueError('Response too large')
                    answer = json.loads(body)['choices'][0]['message']['content'].strip()
            if not answer or len(answer) > 4096 or (task == 'classify' and answer not in labels):
                raise ValueError('Invalid answer')
            return answer
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError, AttributeError):
            # Never expose upstream headers, credentials, or request bodies in errors.
            raise InferenceUnavailable('Model request failed or returned an invalid answer. No substitute answer was generated.') from None
