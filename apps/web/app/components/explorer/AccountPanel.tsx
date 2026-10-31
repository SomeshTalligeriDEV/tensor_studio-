import { useChain } from '~/components/studio/ChainProvider';
import { useBlockQuery } from '~/lib/chain/useBlockQuery';
import { readAccountDetails } from '~/lib/chain/account-details';
import { taoFromRao } from '~/lib/chain/explorer';
import { ScanLink, short } from './ScanLink';
export function AccountPanel({address}:{address:string}){
 const {state}=useChain();
 const {data,error,busy}=useBlockQuery(`account:${address}`,(api,hash)=>readAccountDetails(api,address,hash));
 const recent=state.index?.accountTransactions(address,200)||[];
 return <>
  {error&&<p role="alert" className="scan-notice">{error}</p>}
  {!data&&!error&&<p className="scan-empty" role="status">{state.api?'Reading account at the observed block…':'Connect to the selected network to read this account.'}</p>}
  {data&&<>
   <div className="scan-panel scan-detail-body"><code className="scan-full-hash">{data.address}</code><div className="scan-account-stats"><div><span>Free balance</span><strong>{taoFromRao(data.free)} τ</strong></div><div><span>Reserved balance</span><strong>{taoFromRao(data.reserved)} τ</strong></div><div><span>Frozen balance</span><strong>{taoFromRao(data.frozen)} τ</strong></div></div><p className="scan-muted">Nonce {data.nonce} · Snapshot <ScanLink kind="block" value={String(data.blockNumber)}>#{data.blockNumber}</ScanLink>{busy?' · Refreshing':''}. Free balance excludes subnet stakes; frozen balance overlaps free balance.</p></div>
   <section className="scan-panel scan-detail-body"><h3>Hotkey subnet registrations</h3>{data.membershipError?<p role="alert">{data.membershipError}</p>:data.subnets.length?<div className="scan-memberships">{data.subnets.map(netuid=><ScanLink key={netuid} kind="subnet" value={String(netuid)}>Subnet {netuid}</ScanLink>)}</div>:<p>No hotkey registrations at this snapshot. A coldkey can own separately registered hotkeys.</p>}</section>
   <section className="scan-panel"><header><h3>Coldkey stake positions</h3><span>Block-pinned runtime data</span></header>{data.stakesError?<p className="scan-notice" role="alert">{data.stakesError}</p>:data.stakes.length?<div className="scan-table-wrap"><table><thead><tr><th>Subnet</th><th>Hotkey</th><th>Stake</th><th>Unit</th></tr></thead><tbody>{data.stakes.map((stake,i)=><tr key={`${stake.netuid}-${stake.hotkey}-${i}`}><td><ScanLink kind="subnet" value={String(stake.netuid)}>{stake.netuid}</ScanLink></td><td><ScanLink kind="account" value={stake.hotkey}>{short(stake.hotkey)}</ScanLink></td><td>{taoFromRao(stake.alpha)}</td><td>{stake.unit}</td></tr>)}</tbody></table></div>:<p className="scan-empty">No coldkey stakes at this snapshot.</p>}</section>
  </>}
  <section className="scan-panel"><header><h3>Recent account activity</h3><span>Observed 200-block window only</span></header>{recent.length?<div className="scan-table-wrap"><table><thead><tr><th>Transaction</th><th>What happened</th><th>Block</th><th>Result</th></tr></thead><tbody>{recent.map(({block,transaction:tx})=><tr key={`${block.hash}-${tx.index}`}><td><ScanLink kind="extrinsic" value={`${block.number}-${tx.index}`}>{short(tx.hash)}</ScanLink></td><td>{tx.summary||tx.call}</td><td><ScanLink kind="block" value={String(block.number)}>{block.number}</ScanLink></td><td>{tx.result}</td></tr>)}</tbody></table></div>:<p className="scan-empty">No matching transactions in the loaded window. This does not mean the account has never transacted.</p>}</section>
 </>;
}
