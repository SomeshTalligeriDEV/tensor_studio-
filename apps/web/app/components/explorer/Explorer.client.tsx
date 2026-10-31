import { RuneIcon } from './RuneIcon';
import { LocalnetConnection, NetworkTools } from './NetworkTools';
import { DiscoverButton } from './DiscoverButton';
import { useChain } from '~/components/studio/ChainProvider';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from '@remix-run/react';
import { explorerNetworks, parseExplorerSearch, type ExplorerNetwork } from '~/lib/chain/explorer';
import { useExplorer } from './useExplorer';
import { ScanDetails, TransactionsTable } from './ScanDetails';
import { ScanLink, scanPath, short, ago } from './ScanLink';
import './explorer.css';
import './professional.css';
import { ActivityCharts } from './ActivityCharts';
import { TaoMarket } from './TaoMarket';
import { toggleTheme } from '~/lib/stores/theme';
import { TransactionEvidence } from './TransactionEvidence';
import { ChainProof } from './ChainProof';
import { transactionLabel } from '~/lib/chain/transaction-label';
import { feedHealth } from '~/lib/chain/activity';

export function Explorer() {
  const [params, setParams] = useSearchParams();
  const route = useParams()['*']?.split('/') || [];
  const {state: shared, localEndpoint, publicOnly, select, reconnect} = useChain();
  const network = shared.network;
  const [input, setInput] = useState('');
  const [searchError, setSearchError] = useState('');
  const [now, setNow] = useState(Date.now());
  const navigate = useNavigate();
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const endpoint = shared.endpoint;
  const state = useExplorer();
  const { blocks, best, finalized, status, progress, index } = state;
  const health = feedHealth(status, state.updated, now, best, blocks[0]?.number ?? null);
  const legacy = params.get('q') || '';
  const kind = route[0] || (legacy ? 'search' : 'home');
  const query = route[1] || legacy;
  const detail = query && !['blocks', 'transactions', 'home'].includes(kind);
  const page = Math.max(1, Math.floor(Number(params.get('page')) || 1));
  const perPage = 25;
  const signed = blocks.flatMap(block => block.transactions.filter(tx => tx.signer).map(tx => ({ block, tx })));
  const gaps = blocks.slice(0, 30).flatMap((block, i, all) => {
    const older = all[i + 1];
    return older?.timestamp && block.timestamp && block.number === older.number + 1 ? [(block.timestamp - older.timestamp) / 1000] : [];
  }).filter(seconds => seconds > 0);
  const interval = gaps.length ? (gaps.reduce((sum, value) => sum + value, 0) / gaps.length).toFixed(1) : null;
  function go(target: string) { const suffix = new URLSearchParams(params); suffix.delete('q'); suffix.delete('page'); navigate(`${target}?${suffix}`); }
  function search() {
    setSearchError('');
    try {
      const parsed = parseExplorerSearch(input);
      if (parsed.kind === 'address') go(scanPath('account', parsed.value));
      else if (parsed.kind === 'subnet') go(scanPath('subnet', parsed.value));
      else if (parsed.kind === 'transaction') go(scanPath('extrinsic', `${parsed.value}-${parsed.index}`));
      else if (parsed.kind === 'hash') go(index.current?.findTransaction(parsed.value) ? scanPath('extrinsic', parsed.value) : `/scan/search/${parsed.value}`);
      else go(scanPath('block', parsed.value));
    } catch (cause) { setSearchError(cause instanceof Error ? cause.message : 'Invalid search'); }
  }
  const feedBlocks = kind === 'blocks' ? blocks.slice((page - 1) * perPage, page * perPage) : blocks.slice(0, 6);
  const activity = network === 'local' ? blocks.flatMap(block => block.transactions.map(tx => ({block, tx}))) : signed;
  const feedTx = activity.slice(0, 6);
  return <main className="scan">
    <div className="scan-nav"><ScanLink kind="home" className="scan-logo"><span className="scan-logo-icon">τ</span>TensorScan<span className="scan-logo-sub">Explorer</span></ScanLink>
      <nav aria-label="Explorer sections"><ScanLink kind="home" className={kind==='home'?'is-active':''}>Overview</ScanLink><ScanLink kind="blocks" className={kind==='blocks'?'is-active':''}>Blocks</ScanLink><ScanLink kind="transactions" className={kind==='transactions'?'is-active':''}>Transactions</ScanLink></nav>
      <button className="scan-theme" aria-label="Toggle color theme" onClick={toggleTheme}><RuneIcon name="sun" size={18}/></button>
      <label className="scan-network"><span className="sr-only">Explorer network</span><select aria-label="Explorer network" value={network} onChange={event => { select(event.target.value as ExplorerNetwork); }}>{Object.entries(explorerNetworks).filter(([key])=>key!=='local'||!publicOnly).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
    </div>
        <section className={`scan-search-area ${detail ? 'scan-search-area--compact' : ''}`}>
      {!detail && <><img className="scan-network-art" src="/images/tensorscan-network.webp" alt="" width="1536" height="1024" /><div className="scan-hero-copy"><span className="scan-hero-network"><RuneIcon name="globe" size={14}/>{explorerNetworks[network].label}</span><h1>Bittensor.<br /><em>In full view.</em></h1><p>Follow every block. Understand every call.<br />Live observations, straight from the chain.</p></div></>}
      <form className="scan-search" onSubmit={event => { event.preventDefault(); search(); }}><RuneIcon name="search" size={20}/><label className="sr-only" htmlFor="scan-search">Search blocks, transactions, accounts or subnets</label><input id="scan-search" value={input} onChange={event => setInput(event.target.value)} placeholder="Search address / transaction hash / block / subnet:1" maxLength={128} required /><DiscoverButton type="submit" label="Search"/></form>
      {searchError && <p role="alert" className="scan-search-error">{searchError}</p>}
      <div className="scan-live-status"><span className={`scan-dot ${health === 'Live' ? 'scan-dot--online' : ''}`} />{health}{best !== null && <span>Block {best.toLocaleString('en-US')}</span>}{state.updated && <span>Last block {ago(state.updated, now)}</span>}<button onClick={() => reconnect()}>Reconnect <RuneIcon name="arrow-right" size={12}/></button></div>

    </section>
    <div className="scan-content">
      <ChainProof state={shared} />
      {!detail && kind==='home' && <TaoMarket />}
      {state.genesis && <div className="scan-index-status"><span>Verified {state.chain || explorerNetworks[network].label}</span>{state.latencyMs !== null && <span>Last block decoded in {state.latencyMs} ms</span>}</div>}
      {health === 'Updates delayed' && <p className="scan-notice" role="status">No block has been decoded for over 45 seconds. These observations may be stale. Reconnect to retry.</p>}
      {network === 'local' && <LocalnetConnection status={status} reconnect={reconnect} selectTestnet={()=>select('test')} />}
      {!detail && <NetworkTools network={network} />}
      {state.error && <p className="scan-notice" role="alert">{state.error}</p>}
      {status !== 'Connected' && blocks.length > 0 && <p className="scan-notice">Showing cached blocks. Live data is unavailable until the connection recovers.</p>}
      {detail ? <ScanDetails query={query} kind={kind} api={state.api} finalized={finalized} index={index.current} revision={state.revision} blockHash={state.headHash} best={best} /> : <>
        <section className="scan-metrics" aria-label="Observed network metrics">
          <div><RuneIcon name="box"/><div><span>Latest block</span><strong>{best?.toLocaleString('en-US') ?? '—'}</strong><small>Provisional until finalized</small></div></div>
          <div><RuneIcon name="shield-check"/><div><span>Finalized block</span><strong>{finalized?.toLocaleString('en-US') ?? '—'}</strong><small>Confirmed by consensus</small></div></div>
          <div><RuneIcon name="clock"/><div><span>Block interval</span><strong>{interval ? `${interval}s` : '—'}</strong><small>Average across {gaps.length} recent intervals</small></div></div>
          <div><RuneIcon name="arrow-left-right"/><div><span>Signed transactions</span><strong>{blocks.length ? signed.length.toLocaleString('en-US') : '—'}</strong><small>Across {blocks.length} indexed blocks</small></div></div>
        </section>
        {(status === 'Connected' || blocks.length > 0) && <div className="scan-index-status"><span>{progress.done < progress.total ? `Indexing recent blocks: ${progress.done} / ${progress.total}` : `Recent history ready · ${blocks.length} blocks`}</span><progress aria-label="Block indexing progress" value={progress.done} max={progress.total} /><span>Browser cache · up to 200 blocks</span></div>}
        {kind === 'home' && <ActivityCharts key={state.genesis || network} blocks={blocks} network={explorerNetworks[network].label} initialMetric={network==='local'?'events':'signed'} />}
        {kind === 'transactions' ? <section className="scan-panel"><header><h2>{network === 'local' ? 'Latest extrinsics' : 'Latest signed transactions'}</h2><span>{activity.length} in indexed window</span></header>{activity.length ? <><TransactionsTable entries={activity.slice((page - 1) * perPage, page * perPage)} /></> : null}<TransactionEvidence state={shared} now={now} /><Pagination page={page} count={activity.length} /></section> : kind === 'blocks' ? <section className="scan-panel"><header><h2>Latest observed blocks</h2><span>{blocks.length} indexed</span></header><div className="scan-table-wrap"><table><thead><tr><th>Block</th><th>Age</th><th>Extrinsics</th><th>Events</th><th>Hash</th></tr></thead><tbody>{feedBlocks.map(block => <tr key={block.hash}><td><ScanLink kind="block" value={String(block.number)}>{block.number.toLocaleString('en-US')}</ScanLink></td><td>{ago(block.timestamp, now)}</td><td>{block.transactions.length}</td><td>{block.events.length}</td><td><code>{short(block.hash)}</code></td></tr>)}</tbody></table></div>{!blocks.length && <p className="scan-empty">Waiting for chain blocks…</p>}<Pagination page={page} count={blocks.length} /></section> : <div className="scan-feeds">
          <section className="scan-panel"><header><h2>Latest blocks</h2><span className="scan-live-badge">Best heads · finality below</span></header>{!feedBlocks.length && <p className="scan-empty">Waiting for chain blocks…</p>}{feedBlocks.map(block => <ScanLink kind="block" value={String(block.number)} className="scan-feed-row scan-block-row" key={block.hash}><span className="scan-row-symbol"><RuneIcon name="box"/></span><div><strong>{block.number.toLocaleString('en-US')}</strong><small>{ago(block.timestamp, now)}</small></div><div className="scan-feed-main"><span>{block.transactions.length} extrinsics · {finalized !== null && block.number <= finalized ? 'Finalized' : 'Unfinalized'}</span><small>{block.events.length} events recorded</small></div><code>{short(block.hash)}</code></ScanLink>)}<footer><ScanLink kind="blocks">View all indexed blocks</ScanLink></footer></section>
          <section className="scan-panel"><header><h2>Latest transactions</h2><span>{network === 'local' ? 'All extrinsics · includes system calls' : 'Signed calls'}</span></header>{!feedTx.length && <TransactionEvidence state={shared} now={now} />}{feedTx.map(({ block, tx }) => <div className="scan-feed-row scan-feed-row--transaction" key={`${block.hash}-${tx.index}`}><span className="scan-row-symbol"><RuneIcon name="arrow-left-right"/></span><div><ScanLink kind="extrinsic" value={`${block.number}-${tx.index}`}>{short(tx.hash)}</ScanLink><small>{ago(block.timestamp, now)}</small></div><div className="scan-feed-main"><span className="scan-method">{transactionLabel(tx)}</span><small>{tx.signer ? <>From <ScanLink kind="account" value={tx.signer}>{short(tx.signer)}</ScanLink></> : 'Unsigned system call'}</small></div><span className={`scan-result scan-result--${tx.result.toLowerCase()}`}>{tx.result}</span></div>)}{feedTx.length>0 && <TransactionEvidence state={shared} now={now} />}<footer><ScanLink kind="transactions">View all indexed transactions</ScanLink></footer></section>
        </div>}
      </>}
      <footer className="scan-footer"><div><strong>TensorScan</strong><p>A clear view of Bittensor. Read-only, directly from RPC.</p><p className="scan-design-credits"><a href="https://www.obsidianui.dev/" target="_blank" rel="noreferrer">ObsidianUI</a><span>/</span><a href="https://www.runeicons.com/" target="_blank" rel="noreferrer">Rune Icons</a></p></div><div><span>{state.chain || explorerNetworks[network].label}</span><code>{endpoint}</code><small>Recent browser index. Historical state depends on RPC retention.</small></div></footer>
    </div>
  </main>;
}
function Pagination({ page, count }: { page: number; count: number }) {
  const [params, setParams] = useSearchParams();
  const pages = Math.max(1, Math.ceil(count / 25));
  function go(value: number) { const next = new URLSearchParams(params); next.set('page', String(value)); setParams(next); }
  return <footer className="scan-pagination"><button disabled={page <= 1} onClick={() => go(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => go(page + 1)}>Next</button></footer>;
}
