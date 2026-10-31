import type {LiveState} from '~/lib/chain/session-runtime';
import {transactionFeedFacts} from '~/lib/chain/transaction-feed';
import {ScanLink,short,ago} from './ScanLink';

export function TransactionEvidence({state,now}:{state:LiveState;now:number}){
 const facts=transactionFeedFacts(state,now);
 return <div className="scan-tx-evidence" aria-label="Transaction feed source">
  <div className="scan-tx-source"><span className={`scan-dot ${facts.sourceStatus==='Live WebSocket'?'scan-dot--online':''}`} /><strong>{facts.sourceStatus}</strong><span>{state.network==='local'?'Local Subtensor chain':state.network==='test'?'Bittensor testnet':'Finney mainnet'}</span></div>
  {!facts.hasObservations ? <p>No blocks have been decoded yet. Transaction counts are unavailable until this connection returns real block data.</p> : <>
   {facts.signed===0 && <div className="scan-tx-empty"><h3>No signed transactions in these blocks</h3><p>{state.network==='local'?'Your localnet produces real blocks even when nobody submits a transaction.':'None of the observed blocks contains a signed transaction.'} Unsigned calls and chain events are counted separately below. Zero signed calls does not mean the chain is offline.</p></div>}
   <dl className="scan-tx-counts"><div><dt>Observed blocks</dt><dd>{facts.blocks.toLocaleString('en-US')}</dd></div><div><dt>Unsigned calls</dt><dd>{facts.unsigned.toLocaleString('en-US')}</dd></div><div><dt>Chain events</dt><dd>{facts.events.toLocaleString('en-US')}</dd></div></dl>
   {facts.newest && <div className="scan-tx-observation"><span>Latest decoded block</span><ScanLink kind="block" value={String(facts.newest.number)}>#{facts.newest.number.toLocaleString('en-US')} <code title={facts.newest.hash}>{short(facts.newest.hash)}</code></ScanLink><small>{state.updated?`Decoded ${ago(state.updated,now)}`:'Cached block'}</small></div>}
  </>}
  <details><summary>Inspect data source</summary><p>Fetched directly from this WebSocket RPC. TensorScan reads block extrinsics and events; it does not insert demonstration transactions. Counts cover the recent observed window, not lifetime activity.</p><dl className="scan-tx-origin"><dt>RPC endpoint</dt><dd><code>{state.endpoint||'Not connected yet'}</code></dd><dt>Genesis hash</dt><dd><code>{state.genesis||'Identity not available yet'}</code></dd></dl><p>This is an RPC-backed explorer, not an independent consensus verifier. Cached data keeps its source identity when disconnected.</p></details>
 </div>;
}
