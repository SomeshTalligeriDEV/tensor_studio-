import { runnerFetch, runnerWebSocket } from '~/lib/runner/client';
import { useSearchParams } from '@remix-run/react';
import { useEffect, useRef, useState } from 'react';

export default function RunnerConsole() {
  const [binary, setBinary] = useState('python');
  const [args, setArgs] = useState('["--version"]');
  const [params] = useSearchParams();
  const [cwd, setCwd] = useState(params.get('project') || '.');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const socket = useRef<WebSocket>();
  useEffect(() => () => socket.current?.close(), []);
  async function run() {
    setBusy(true);
    setOutput('');
    try {
      const parsed: unknown = JSON.parse(args);
      if (!Array.isArray(parsed) || !parsed.every((arg) => typeof arg === 'string')) throw new Error('Arguments must be a JSON array of strings.');
      const response = await runnerFetch('http://127.0.0.1:8787/exec', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Bitcode-Client': 'studio' },
        body: JSON.stringify({ binary, args: parsed, cwd }), signal: AbortSignal.timeout(10000),
      });
      const data = await response.json() as { id: string; detail?: string };
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Command rejected.');
      setOutput(`$ ${binary} ${JSON.stringify(parsed)}\n`);
      const ws = await runnerWebSocket(`ws://127.0.0.1:8787/ws/exec/${data.id}`);
      socket.current = ws;
      ws.onmessage = (event) => {
        const entry = JSON.parse(event.data) as { type: string; text?: string; message?: string; code?: number };
        if (entry.type === 'exit') { setBusy(false); ws.close(); }
        setOutput((value) => value + (entry.type === 'output' ? entry.text : entry.type === 'exit' ? `\nExited with code ${entry.code}\n` : `\n${entry.message}\n`));
      };
      ws.onerror = () => setOutput((value) => `${value}\nLog connection failed.\n`);
      ws.onclose = () => setBusy(false);
    } catch (error) {
      setOutput(error instanceof Error ? error.message : 'Runner unavailable.');
      setBusy(false);
    }
  }
  return <main className="studio-home">
    <p className="studio-eyebrow">LOCAL WORKSPACE</p><h1>Runner terminal</h1>
    <p>Run btcli, Python, or uv on your connected runner. Commands run without a shell, inside the configured projects directory. This is trusted code execution for the workspace owner, not a public sandbox.</p>
    <form onSubmit={(event) => { event.preventDefault(); void run(); }} className="flex flex-col gap-4 mt-6">
      <label>Program <select value={binary} onChange={(event) => setBinary(event.target.value)} className="bg-bitcode-elements-background-depth-2"><option>python</option><option>btcli</option><option>uv</option></select></label>
      <label>Arguments (JSON array)<input className="block w-full p-2 bg-bitcode-elements-background-depth-2" value={args} onChange={(event) => setArgs(event.target.value)} /></label>
      <label>Project folder<input className="block w-full p-2 bg-bitcode-elements-background-depth-2" value={cwd} onChange={(event) => setCwd(event.target.value)} /></label>
      <button type="submit" disabled={busy} className="p-2 border rounded">{busy ? 'Running…' : 'Run command'}</button>
    </form>
    <pre className="mt-6 p-4 border rounded overflow-auto whitespace-pre-wrap" aria-label="Runner output">{output || 'Command output will appear here.'}</pre>
  </main>;
}
