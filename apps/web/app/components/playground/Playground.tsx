import { useEffect, useRef, useState } from 'react';
import { Link } from '@remix-run/react';
import { decodeAddress } from '@polkadot/util-crypto';
import { useChain } from '~/components/studio/ChainProvider';
import { IdeaComposer } from '~/components/studio/IdeaComposer';
import './playground.css';
import { ExtensionWallet } from '~/components/wallet/ExtensionWallet';
import { runnerFetch } from '~/lib/runner/client';
import '~/components/explorer/explorer.css';

export function Playground() {
  const { state, select } = useChain();
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [block, setBlock] = useState('');
  const epoch = useRef(0);
  const pending = useRef(false);
  useEffect(() => { epoch.current++; setMessage(''); setBlock(''); return () => { epoch.current++; }; }, [state.generation, address]);
  async function fund() {
    if (pending.current || state.network !== 'local' || !state.api || !state.genesis) return;
    try { decodeAddress(address); } catch { setMessage('Enter a valid SS58 wallet address.'); return; }
    pending.current = true; setBusy(true); setMessage('Submitting local funding. Waiting for the chain result…'); setBlock('');
    const attempt = epoch.current;
    try {
      const response = await runnerFetch('http://127.0.0.1:8787/localnet/fund', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Bitcode-Client': 'studio' },
        body: JSON.stringify({ address, expected_genesis: state.genesis }), signal: AbortSignal.timeout(65000),
      });
      const body = await response.json() as { amount_tao?: number; block_hash?: string; detail?: string | { message?: string } };
      if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : body.detail?.message || 'Local funding failed. Check the runner and localnet.');
      if (attempt !== epoch.current) return;
      if (body.amount_tao !== 1000 || !body.block_hash) throw new Error('Funding response could not be confirmed. Check the account before retrying.');
      setMessage('1,000 local test TAO transferred. The live balance updates when TensorScan reads the block.'); setBlock(body.block_hash);
    } catch (error) { if (attempt === epoch.current) setMessage(error instanceof Error ? error.message : 'Funding unavailable.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="guided-playground">
    <section className="playground-intro"><div className="playground-symbol" aria-hidden="true"><span className="i-ph:flask" /></div><p className="playground-kicker">The idea lab</p><h1>A little curiosity.<br />Something worth building.</h1><p>Explore an idea, find your next step, and bring it to life on Bittensor.</p></section>
    <IdeaComposer />
    <details className="playground-network"><summary><span className="i-ph:plugs-connected" aria-hidden="true" /><div><strong>Network tools</strong><small>Connect a wallet, get test TAO, explore transactions</small></div><span className="playground-network-state">{state.network} · {state.status}</span><span aria-hidden="true">⌄</span></summary><div className="scan">
    <header className="scan-search-area"><h1>Your network sandbox.</h1><p>Connect a wallet, get development TAO, and follow your first transaction.</p>
      <label>Playground network <select aria-label="Playground network" className="text-black p-2 rounded" value={state.network} onChange={e => select(e.target.value as 'local' | 'test' | 'finney')}><option value="test">Bittensor testnet</option><option value="local">Localnet · your M3</option><option value="finney" disabled>Mainnet · read only</option></select></label>
      <div className="scan-live-status">{state.chain || state.network} · {state.status}{state.best !== null && ` · Block ${state.best}`}</div>
    </header>
    <main className="scan-content flex flex-col gap-6">
      <ExtensionWallet onAddressChange={setAddress} />
      <section className="border rounded-xl p-6 flex flex-col gap-4" aria-labelledby="funding-title">
        <h2 id="funding-title" className="text-xl font-medium">Test TAO & funding</h2>
        <label className="flex flex-col gap-2">Recipient public SS58 address<input className="border rounded p-3 bg-transparent w-full" value={address} onChange={e => setAddress(e.target.value.trim())} placeholder="Connect Taostats Wallet or paste a public address" disabled={busy} /></label>
        {state.network === 'local' ? <>
          <p>Receive 1,000 local test TAO from Alice, the pre-funded development account. Runs only against your local Subtensor chain.</p>
          <code className="break-all">transfer(dest_ss58=recipient, amount_tao=1000, keep_alive=True)</code>
          <button className="border rounded p-3 self-start" disabled={busy || !address || !state.api || state.status !== 'Connected'} onClick={() => void fund()}>{busy ? 'Waiting for funding…' : 'Get 1,000 local test TAO'}</button>
          {(!state.api || state.error) && <p role="status">{state.error || 'Start your native localnet and connect before requesting funds.'}</p>}
          <a href="https://www.bittensor.com/docs/guides/local-development#the-alice-dev-account" target="_blank" rel="noreferrer">Official localnet funding guide ↗</a>
        </> : state.network === 'test' ? <>
          <p>Official Bittensor documentation lists testnet TAO as available on request. No official public web faucet has been verified. Request test TAO through the official community; availability is managed by them.</p>
          <div className="flex flex-wrap gap-4"><a href="https://guides.learnbittensor.org/concepts/bittensor-networks" target="_blank" rel="noreferrer">Official testnet guidance ↗</a><a href="https://discord.gg/qasY3HA9F9" target="_blank" rel="noreferrer">Official Bittensor community ↗</a></div>
          <button disabled={!address} className="border rounded p-3 self-start" onClick={() => { void navigator.clipboard.writeText(address).then(() => setMessage('Public address copied.')).catch(() => setMessage('Clipboard unavailable. Select and copy the address above.')); }}>Copy address for your request</button>
          <p>Localnet TAO cannot be used on testnet. Use the SS58 address from your wallet; no seed or private key is needed.</p>
        </> : <p>Development funding is available on localnet. Select testnet for official token request guidance.</p>}
        {message && <p role="status">{message}</p>}
        {block && <Link className="break-all underline" to={`/scan/block/${block}?network=local`}>View funding block in TensorScan →</Link>}
        {address && <Link className="underline" to={`/scan/account/${encodeURIComponent(address)}?network=${state.network}`}>View account and live activity →</Link>}
      </section>
      <div className="flex flex-wrap gap-6"><Link to="/editor">Build an app →</Link><Link to="/subcreate">Build a subnet →</Link><Link to={`/scan?network=${state.network}`}>Explore this network →</Link></div>
    </main>
  </div></details></div>;
}
