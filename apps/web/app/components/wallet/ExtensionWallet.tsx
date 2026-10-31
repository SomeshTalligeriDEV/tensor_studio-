import { useEffect, useRef, useState } from 'react';
import { Link } from '@remix-run/react';
import { useChain } from '~/components/studio/ChainProvider';
import { useBlockQuery } from '~/lib/chain/useBlockQuery';
import { connectTaostats, sendExtensionTransfer, taostatsProvider, TAOSTATS_INSTALL_URL, type ExtensionAccount, type ExtensionSession } from '~/lib/chain/extension-wallet';
import { formatTao, previewTransfer, type TransferPreview } from '~/lib/chain/transfers';

/** Preferred wallet: extension consent and signing, never seed import into the app. */
export function ExtensionWallet({ onAddressChange }: { onAddressChange?: (address: string) => void } = {}) {
  const { state } = useChain();
  const [installed, setInstalled] = useState(false);
  const [accounts, setAccounts] = useState<ExtensionAccount[]>([]);
  const [address, setAddress] = useState('');
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('1');
  const [preview, setPreview] = useState<TransferPreview>();
  const [hash, setHash] = useState('');
  const session = useRef<ExtensionSession>();
  const epoch = useRef(0);
  const latest = useRef({ generation: state.generation, address, api: state.api });
  latest.current = { generation: state.generation, address, api: state.api };
  useEffect(() => { setInstalled(!!taostatsProvider()); return () => { epoch.current++; session.current?.disconnect(); }; }, []);
  useEffect(() => { onAddressChange?.(address); }, [address, onAddressChange]);
  useEffect(() => { setPreview(undefined); setHash(''); setMessage(''); }, [address, state.generation]);
  const balance = useBlockQuery(`extension-balance:${address}`, async (api, blockHash) => {
    if (!address) return null;
    const at = await api.at(blockHash);
    const account = await at.query.system.account(address) as unknown as { data: { free: { toString(): string } } };
    return formatTao(BigInt(account.data.free.toString()));
  });
  function disconnect() {
    epoch.current++; session.current?.disconnect(); session.current = undefined;
    setAccounts([]); setAddress(''); setConnected(false); setPreview(undefined); setHash(''); setBusy(false);
    setMessage('Disconnected from TensorStudio. Manage website permission in Taostats Wallet to revoke access.');
  }
  async function connect() {
    const attempt = ++epoch.current;
    session.current?.disconnect(); session.current = undefined;
    setBusy(true); setMessage('Approve TensorStudio in Taostats Wallet.'); setInstalled(!!taostatsProvider());
    try {
      const next = await connectTaostats(list => {
        if (attempt !== epoch.current) return;
        setAccounts(list); setAddress(current => list.some(item => item.address === current) ? current : list[0]?.address || ''); setPreview(undefined);
      });
      if (attempt !== epoch.current) { next.disconnect(); return; }
      session.current = next; setConnected(true); setMessage(next.accounts.length ? 'Connected. Your keys remain in Taostats Wallet.' : 'No compatible accounts were shared. Enable a Substrate account in Taostats Wallet.');
    } catch (error) {
      if (attempt === epoch.current) { setAccounts([]); setAddress(''); setConnected(false); setMessage(error instanceof Error ? error.message : 'Wallet connection was declined or failed.'); }
    } finally { if (attempt === epoch.current) setBusy(false); }
  }
  async function createPreview() {
    const { api, generation } = state;
    if (!api || !address) return;
    const selected = address;
    setBusy(true); setMessage(''); setPreview(undefined); setHash('');
    try {
      const next = await previewTransfer(api, selected, recipient, amount);
      if (latest.current.api === api && latest.current.generation === generation && latest.current.address === selected) setPreview(next);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Fee preview failed.'); }
    finally { setBusy(false); }
  }
  async function confirm() {
    const api = state.api, approval = preview, wallet = session.current, generation = state.generation;
    if (!api || !approval || !wallet) return;
    const isCurrent = () => latest.current.api === api && latest.current.generation === generation && latest.current.address === approval.address && session.current === wallet;
    setBusy(true); setPreview(undefined); setMessage('Review the transaction in Taostats Wallet. After approval, wait for finalization.');
    try {
      const result = await sendExtensionTransfer(api, wallet, approval, isCurrent);
      if (isCurrent()) { setHash(result); setMessage('Transfer finalized on localnet.'); }
    } catch (error) { if (isCurrent()) setMessage(error instanceof Error ? error.message : 'Extension signing or submission failed.'); }
    finally { setBusy(false); }
  }
  const field = 'block w-full mt-2 p-3 border rounded-lg bg-bitcode-elements-background-depth-2';
  const local = state.network === 'local';
  return <section className="mb-8 p-6 border rounded-xl" aria-labelledby="extension-wallet-title">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="extension-wallet-title" className="text-xl font-medium">Taostats Wallet</h2><span className="text-sm">Preferred wallet</span></div>
    <p className="mt-3 mb-4">Connect your browser extension to choose an account. Approve transactions inside Taostats; TensorStudio never asks for its recovery phrase.</p>
    {!connected ? <div className="flex flex-wrap gap-3"><button className="px-4 py-2 border rounded-lg" disabled={busy} onClick={() => void connect()}>{busy ? 'Waiting for wallet…' : 'Connect Taostats Wallet'}</button><a className="px-4 py-2 underline" href={TAOSTATS_INSTALL_URL} target="_blank" rel="noreferrer">{installed ? 'Wallet information' : 'Install Taostats Wallet'}</a></div> : <>
      <label className="block">Shared account<select aria-label="Taostats account" className={field} value={address} disabled={busy || !accounts.length} onChange={event => setAddress(event.target.value)}>{!accounts.length && <option value="">No accounts shared</option>}{accounts.map(account => <option key={account.address} value={account.address}>{account.name || 'Account'} · {account.address}</option>)}</select></label>
      <button className="my-3 underline" onClick={disconnect}>Disconnect wallet</button>
      {address && <div className="my-4"><p className="break-all font-mono text-sm">{address}</p><p className="mt-2">Free balance: {state.status !== 'Connected' ? 'Chain unavailable' : balance.error ? 'Unavailable' : balance.data === null ? 'Reading chain…' : `${balance.data} TAO`}</p>{balance.error && <p role="alert" className="text-sm mt-2">{balance.error}</p>}<Link className="underline inline-block mt-2" to={`/scan/account/${address}?network=${state.network}`}>View account in TensorScan</Link></div>}
      <form className="grid gap-4 mt-5" onSubmit={event => { event.preventDefault(); void createPreview(); }}>
        <h3 className="font-medium">Localnet transfer</h3>
        <label>Recipient SS58 address<input required className={field} value={recipient} disabled={busy || !local} onChange={event => { setRecipient(event.target.value); setPreview(undefined); }} /></label>
        <label>Amount in TAO<input required inputMode="decimal" className={field} value={amount} disabled={busy || !local} onChange={event => { setAmount(event.target.value); setPreview(undefined); }} /></label>
        <button className="px-4 py-2 border rounded-lg" disabled={busy || !local || !address || !state.api || state.status !== 'Connected'} title={!local ? 'Transfers are enabled only on the local development chain' : undefined}>Preview transfer fee</button>
      </form>
      {preview && <div className="p-4 border rounded-lg mt-4"><p>{formatTao(preview.rao)} TAO to <span className="break-all">{preview.destination}</span></p><p>Estimated fee: {formatTao(preview.fee)} TAO</p><p className="text-sm my-2">balances.transferKeepAlive · Localnet · Approval expires after 60 seconds.</p><button className="px-4 py-2 border rounded-lg" disabled={busy} onClick={() => void confirm()}>Approve in Taostats Wallet</button></div>}
      <p className="text-sm mt-4">Public networks are read-only here. A local chain may need to be added to the extension before it can sign.</p>
    </>}
    {message && <p role="status" className="mt-4 break-words">{message}</p>}
    {hash && <Link className="underline block mt-3 break-all" to={`/scan/extrinsic/${hash}?network=local`}>View finalized transaction: {hash}</Link>}
  </section>;
}
