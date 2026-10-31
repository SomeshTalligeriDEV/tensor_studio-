export type RunnerConnection = { mode: 'local' | 'hosted'; url: string; token: string };
const LOCAL = 'http://127.0.0.1:8787';
export function runnerTarget(input: string, connection: RunnerConnection, websocket = false): string {
  const source = new URL(input, websocket ? 'ws://127.0.0.1:8787' : LOCAL);
  if (source.origin !== (websocket ? 'ws://127.0.0.1:8787' : LOCAL) || source.username || source.password) throw new Error('Runner requests must target the local runner.');
  const target = new URL(connection.url);
  if (target.username || target.password || target.pathname !== '/' || target.search || target.hash || (connection.mode === 'hosted' ? target.protocol !== 'https:' : target.origin !== LOCAL)) throw new Error('Invalid runner connection origin.');
  target.pathname = source.pathname; target.search = source.search; target.hash = source.hash;
  if (websocket) target.protocol = connection.mode === 'hosted' ? 'wss:' : 'ws:';
  return target.href;
}
