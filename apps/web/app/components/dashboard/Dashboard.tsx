import { useEffect, useState } from 'react';
import { Link, useParams } from '@remix-run/react';
import { useChain } from '~/components/studio/ChainProvider';
import { readSubnet } from '~/lib/chain/explorer-subnet';
import { taoFromRao } from '~/lib/chain/explorer';
import { useBlockQuery } from '~/lib/chain/useBlockQuery';
import { ScanLink, short } from '~/components/explorer/ScanLink';
import { runnerFetch } from '~/lib/runner/client';
import '~/components/explorer/explorer.css';

type Process = {hotkey:string;netuid:number|string;role:string;status:string};
export function Dashboard(){
  const {state,select,reconnect}=useChain();
  const {netuid:route}=useParams();
  const netuid=Number(route);
  const valid=/^\d{1,5}$/.test(route||'') && netuid<=65535;
  const result=useBlockQuery(`subnet:${route}`,async(api,hash)=>{if(!valid)throw new Error('Enter a netuid from 0 to 65535.');return readSubnet(api,netuid,hash);});
  const data=result.data;
  const [samples,setSamples]=useState<{block:number;emission:string}[]>([]);
  const [processes,setProcesses]=useState<Process[]|null>(null);
  const [page,setPage]=useState(1);
  useEffect(()=>{setSamples([]);setPage(1);setProcesses(null);},[state.generation,netuid]);
  useEffect(()=>{if(data?.emissionRao)setSamples(old=>[...old.filter(x=>x.block!==data.blockNumber),{block:data.blockNumber,emission:data.emissionRao!}].sort((a,b)=>a.block-b.block).slice(-100));},[data]);
  useEffect(()=>{
    if(state.network!=='local')return;
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{
      try {const response=await runnerFetch('/process-nodes',{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(5000)])});if(!response.ok)throw new Error();const body=await response.json() as {nodes:Process[]};if(!controller.signal.aborted)setProcesses(body.nodes);}
      catch {if(!controller.signal.aborted)setProcesses(null);}
      if(!controller.signal.aborted)timer=setTimeout(()=>void poll(),3000);
    };void poll();return()=>{controller.abort();clearTimeout(timer);};
  },[state.generation,state.network]);
  const permits=data?.neurons.filter(n=>n.validatorPermit===true).length;
  const lastUpdate=data?.neurons.reduce((max,n)=>Math.max(max,n.lastUpdate??0),0);
  const scalar=(value:string|null|undefined)=>value==null?'Unavailable':taoFromRao(value);
  return <main className="scan">
    <div className="scan-nav"><Link className="scan-logo" to={`/scan?network=${state.network}`}><span className="scan-logo-icon">τ</span>TensorScan</Link><label>Network <select aria-label="Dashboard network" value={state.network} onChange={e=>select(e.target.value as 'test'|'local'|'finney')}><option value="local">Localnet</option><option value="test">Testnet</option><option value="finney">Finney</option></select></label></div>
    <section className="scan-search-area"><h1>{valid?`Subnet ${netuid}`:'Subnet dashboard'}</h1><p>Observed network state, one block at a time.</p><div className="scan-live-status"><span className={`scan-dot ${state.status==='Connected'?'scan-dot--online':''}`}/>{state.status} · {state.chain||'Verifying network'} · {state.best===null?'Waiting for a block':`Head #${state.best.toLocaleString()}`}<button onClick={reconnect}>Reconnect</button></div></section>
    <div className="scan-content">
      {(result.error||state.error)&&<p role="alert" className="scan-notice">{result.error||state.error}</p>}
      {!data && !result.error && <p className="scan-empty" role="status">{state.api?'Reading subnet at the observed block…':'Waiting for the selected Subtensor connection…'}</p>}
      {data&&<>
        <div className="scan-index-status"><span>Snapshot <ScanLink kind="block" value={String(data.blockNumber)}>#{data.blockNumber.toLocaleString()}</ScanLink>{state.finalized!==null&&data.blockNumber<=state.finalized?' · Finalized':' · Provisional'}</span><span>{result.busy?'Refreshing; showing the last completed snapshot':data.blockNumber===state.best?'At observed head':`Behind head by ${Math.max(0,(state.best??data.blockNumber)-data.blockNumber)} blocks`}</span><ScanLink kind="subnet" value={String(netuid)}>Open subnet in explorer</ScanLink></div>
        <section className="scan-metrics" aria-label="Subnet metrics">
          <div><div><span>Registered neurons</span><strong>{data.neuronCount}</strong><small>{permits} with validator permits</small></div></div>
          <div><div><span>Subnet emission</span><strong>{scalar(data.emissionRao)}</strong><small>TAO per block · snapshot rate</small></div></div>
          <div><div><span>Alpha spot price</span><strong>{data.alphaPrice??'Unavailable'}</strong><small>TAO per alpha · runtime spot price</small></div></div>
          <div><div><span>Latest weight update</span><strong>{lastUpdate?data.blockNumber-lastUpdate:'Unavailable'}</strong><small>{lastUpdate?'blocks ago':'No recorded update'}</small></div></div>
        </section>
        <section className="scan-panel scan-detail-body"><h2>{data.name||`Subnet ${netuid}`} ownership</h2><p>Owner: {data.owner?<ScanLink kind="account" value={data.owner}>{short(data.owner)}</ScanLink>:'Unavailable'}</p><p className="scan-muted">Owner earnings: {data.ownerEarningsUnavailable}</p><p>Tempo: {data.tempo??'Unavailable'} blocks · Last epoch: {data.lastStep==null?'Unavailable':<ScanLink kind="block" value={String(data.lastStep)}>{data.lastStep}</ScanLink>}</p></section>
        <section className="scan-panel"><header><h2>Miners and validators</h2><span>{data.neuronCount} registered</span></header><div className="scan-table-wrap"><table><thead><tr><th>UID</th><th>Hotkey</th><th>Permit</th><th>Alpha stake</th><th>Incentive</th><th>Alpha emission</th><th>Last update</th><th>Local process</th></tr></thead><tbody>{data.neurons.slice((page-1)*25,page*25).map(n=>{
          const process=processes?.find(p=>p.hotkey===n.hotkey&&Number(p.netuid)===netuid);
          return <tr key={n.uid}><td><ScanLink kind="subnet" value={String(netuid)}>{n.uid}</ScanLink></td><td>{n.hotkey?<ScanLink kind="account" value={n.hotkey}>{short(n.hotkey)}</ScanLink>:'Unavailable'}</td><td>{n.validatorPermit===null?'Unavailable':n.validatorPermit?'Validator':'No validator permit'}</td><td>{scalar(n.stake)}</td><td>{n.incentive===null?'Unavailable':`${(Number(n.incentive)/65535*100).toFixed(2)}%`}</td><td>{scalar(n.emission)}</td><td>{n.lastUpdate===null?'Unavailable':<ScanLink kind="block" value={String(n.lastUpdate)}>{n.lastUpdate}</ScanLink>}</td><td>{state.network!=='local'?'Not local':process?<Link to="/nodes?network=local">{process.status}</Link>:processes?'Not managed here':'Runner unavailable'}</td></tr>;
        })}</tbody></table></div><footer className="scan-pagination"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil(data.neuronCount/25))}</span><button disabled={page*25>=data.neuronCount} onClick={()=>setPage(p=>p+1)}>Next</button></footer><p className="scan-empty">Alpha stake/emission are subnet alpha, not TAO. Incentive is normalized from the runtime u16 score. A validator permit does not identify every process role.</p></section>
        <section className="scan-panel"><header><h2>Observed emission history</h2><span>{samples.length} of up to 100 observed snapshots</span></header><p className="scan-empty">Only completed observations are recorded. Missing blocks are gaps; this is an emission rate, not cumulative rewards.</p><EmissionChart samples={samples}/><div className="scan-table-wrap"><table><thead><tr><th>Block</th><th>TAO emission rate</th></tr></thead><tbody>{samples.slice().reverse().slice(0,10).map(sample=><tr key={sample.block}><td><ScanLink kind="block" value={String(sample.block)}>{sample.block}</ScanLink></td><td>{taoFromRao(sample.emission)}</td></tr>)}</tbody></table></div></section>
      </>}
    </div>
  </main>;
}

