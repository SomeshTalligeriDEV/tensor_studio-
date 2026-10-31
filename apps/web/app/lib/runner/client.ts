import { runnerTarget, type RunnerConnection } from './transport';
let session: Promise<RunnerConnection> | undefined;
let expires = 0;
async function runnerConnection(): Promise<RunnerConnection> {
  if (Date.now() >= expires) session = undefined;
  session ??= fetch('/api/runner-connection', {
    headers: { 'X-Bitcode-Client': 'studio' }, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(5000),
  }).then(async response => {
    if (!response.ok) throw new Error('Runner authentication is unavailable. Check runner connection configuration.');
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object') throw new Error('Invalid runner connection.');
    const connection = value as Partial<RunnerConnection>;
    if (connection.mode === 'hosted') {
      if (typeof connection.url !== 'string' || typeof connection.token !== 'string' || !connection.token) throw new Error('Invalid runner connection.');
      runnerTarget('/', connection as RunnerConnection);
      expires = Date.now() + 240000;
      return connection as RunnerConnection;
    }
    if (connection.mode !== 'local') throw new Error('Invalid runner connection.');
    const local = await fetch('/api/runner-session', { headers: { 'X-Bitcode-Client': 'studio' }, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!local.ok) throw new Error('Local runner authentication is unavailable. Configure RUNNER_TOKEN.');
    const data = await local.json() as { token: string };
    expires = Infinity;
    return { mode: 'local', url: 'http://127.0.0.1:8787', token: data.token } as RunnerConnection;
  }).catch(error => { session = undefined; throw error; });
  return session;
}
export async function runnerFetch(input: string, init: RequestInit = {}): Promise<Response> {
  init.signal?.throwIfAborted();
  const connection = await runnerConnection();
  init.signal?.throwIfAborted();
  const headers = new Headers(init.headers);
  headers.delete('Authorization');
  headers.set('X-Runner-Token', connection.token);
  headers.set('X-Bitcode-Client', 'studio');
  const response = await fetch(runnerTarget(input, connection), { ...init, credentials: 'omit', headers, redirect: 'error' });
  if (response.status === 401) session = undefined;
  return response;
}
export async function runnerWebSocket(input: string): Promise<WebSocket> {
  const connection = await runnerConnection();
  return new WebSocket(runnerTarget(input, connection, true), [`runner-token.${connection.token}`]);
}
