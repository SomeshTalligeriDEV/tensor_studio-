import { useEffect, useState } from 'react';
import type { ApiPromise } from '@polkadot/api';
import { parseExplorerSearch, taoFromRao, type ChainBlock, type ChainTransaction } from '~/lib/chain/explorer';
import { indexedBlock, loadBlockDetail } from '~/lib/chain/block-detail';
import type { ExplorerIndex } from '~/lib/chain/explorer-index';
import { ScanLink, short } from './ScanLink';
import { transactionLabel } from '~/lib/chain/transaction-label';
import { AccountPanel } from './AccountPanel';
import { SubnetPanel } from './SubnetPanel';

export function CopyValue({ value }: { value: string }) {
  const [status, setStatus] = useState('Copy');
  return <button className="scan-copy" onClick={() => { void navigator.clipboard.writeText(value).then(() => setStatus('Copied')).catch(() => setStatus('Copy unavailable')); }} aria-label={`Copy ${value}`}>{status}</button>;
}
export function TransactionTable({ block }: { block: ChainBlock }) {
  return <TransactionsTable entries={block.transactions.map(tx => ({ block, tx }))} />;
}
export function TransactionsTable({ entries }: { entries: { block: ChainBlock; tx: ChainTransaction }[] }) {
  return <div className="scan-table-wrap"><table><thead><tr><th>Transaction</th><th>Method</th><th>Block</th><th>Result</th><th>From</th><th>Fee (TAO)</th></tr></thead><tbody>{entries.map(({block, tx}) => <tr key={`${block.hash}-${tx.index}`}>
    <td><ScanLink kind="extrinsic" value={`${block.number}-${tx.index}`}>{short(tx.hash)}</ScanLink></td><td><span className="scan-method">{transactionLabel(tx)}</span></td><td><ScanLink kind="block" value={String(block.number)}>{block.number.toLocaleString('en-US')}</ScanLink></td>
    <td><span className={`scan-result scan-result--${tx.result.toLowerCase()}`}>{tx.result}</span></td><td>{tx.signer ? <ScanLink kind="account" value={tx.signer}>{short(tx.signer)}</ScanLink> : 'System'}</td><td>{tx.feeRao ? taoFromRao(tx.feeRao) : '—'}</td>
  </tr>)}</tbody></table>{!entries.length && <p className="scan-empty">No extrinsics in this view.</p>}</div>;
}
export function ScanDetails({ query, kind, api, finalized, index, revision, blockHash, best }: { query: string; kind: string; api: ApiPromise | null; finalized: number | null; index: ExplorerIndex | null; revision: number; blockHash: string; best: number | null }) {
  const [block, setBlock] = useState<ChainBlock | null>(null);
  const [txIndex, setTxIndex] = useState<number>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, retry] = useState(0);
  const cachedHash = indexedBlock(index, query)?.hash;
  // A hash may enter the index during progressive backfill.
  const found = (kind === 'extrinsic' || kind === 'search') && /^0x/.test(query) ? index?.findTransaction(query) : undefined;
  const foundAt = found?.block.hash;
  useEffect(() => {
    let active = true;
    setBlock(null); setTxIndex(undefined); setError('');
    if (!api && !cachedHash) { setBusy(false); return; }
    setBusy(true);
    void (async () => {
      try {
        const search = parseExplorerSearch(kind === 'subnet' ? `subnet:${query}` : query);
        if (search.kind === 'subnet') {
          return; // SubnetPanel owns the coalesced, block-pinned runtime read.
        } else if (search.kind === 'address') {
          return; // AccountPanel owns the block-pinned account read.
        } else {
          const indexed = kind !== 'block' && search.kind === 'hash' ? index?.findTransaction(search.value) : undefined;
          if (indexed) { if (active) { setBlock(indexed.block); setTxIndex(indexed.transaction.index); } return; }
          if (kind === 'extrinsic' && search.kind === 'hash') throw new Error('Transaction is not in the indexed window yet. Wait for backfill, or search its block-index (for example 123-2). RPC cannot locate arbitrary historical extrinsics by hash.');
          const data = await loadBlockDetail(api, index, query);
          if (search.index !== undefined && !data.transactions[search.index]) throw new Error('No extrinsic exists at that block index.');
          if (active) { setBlock(data); setTxIndex(search.index); }
        }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Unable to read chain state.'); }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, [query, kind, api, attempt, foundAt, cachedHash]);
  const tx = txIndex !== undefined ? block?.transactions[txIndex] : undefined;
  void revision;
  return <section className="scan-detail">
    <div className="scan-page-heading"><div><ScanLink kind="home">TensorScan</ScanLink><span className="scan-muted"> / {kind === 'extrinsic' ? 'Transaction' : kind}</span><h2>{kind === 'account' ? 'Account details' : kind === 'subnet' ? 'Subnet details' : tx ? 'Transaction details' : kind === 'block' ? 'Block details' : 'Search result'}</h2>{block && !tx && <p className="scan-block-title">#{block.number.toLocaleString('en-US')}</p>}</div><CopyValue value={query} /></div>
    {!api && <p className="scan-notice">{block ? 'Showing a previously decoded block. Reconnect to confirm the current chain state.' : 'Connect to the selected network to read this page.'}</p>}
    {busy && <p className="scan-empty" role="status">Reading verified chain state…</p>}
    {error && <p className="scan-notice" role="alert">{error} <button onClick={()=>retry(value=>value+1)}>Retry block details</button></p>}
    {kind === 'account' && <AccountPanel address={query} />}
    {kind === 'subnet' && <SubnetPanel netuid={Number(query)} />}
    {block && <>{!tx && <nav className="scan-detail-tabs" aria-label="Block sections"><a href="#block-overview">Overview</a><a href="#block-extrinsics">Extrinsics ({block.transactions.length})</a><a href="#block-events">Events ({block.events.length})</a></nav>}<div id="block-overview" className="scan-panel scan-detail-body"><dl className="scan-definition">
      <dt>{tx ? 'Transaction hash' : 'Block height'}</dt><dd>{tx ? <code className="scan-full-hash">{tx.hash}</code> : <><strong>#{block.number.toLocaleString('en-US')}</strong><span className="scan-block-controls">{block.number > 0 && <ScanLink kind="block" value={String(block.number - 1)}>Previous</ScanLink>}{best!==null && block.number<best?<ScanLink kind="block" value={String(block.number + 1)}>Next</ScanLink>:<span className="scan-muted">Latest block</span>}</span></>}</dd>
      <dt>Status</dt><dd>{tx ? <span className={`scan-result scan-result--${tx.result.toLowerCase()}`}>{tx.result}</span> : finalized !== null && block.number <= finalized ? 'At or below finalized height' : 'Finality not confirmed'}</dd>
      <dt>Timestamp</dt><dd>{block.timestamp ? new Date(block.timestamp).toLocaleString('en-US') : 'Unavailable'}</dd>
      {!tx && <><dt>Timestamp (UTC)</dt><dd>{block.timestamp ? new Date(block.timestamp).toISOString().replace('T',' ').replace('Z',' UTC') : 'Unavailable'}</dd><dt>Signed transactions</dt><dd>{block.transactions.filter(item=>item.signer).length}</dd><dt>Unsigned system calls</dt><dd>{block.transactions.filter(item=>!item.signer).length}</dd><dt>Encoded block size</dt><dd>{block.byteLength == null ? 'Unavailable in this observation' : `${block.byteLength.toLocaleString('en-US')} bytes`}</dd><dt>Recorded transaction fees</dt><dd>{block.transactions.some(item=>item.feeRao!==undefined) ? `${taoFromRao(block.transactions.reduce((sum,item)=>sum+BigInt(item.feeRao||'0'),0n).toString())} TAO` : 'No fee events recorded'}</dd></>}
      <dt>Block hash</dt><dd><ScanLink kind="block" value={block.hash}><code className="scan-full-hash">{block.hash}</code></ScanLink></dd>
      {tx ? <><dt>Block / index</dt><dd><ScanLink kind="block" value={String(block.number)}>{block.number.toLocaleString('en-US')}</ScanLink> / {tx.index}</dd><dt>From</dt><dd>{tx.signer ? <ScanLink kind="account" value={tx.signer}><code className="scan-full-hash">{tx.signer}</code></ScanLink> : 'Unsigned system call'}</dd><dt>Method</dt><dd><span className="scan-method">{tx.call}</span></dd><dt>What happened</dt><dd>{transactionLabel(tx)}</dd><dt>Transaction fee</dt><dd>{tx.feeRao ? `${taoFromRao(tx.feeRao)} TAO` : 'No fee event recorded'}</dd>{tx.failure && <><dt>Failure</dt><dd className="scan-failure">{tx.failure}{tx.failureHint && <p>{tx.failureHint}</p>}</dd></>}</> : <><dt>Parent hash</dt><dd><ScanLink kind="block" value={block.parent}><code className="scan-full-hash">{block.parent}</code></ScanLink></dd><dt>Extrinsics / events</dt><dd>{block.transactions.length} extrinsics · {block.events.length} events</dd></>}
      {!tx && <><dt>State root</dt><dd><code className="scan-full-hash">{block.stateRoot || 'Unavailable in this observation'}</code></dd><dt>Extrinsics root</dt><dd><code className="scan-full-hash">{block.extrinsicsRoot || 'Unavailable in this observation'}</code></dd></>}
    </dl></div><div id="block-extrinsics" className="scan-panel"><header><h3>{tx ? 'Decoded call & events' : 'Block extrinsics'}</h3><span>{!tx && 'Signed transactions and unsigned system calls'}</span></header>{tx ? <div className="scan-detail-body"><h4>Arguments</h4><pre>{JSON.stringify(tx.args, null, 2)}</pre><h4>Events ({tx.events.length})</h4><pre>{JSON.stringify(tx.events, null, 2)}</pre></div> : <TransactionTable block={block} />}</div>{!tx && <section id="block-events" className="scan-panel"><header><h3>Chain events</h3><span>{block.events.length} recorded in this block</span></header><div className="scan-detail-body">{block.events.length ? block.events.map((event,i)=><details className="scan-event" key={i}><summary><span>#{i} · {event.name}</span><small>{event.phase}</small></summary><pre>{JSON.stringify(event.data,null,2)}</pre></details>) : <p>No events recorded.</p>}</div></section>}</>}
  </section>;
}
