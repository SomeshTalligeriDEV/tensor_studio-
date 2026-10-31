import { Link } from '@remix-run/react';
import { useEffect, useState } from 'react';

import { useChain } from './ChainProvider';

export function LiveNetwork() {
  const {state,select,reconnect} = useChain();
  const {network,best:head,finalized,updated}=state;
  const status=state.status === 'Connected' ? 'Live' : state.status;
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const age = updated ? Math.max(0, Math.floor((now - updated) / 1000)) : null;
  const live = status === 'Live' && age !== null && age < 45;
  const label = status === 'Live' && !live ? 'Waiting for a new block' : status;
  return <section className="studio-network-panel" aria-label="Live Bittensor network">
    <div className="studio-network-intro">
      <span className="studio-network-mark" aria-hidden="true">τ</span>
      <div><h2>Bittensor, in motion.</h2><p>Direct from the Subtensor network.</p></div>
    </div>
    <div className="studio-network-controls">
      <label><span className="sr-only">Live network</span><select aria-label="Live network" value={network} onChange={event => select(event.target.value as 'finney' | 'test' | 'local')}><option value="local">Localnet</option><option value="finney">Finney mainnet</option><option value="test">Bittensor testnet</option></select></label>
      <span className="studio-network-status" role="status"><i data-live={live} />{label}</span>
    </div>
    <div className="studio-network-values">
      <div><span>Latest block</span>{head === null ? <strong>—</strong> : <Link data-testid="live-head" to={`/scan/block/${head}?network=${network}`}>{head.toLocaleString()}</Link>}</div>
      <div><span>Finalized block</span>{finalized === null ? <strong>—</strong> : <Link to={`/scan/block/${finalized}?network=${network}`}>{finalized.toLocaleString()}</Link>}</div>
      <div className="studio-network-action"><Link to={`/scan?network=${network}`}>Explore BScan <span aria-hidden="true">↗</span></Link><small>{age === null ? 'Waiting for chain data' : `Last observed ${age}s ago`}</small></div>
    </div>
    <div className="studio-network-note"><span>{live ? 'Observing the public chain · Mainnet writes disabled' : head ? 'Last observed values · reconnect to refresh' : 'Connecting to chain RPC · no wallet required'}</span>{!live && <button onClick={() => reconnect()}>Reconnect</button>}</div>
  </section>;
}
