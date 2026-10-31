import { runnerFetch } from '~/lib/runner/client';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from '@remix-run/react';

const RUNNER = 'http://127.0.0.1:8787';
type ProcessNode = {
  id: string;
  name: string;
  role: 'miner' | 'validator';
  project: string;
  netuid: number;
  hotkey: string;
  status: 'running' | 'stopped' | 'exited' | 'failed';
  started_at: string | null;
  exit_code: number | null;
  uptime_seconds: number;
  host_url: string | null;
  error: string | null;
};

async function request<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await runnerFetch(`${RUNNER}/process-nodes${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Bitcode-Client': 'studio' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(15000),
  });
  const result = await response.json() as T & { detail?: unknown };
  if (!response.ok) {
    throw new Error(typeof result.detail === 'string' ? result.detail : 'Check the project, subnet ID and public identity values.');
  }
  return result;
}

function message(cause: unknown): string {
  if (cause instanceof TypeError) return 'Cannot reach the connected runner. Check the connection and refresh.';
  return cause instanceof Error ? cause.message : 'The runner request failed. Please retry.';
}

export function ProcessNodes() {
  const [params] = useSearchParams();
  const [project, setProject] = useState(params.get('project') || '');
  const [netuid, setNetuid] = useState(params.get('netuid') || '');
  const [role, setRole] = useState<'miner' | 'validator'>('miner');
  const [hotkey, setHotkey] = useState('');
  const [validators, setValidators] = useState('');
  const [port, setPort] = useState('8091');
  const [devHotkey, setDevHotkey] = useState('bitcode-validator');
  const [nodes, setNodes] = useState<ProcessNode[]>([]);
  const [selected, setSelected] = useState('');
  const [logs, setLogs] = useState('');
  const [logsError, setLogsError] = useState('');
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [pollError, setPollError] = useState('');
  const [updated, setUpdated] = useState('');
  const [busy, setBusy] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const result = await request<{ nodes: ProcessNode[] }>('', 'GET', undefined,
          AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]));
        if (!active) return;
        setNodes(result.nodes);
        setPollError('');
        setUpdated(new Date().toLocaleTimeString());
        if (selected && !result.nodes.some((node) => node.id === selected)) setSelected('');
      } catch (cause) {
        if (active) setPollError(message(cause));
      } finally {
        if (active) timer = setTimeout(() => void poll(), 3000);
      }
    }
    void poll();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [selected, refresh]);

  useEffect(() => {
    setLogs(''); setLogsError(''); setLogsLoaded(false);
    if (!selected) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const result = await request<{ text: string }>(`/${selected}/logs`, 'GET', undefined,
          AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]));
        if (!active) return;
        setLogs(result.text); setLogsError(''); setLogsLoaded(true);
      } catch (cause) {
        if (active) setLogsError(message(cause));
      } finally {
        if (active) timer = setTimeout(() => void poll(), 3000);
      }
    }
    void poll();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [selected, refresh]);

  async function launch(event: FormEvent) {
    event.preventDefault(); setBusy('launch'); setError('');
    try {
      const body = role === 'miner'
        ? { project: project.trim(), netuid: Number(netuid), hotkey: hotkey.trim(), validators: validators.trim().split(/[\s,]+/), port: Number(port) }
        : { project: project.trim(), netuid: Number(netuid), dev_hotkey: devHotkey.trim() };
      const node = await request<ProcessNode>(`/${role}`, 'POST', body);
      setNodes((current) => [...current.filter((item) => item.id !== node.id), node]);
      setSelected(node.id); setRefresh((value) => value + 1);
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(''); }
  }

  async function control(node: ProcessNode, action: 'start' | 'stop' | 'delete') {
    setBusy(node.id); setError('');
    try {
      if (action === 'delete') {
        await request(`/${node.id}`, 'DELETE');
        setNodes((current) => current.filter((item) => item.id !== node.id));
        if (selected === node.id) setSelected('');
      } else {
        const result = await request<ProcessNode>(`/${node.id}/${action}`, 'POST', {});
        setNodes((current) => current.map((item) => item.id === result.id ? result : item));
      }
      setRefresh((value) => value + 1);
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(''); }
  }

  const detail = nodes.find((node) => node.id === selected);
  const inputClass = 'block w-full mt-1';
  return <main className="studio-home">
    <h1>Nodes</h1>
    <p>Run generated miners and development validators on your connected runner. Status and logs refresh every three seconds.</p>
    <p className="mt-2">Nodes stop when the runner closes. Registration, endpoint publication, rewards and health checks are not available here yet.</p>

    <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
      <h2>Local processes</h2>
      <button type="button" onClick={() => setRefresh((value) => value + 1)}>Refresh</button>
    </div>
    {pollError ? <p role="alert" className="mt-3">{pollError} {updated && `Last observed at ${updated}; displayed state may be stale.`}</p>
      : <p role="status" className="text-sm mt-3">{updated ? `Runner connected. Last observed at ${updated}.` : 'Connecting to the runner…'}</p>}
    {error && <p role="alert" className="mt-4">{error}</p>}
    {updated && nodes.length === 0 && <p className="my-6 text-sm">No local processes in this runner session. Launch a node below using an <Link className="underline" to="/subcreate">assembled subnet project</Link>.</p>}

    <div className="grid gap-4 mt-4">
      {nodes.map((node) => <article key={node.id}>
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div><h3>{node.name}</h3><p className="text-sm mt-1">{node.role === 'miner' ? 'Miner' : 'Validator'} · Subnet {node.netuid}</p></div>
          <span className="text-sm">{node.status === 'running' ? 'Process running' : node.status === 'failed' ? 'Process failed' : node.status === 'exited' ? 'Process exited' : 'Stopped'}</span>
        </div>
        <p className="break-all text-xs mt-3">Public hotkey: {node.hotkey}</p>
        {node.status === 'running' && <p className="text-sm mt-2">Uptime: {Math.floor(node.uptime_seconds)} seconds. {node.role === 'validator' ? 'Weights are previewed only.' : 'Inference and serving are not verified.'}</p>}
        {node.exit_code !== null && <p className="text-sm mt-2">Exit code: {node.exit_code}</p>}
        {node.error && <p role="alert" className="mt-3">{node.error}</p>}
        <div className="flex flex-wrap gap-2 mt-4">
          <button type="button" aria-pressed={selected === node.id} onClick={() => setSelected(node.id)}>View logs</button>
          <button type="button" disabled={!!busy} onClick={() => void control(node, node.status === 'running' ? 'stop' : 'start')}>{busy === node.id ? 'Working…' : node.status === 'running' ? 'Stop' : 'Start'}</button>
          {node.status !== 'running' && <button type="button" disabled={!!busy} onClick={() => void control(node, 'delete')}>Remove</button>}
        </div>
      </article>)}
    </div>

    {detail && <section className="border mt-6" aria-label="Selected node logs">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2>{detail.name}</h2><button type="button" onClick={() => setSelected('')}>Close logs</button></div>
      <p className="text-sm mt-3 break-all">Project: {detail.project}</p>
      <p className="text-sm mt-1">Started: {detail.started_at ? new Date(detail.started_at).toLocaleString() : 'Not started'}</p>
      {detail.host_url && <p className="text-sm mt-1 break-all">Local listener: {detail.host_url} (health not checked)</p>}
      {logsError && <p role="alert" className="mt-3">Log refresh failed: {logsError} Displayed logs may be stale.</p>}
      <pre tabIndex={0} className="mt-4 p-4 overflow-auto whitespace-pre-wrap break-words max-h-96" aria-label="Node output">{logs || (logsLoaded ? 'No log output received.' : 'Loading logs…')}</pre>
    </section>}

    <form onSubmit={(event) => void launch(event)} className="grid gap-4 mt-8" aria-label="Launch local node">
      <h2>Launch a node</h2>
      <p className="text-sm">Use an unmodified project generated by SubCreate. Up to eight nodes can be kept in this session.</p>
      <label>Role<select className={inputClass} value={role} onChange={(event) => setRole(event.target.value as 'miner' | 'validator')}><option value="miner">Miner</option><option value="validator">Development validator</option></select></label>
      <label>Assembled project folder<input required pattern="subcreate-[a-f0-9]{32}" className={inputClass} value={project} onChange={(event) => setProject(event.target.value)} placeholder="subcreate-…" autoCapitalize="none" spellCheck={false} /></label>
      <label>Subnet ID<input required type="number" min="1" max="65535" step="1" className={inputClass} value={netuid} onChange={(event) => setNetuid(event.target.value)} /></label>
      {role === 'miner' ? <>
        <label>Miner public hotkey<input required minLength={47} maxLength={48} className={inputClass} value={hotkey} onChange={(event) => setHotkey(event.target.value)} autoCapitalize="none" spellCheck={false} /></label>
        <label>Allowed validator public hotkeys (one per line)<textarea required rows={3} className={inputClass} value={validators} onChange={(event) => setValidators(event.target.value)} autoCapitalize="none" spellCheck={false} /></label>
        <label>Local port<input required type="number" min="1024" max="65535" step="1" className={inputClass} value={port} onChange={(event) => setPort(event.target.value)} /></label>
        <p className="text-sm">Choose a different port for each miner. Configure the model in the runner environment using BITCODE_MODEL_ID, BITCODE_MODEL_BASE_URL and BITCODE_MODEL_API_KEY. No keys are entered here.</p>
      </> : <>
        <label>Development hotkey name<input required pattern="bitcode-[a-z0-9-]{1,48}" className={inputClass} value={devHotkey} onChange={(event) => setDevHotkey(event.target.value)} autoCapitalize="none" spellCheck={false} /></label>
        <p className="text-sm break-words">Uses the public development identity //Alice//{devHotkey}. Use it only on a development chain. The runner must reach that chain, and registered miners must already be discoverable. Weights are previewed, never submitted. No personal wallet is loaded.</p>
      </>}
      <button type="submit" disabled={!!busy}>{busy === 'launch' ? 'Starting process…' : `Launch ${role}`}</button>
    </form>
    <p className="text-sm mt-4">Sessions are limited to 24 hours per run and stop if output exceeds 1 MiB. Removing a node deletes its local checkpoint. Automatic restart and recovery after runner shutdown are not available yet.</p>
  </main>;
}
