import { describe, expect, it } from 'vitest';
import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { loader } from '../../routes/api.runner-session';

function call(url = 'http://localhost:5173/api/runner-session', headers: Record<string, string> = { 'X-Bitcode-Client': 'studio' }) {
  return loader({ request: new Request(url, { headers }), context: { cloudflare: { env: { RUNNER_TOKEN: 'disposable-token', AI_API_KEY: 'never-return' } } } } as unknown as LoaderFunctionArgs);
}

describe('local runner session', () => {
  it('returns only runner token and disables caching', async () => {
    const response = call();
    expect(await response.json()).toEqual({ token: 'disposable-token' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('rejects missing custom header, foreign origins, remote hosts and cross-site fetches', () => {
    expect(call(undefined, {}).status).toBe(403);
    expect(call(undefined, { 'X-Bitcode-Client': 'studio', Origin: 'https://evil.example' }).status).toBe(403);
    expect(call('http://evil.example/api/runner-session').status).toBe(403);
    expect(call(undefined, { 'X-Bitcode-Client': 'studio', 'Sec-Fetch-Site': 'cross-site' }).status).toBe(403);
  });
});