function EmissionChart({samples}:{samples:{block:number;emission:string}[]}){
 if(samples.length<2)return <p className="scan-empty">Waiting for a second observed snapshot to draw the chart.</p>;
 const values=samples.map(x=>BigInt(x.emission));
 const low=values.reduce((a,b)=>a<b?a:b),high=values.reduce((a,b)=>a>b?a:b);
 const range=high-low,first=samples[0].block,last=samples[samples.length-1].block;
 const segments:string[][]=[[]];
 samples.forEach((sample,i)=>{
  if(i && sample.block!==samples[i-1].block+1)segments.push([]);
  const x=12+(sample.block-first)/Math.max(1,last-first)*776;
  const y=range===0n?50:88-Number((BigInt(sample.emission)-low)*76000n/range)/1000;
  segments[segments.length-1].push(`${x},${y}`);
 });
 return <figure className="scan-emission-chart"><svg viewBox="0 0 800 100" role="img" aria-label={`Observed subnet emission rate from block ${first} to ${last}; gaps are not interpolated`}>
 {segments.map((points,i)=>points.length>1?<polyline key={i} points={points.join(' ')} fill="none" stroke="currentColor" strokeWidth="2"/>:<circle key={i} cx={points[0].split(',')[0]} cy={points[0].split(',')[1]} r="2" fill="currentColor"/>)}</svg><figcaption>{taoFromRao(low.toString())}–{taoFromRao(high.toString())} TAO per block · gaps preserved</figcaption></figure>;
}
