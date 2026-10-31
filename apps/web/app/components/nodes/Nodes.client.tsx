import { runnerFetch } from '~/lib/runner/client';
import { useEffect, useState } from 'react';
import { useSearchParams } from '@remix-run/react';

const RUNNER = 'http://127.0.0.1:8787';
type Node = {
  id: string; name: string; role: string; project: string; netuid: string; hotkey: string;
  status: string; health: string; started_at: string; exit_code: number | null;
  host_url: string | null; container_endpoint: string | null;
  cpu_percent: number | null; memory_bytes: number | null; metrics_error: string | null;
};
type ChainState = { registered: boolean; uid: number | null; served_endpoint: string | null; endpoint_matches: boolean; validator_permit: boolean | null; rank: number | null; incentive: number | null; dividends: number | null; observed_block: number };
type ServePlan = { token: string; endpoint: string; fee: string; effects: string[]; warnings: string[]; currently_served: string | null };
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await runnerFetch(RUNNER + path, body === undefined ? { signal: AbortSignal.timeout(15000) } : {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Bitcode-Client': 'studio' },
    body: JSON.stringify(body),
  });
  const data = await response.json() as T & { detail?: unknown };
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Runner rejected this request. Check the entered values.');
  return data;
}

export function Nodes() {
  const [params] = useSearchParams();
  const [project, setProject] = useState(params.get('project') || '');
  const [netuid, setNetuid] = useState('');
  const [hotkey, setHotkey] = useState('');
  const [role, setRole] = useState<'miner' | 'validator'>('miner');
  const [devHotkey, setDevHotkey] = useState('bitcode-validator');
  const [validators, setValidators] = useState('');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState<Node>();
  const [logs, setLogs] = useState('');
  const [chain, setChain] = useState<ChainState>();
  const [chainError, setChainError] = useState('');
  const [serveName, setServeName] = useState('bitcode-miner');
  const [servePlan, setServePlan] = useState<ServePlan>();
  const [serveResult, setServeResult] = useState('');
  const [error, setError] = useState('');
  const [pollError, setPollError] = useState('');
  const [updated, setUpdated] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await request<{ nodes: Node[] }>('/nodes');
        if (!active) return;
        setNodes(result.nodes);
        if (selected) {
          const [node, output] = await Promise.all([request<Node>(`/nodes/${selected}`), request<{ text: string }>(`/nodes/${selected}/logs`)]);
          if (!active) return;
          setDetail(node); setLogs(output.text);
          try {
            const observed = await request<ChainState>(`/nodes/${selected}/chain`);
            if (!active) return;
            setChain(observed); setChainError('');
          } catch (cause) {
            if (!active) return;
            setChain(undefined); setChainError(cause instanceof Error ? cause.message : 'Chain unavailable.');
          }
        }
        setPollError(''); setUpdated(new Date().toLocaleTimeString());
      } catch (cause) {
        if (active) setPollError(cause instanceof Error ? cause.message : 'Runner unavailable.');
      } finally {
        if (active) timer = setTimeout(() => void poll(), 3000);
      }
    }
    setDetail(undefined); setLogs(''); setChain(undefined); setChainError(''); setServePlan(undefined); setServeResult('');
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [selected]);

  async function launch(event: React.FormEvent) {
    event.preventDefault(); setBusy('launch'); setError('');
    try {
      const node = await request<Node>(`/nodes/${role}`, role === 'miner' ? {
        project, netuid: Number(netuid), hotkey, validators: validators.trim().split(/[\s,]+/),
      } : { project, netuid: Number(netuid), dev_hotkey: devHotkey });
      setSelected(node.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Launch failed.'); }
    finally { setBusy(''); }
  }
  async function control(node: Node, action: 'start' | 'stop') {
    setBusy(node.id); setError('');
    try {
      const result = await request<Node>(`/nodes/${node.id}/${action}`, {});
      setNodes((current) => current.map((item) => item.id === result.id ? result : item));
      if (selected === result.id) setDetail(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Node operation failed.'); }
    finally { setBusy(''); }
  }
  async function publishEndpoint(confirm: boolean) {
    setBusy(selected); setError(''); setServeResult('');
    try {
      if (confirm && servePlan) {
        const plan = servePlan;
        setServePlan(undefined);
        const result = await request<{ block_hash: string; message: string }>(`/nodes/${selected}/serve`, { token: plan.token });
        setServeResult(`${result.message} Block: ${result.block_hash}`);
      } else {
        setServePlan(undefined);
        const plan = await request<ServePlan>(`/nodes/${selected}/serve-preview`, { dev_hotkey: serveName });
        setServePlan(plan);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Endpoint publication failed.'); }
    finally { setBusy(''); }
  }
  const inputClass = 'block w-full p-2 border rounded bg-bitcode-elements-background-depth-2';
  return <main className="studio-home">
    <p className="studio-eyebrow">LOCAL DOCKER RUNTIME</p><h1>Nodes</h1>
    <p>Launch a generated miner or local development validator and inspect its actual Docker state. Status and logs refresh every three seconds. Container health confirms the HTTP process responds; it does not prove inference or chain registration.</p>
    <p className="mt-3">Validators require an already registered local development identity and preview weights only. For a running development miner, inspect the node to preview and publish its Docker endpoint to the local chain. Subnet and hotkey registration remain separate.</p>
    <form onSubmit={(event) => void launch(event)} className="grid gap-4 mt-6 p-4 border rounded">
      <h2>Launch node</h2>
      <label>Role<select className={inputClass} value={role} onChange={(event) => setRole(event.target.value as 'miner' | 'validator')}><option value="miner">Miner</option><option value="validator">Local development validator</option></select></label>
      <label>Assembled project folder<input required className={inputClass} value={project} onChange={(event) => setProject(event.target.value)} placeholder="subcreate-…" /></label>
      <label>Local subnet ID<input required type="number" min="1" max="65535" className={inputClass} value={netuid} onChange={(event) => setNetuid(event.target.value)} /></label>
      {role === 'miner' ? <><label>Miner public hotkey<input required className={inputClass} value={hotkey} onChange={(event) => setHotkey(event.target.value)} /></label>
      <label>Allowed validator public hotkeys (one per line)<textarea required className={inputClass} value={validators} onChange={(event) => setValidators(event.target.value)} /></label>
      <p>Set BITCODE_MODEL_ID and BITCODE_MODEL_API_KEY in your local runner environment. The optional BITCODE_MODEL_BASE_URL defaults to Chutes. Credentials stay local and are supplied to the miner at runtime. Docker administrators can inspect container environment variables.</p></> : <>
        <label>Development hotkey name<input required pattern="bitcode-[a-z0-9-]{1,48}" className={inputClass} value={devHotkey} onChange={(event) => setDevHotkey(event.target.value)} /></label>
        <p>This uses the public development derivation //Alice//{devHotkey}. It is for local testing only. The derived address must already be registered and allowed by your miners. No personal wallet keys are used. Checkpoints persist in a dedicated Docker volume; weights are previewed, never submitted by this launcher.</p>
      </>}
      <button disabled={!!busy} className="p-2 border rounded" type="submit">{busy === 'launch' ? 'Building image and starting node…' : `Build and launch ${role}`}</button>
      {busy === 'launch' && <p role="status">The first build downloads Python and dependencies and may take several minutes. Keep this page open.</p>}
    </form>
    {error && <p role="alert" className="mt-4">{error}</p>}
    {pollError ? <p role="alert" className="mt-4">Live refresh failed: {pollError} Previously displayed data may be stale.</p> : <p className="mt-4">{updated ? `Last updated ${updated}` : 'Connecting to Docker…'}</p>}
    {updated && !nodes.length && <p className="mt-4">No Bitcode node containers exist.</p>}
    <div className="grid gap-4 mt-4">
      {nodes.map((node) => <article key={node.id} className="p-4 border rounded">
        <h2>{node.name}</h2><p>{node.role} · subnet {node.netuid} · {node.status} · {node.role === 'validator' ? 'Weights: preview only' : `HTTP health: ${node.health}`} </p>
        <p className="break-all">{node.hotkey}</p>
        {node.exit_code !== null && <p>Process exited with code {node.exit_code}. Inspect logs for the cause.</p>}
        <div className="flex gap-3 mt-3"><button className="p-2 border rounded" onClick={() => setSelected(node.id)}>Inspect logs and metrics</button>
          <button className="p-2 border rounded" disabled={!!busy} onClick={() => void control(node, node.status === 'running' || node.status === 'restarting' ? 'stop' : 'start')}>{node.status === 'running' || node.status === 'restarting' ? 'Stop' : 'Start'}</button></div>
      </article>)}
    </div>
    {selected && <section className="mt-6 p-4 border rounded" aria-label="Selected node">
      <h2>{detail?.name || 'Loading node…'}</h2>
      {detail && <><p>Status: {detail.status} · CPU: {detail.cpu_percent === null ? 'unavailable' : `${detail.cpu_percent.toFixed(1)}%`} · RAM: {detail.memory_bytes === null ? 'unavailable' : `${(detail.memory_bytes / 1024 / 1024).toFixed(1)} MiB`}</p>
        {detail.metrics_error && <p>{detail.metrics_error}</p>}
        <p>Started: {detail.started_at}</p><p>Host endpoint: {detail.host_url || 'unavailable'}</p><p>Docker endpoint: {detail.container_endpoint || 'unavailable'}</p>
        {chainError && <p role="alert">Chain status unavailable: {chainError}</p>}
        {chain && <div className="mt-3"><p>Chain observed near block {chain.observed_block}: {chain.registered ? `registered · UID ${chain.uid}` : 'not registered on this subnet'}</p>
          {chain.registered && <><p>Validator permit: {chain.validator_permit ? 'yes' : 'no'} · Rank: {chain.rank} · Incentive: {chain.incentive} · Dividends: {chain.dividends}</p>
            <p>Served on chain: {chain.served_endpoint || 'no endpoint'}</p>
            {detail.role === 'miner' && <p>{chain.endpoint_matches ? 'Chain endpoint matches this container.' : 'Chain endpoint does not match this container.'} Inference is not verified by this check.</p>}</>}
        </div>}
        {detail.role === 'miner' && <div className="mt-4 p-3 border rounded">
          <h3>Publish development miner endpoint</h3>
          <label>Public development identity name<input className={inputClass} value={serveName} onChange={(event) => { setServeName(event.target.value); setServePlan(undefined); }} /></label>
          <p>Uses //Alice//{serveName}, which must match this miner. This publishes a real localnet endpoint; it does not register a hotkey or prove model inference.</p>
          <button disabled={!!busy} className="p-2 border rounded mt-2" onClick={() => void publishEndpoint(false)}>Preview endpoint publication</button>
          {servePlan && <div className="mt-3"><p>{servePlan.currently_served || 'No existing endpoint'} → {servePlan.endpoint}</p><p>Estimated fee: {servePlan.fee}. Preview expires in 60 seconds.</p>
            {servePlan.effects.map((effect, index) => <p key={index}>{effect}</p>)}{servePlan.warnings.map((warning, index) => <p key={index}>{warning}</p>)}
            <button disabled={!!busy} className="p-2 border rounded mt-2" onClick={() => void publishEndpoint(true)}>Confirm localnet publication</button></div>}
          {serveResult && <p role="status" className="break-all mt-3">{serveResult}</p>}
        </div>}</>}
      <pre className="mt-3 overflow-auto whitespace-pre-wrap max-h-96" aria-label="Node logs">{logs || 'No log output received.'}</pre>
    </section>}
  </main>;
}
