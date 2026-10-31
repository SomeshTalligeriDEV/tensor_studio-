import { Link } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { useChain } from '~/components/studio/ChainProvider';
import { useBlockQuery } from '~/lib/chain/useBlockQuery';
import { readSubnet } from '~/lib/chain/explorer-subnet';
import { taoFromRao } from '~/lib/chain/explorer';
import { ScanLink, short } from './ScanLink';
export function SubnetPanel({netuid}:{netuid:number}){
 const {state}=useChain();
 const {data,error,busy}=useBlockQuery(`subnet:${netuid}`,(api,hash)=>readSubnet(api,netuid,hash));
 const [page,setPage]=useState(1);useEffect(()=>setPage(1),[netuid,state.generation]);
 return <>
  {error&&<p role="alert" className="scan-notice">{error}</p>}
  {!data&&!error&&<p role="status" className="scan-empty">{state.api?'Reading subnet snapshot…':'Connect to the selected network to read this subnet.'}</p>}
  {data&&<>
   <div className="scan-panel scan-detail-body"><h2>Subnet {netuid}{data.name?` · ${data.name}`:''}</h2><dl className="scan-definition"><dt>Owner</dt><dd>{data.owner?<ScanLink kind="account" value={data.owner}>{short(data.owner)}</ScanLink>:'Unavailable'}</dd><dt>Neurons</dt><dd>{data.neuronCount}</dd><dt>Observed snapshot</dt><dd><ScanLink kind="block" value={String(data.blockNumber)}>#{data.blockNumber.toLocaleString()}</ScanLink> · {state.finalized!==null&&data.blockNumber<=state.finalized?'Finalized':'Provisional'}{busy?' · Refreshing':''}</dd></dl><ScanLink kind="block" value={String(data.blockNumber)}>Inspect the on-chain snapshot</ScanLink></div>
   <div className="scan-panel"><header><h3>Subnet neurons</h3><span>{data.neuronCount} registered · {data.source}</span></header><div className="scan-table-wrap"><table><thead><tr><th>UID</th><th>Hotkey</th><th>Alpha stake</th><th>Incentive</th><th>Alpha emission</th><th>Last update</th><th>Validator permit</th></tr></thead><tbody>{data.neurons.slice((page-1)*25,page*25).map(n=><tr key={n.uid}><td>{n.uid}</td><td>{n.hotkey?<ScanLink kind="account" value={n.hotkey}>{short(n.hotkey)}</ScanLink>:'Unavailable'}</td><td>{n.stake===null?'Unavailable':taoFromRao(n.stake)}</td><td>{n.incentive===null?'Unavailable':`${(Number(n.incentive)/65535*100).toFixed(2)}%`}</td><td>{n.emission===null?'Unavailable':taoFromRao(n.emission)}</td><td>{n.lastUpdate===null?'Unavailable':<ScanLink kind="block" value={String(n.lastUpdate)}>{n.lastUpdate}</ScanLink>}</td><td>{n.validatorPermit===null?'Unavailable':n.validatorPermit?'Yes':'No'}</td></tr>)}</tbody></table></div><footer className="scan-pagination"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil(data.neuronCount/25))}</span><button disabled={page*25>=data.neuronCount} onClick={()=>setPage(p=>p+1)}>Next</button></footer><p className="scan-empty">Stake and emission use subnet alpha units, not TAO. Incentive is normalized from the runtime u16 score. Last update is the recorded weights-update block.</p></div>
  </>}
 </>;
}
