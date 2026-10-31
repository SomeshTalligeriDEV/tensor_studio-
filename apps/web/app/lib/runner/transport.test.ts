import { describe, it, expect } from 'vitest';
import { runnerTarget } from './transport';
import { loader } from '../../routes/api.runner-connection';
import { jwtVerify } from 'jose';
import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
const secret = 'disposable-session-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const env = { PUBLIC_ORIGIN: 'https://studio.example.test', RUNNER_PUBLIC_URL: 'https://runner.example.test', RUNNER_SESSION_SECRET: secret };
function call(overrides = {}, url = 'https://studio.example.test/api/runner-connection', headers = { 'X-Bitcode-Client': 'studio' }) {
  return loader({ request: new Request(url, { headers }), context: { cloudflare: { env: { ...env, ...overrides } } } } as unknown as LoaderFunctionArgs);
}
describe('runner target transport', () => {
  const remote = { mode: 'hosted' as const, url: 'https://runner.example.test', token: 'test' };
  it('maps exact local inputs to configured HTTPS/WSS origins', () => {
    expect(runnerTarget('http://127.0.0.1:8787/health?x=1', remote)).toBe('https://runner.example.test/health?x=1');
    expect(runnerTarget('ws://127.0.0.1:8787/ws/exec/1', remote, true)).toBe('wss://runner.example.test/ws/exec/1');
    expect(runnerTarget('/health', { mode: 'local', url: 'http://127.0.0.1:8787', token: '' })).toBe('http://127.0.0.1:8787/health');
  });
  it('rejects arbitrary targets and credentials', () => {
    for (const input of ['https://evil.example/health', '//evil.example/health', 'http://secret@127.0.0.1:8787/']) expect(() => runnerTarget(input, remote)).toThrow();
    for (const url of ['http://runner.example.test', 'https://secret@runner.example.test', 'https://runner.example.test/path', 'https://runner.example.test?q=1']) expect(() => runnerTarget('/', { ...remote, url })).toThrow();
  });
});
describe('hosted runner connection', () => {
  it('issues only scoped short lived JWT, never shared runner token', async () => {
    const response = await call({ RUNNER_TOKEN: 'never-return-shared-token' });
    const body = await response.json() as { token: string; url: string; mode: string };
    expect(body.mode).toBe('hosted'); expect(body.url).toBe(env.RUNNER_PUBLIC_URL);
    const { payload } = await jwtVerify(body.token, new TextEncoder().encode(secret), { audience: 'tensorstudio-runner', issuer: env.PUBLIC_ORIGIN });
    expect(payload.sub).toBe('studio'); expect(payload.scope).toBe('runner:owner'); expect(payload.exp! - payload.iat!).toBe(300);
    expect(JSON.stringify(body)).not.toContain('never-return-shared-token');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });
  it('fails closed for missing or insecure config and foreign request origins', async () => {
    for (const changes of [{ RUNNER_SESSION_SECRET: '' }, { RUNNER_PUBLIC_URL: 'http://runner.example.test' }, { PUBLIC_ORIGIN: 'https://other.example' }, { RUNNER_PUBLIC_URL: 'https://user:pass@runner.example.test' }]) expect((await call(changes)).status).toBe(503);
    expect((await call({}, undefined, {} as { 'X-Bitcode-Client': string })).status).toBe(403);
    expect((await call({}, undefined, { 'X-Bitcode-Client': 'studio', Origin: 'https://evil.example' } as never)).status).toBe(403);
  });
  it('preserves localhost connection fallback', async () => { expect(await (await call({}, 'http://localhost:5173/api/runner-connection')).json()).toEqual({ mode: 'local' }); });
});
