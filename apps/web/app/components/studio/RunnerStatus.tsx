import { useChain } from './ChainProvider';
import { runnerFetch } from '~/lib/runner/client';
import { useEffect, useState } from 'react';
type ChainStatus = { ready: boolean; block: number | null };
export function RunnerStatus() {
  const {state,select}=useChain();
  const [status, setStatus] = useState<ChainStatus | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await runnerFetch('http://127.0.0.1:8787/chain/status', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(4000)]) });
        if (!response.ok) throw new Error('Runner unavailable');
        const data = await response.json() as ChainStatus;
        if (!controller.signal.aborted) setStatus(data);
      } catch { if (!controller.signal.aborted) setStatus(null); }
      if (!controller.signal.aborted) timer = setTimeout(poll, 2000);
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);
  return <>
    <span title="Start with: cd apps/runner && uv run runner">Runner: {status ? 'online' : 'not connected'}</span>
    <label>Network <select aria-label="Workspace network" value={state.network} onChange={e=>select(e.target.value as 'local'|'test'|'finney')}><option value="local">Localnet</option><option value="test">Testnet</option><option value="finney">Finney</option></select></label>
    <span data-testid="chain-status">{state.status} · {state.best === null ? 'No block received' : `Block ${state.best.toLocaleString()}`}</span>
    <span>Read-only status</span>
  </>;
}
