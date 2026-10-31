import { useEffect, useRef, useState } from 'react';
import { useBlockQuery } from '~/lib/chain/useBlockQuery';
import { useChain } from '~/components/studio/ChainProvider';
import { encryptMnemonic, generateMnemonic, importEncryptedWallet, MAX_WALLET_BYTES, loadWallet, MnemonicSigner, saveWallet, type EncryptedWallet } from '~/lib/chain/wallet';
import { QRCodeSVG } from 'qrcode.react';
import { Transfers } from './Transfers';
import type { Signer } from '~/lib/chain/signer';

export function Wallet() {
  const {state: chain, select} = useChain();
  const chainApi = chain.api ?? undefined;
  const [ready, setReady] = useState(false);
  const [wallet, setWallet] = useState<EncryptedWallet>();
  const [mode, setMode] = useState<'choose' | 'backup' | 'confirm' | 'import' | 'json'>('choose');
  const [phrase, setPhrase] = useState('');
  const [backup, setBackup] = useState<File>();
  const [positions, setPositions] = useState<number[]>([]);
  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [balance, setBalance] = useState('Connecting…');
  const signer = useRef<Signer>();
  const alive = useRef(true);

  function lock() { signer.current?.lock(); signer.current = undefined; setUnlocked(false); setPassword(''); }
  useEffect(() => {
    alive.current = true;
    loadWallet().then((saved) => { if (alive.current) { setWallet(saved); setReady(true); } }).catch((error) => setMessage(error.message));
    return () => { alive.current = false; signer.current?.lock(); };
  }, []);
  useEffect(() => {
    if (!unlocked) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => { clearTimeout(timer); timer = setTimeout(lock, 15 * 60 * 1000); };
    reset();
    window.addEventListener('pointerdown', reset);
    window.addEventListener('keydown', reset);
    window.addEventListener('pagehide', lock);
    return () => { clearTimeout(timer); window.removeEventListener('pointerdown', reset); window.removeEventListener('keydown', reset); window.removeEventListener('pagehide', lock); };
  }, [unlocked]);
  const balanceRead=useBlockQuery(wallet?`wallet:${wallet.address}`:'',async(api,hash)=>{
    if(!wallet)return null;
    const at=await api.at(hash);
    const value=await at.query.system.account(wallet.address);
    const data=value.toJSON() as unknown as {data:{free:string|number}};
    const rao=BigInt(data.data.free);
    return `${rao/1000000000n}.${(rao%1000000000n).toString().padStart(9,'0')} TAO`;
  });
  useEffect(()=>{setBalance(balanceRead.error || balanceRead.data || (chain.api?'Reading chain balance…':'Chain unavailable'));},[balanceRead.data,balanceRead.error,chain.api]);
  useEffect(()=>{lock();},[chain.generation]);


  async function perform(action: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Wallet operation failed.'); }
    finally { setPassword(''); setConfirmation(''); setBusy(false); }
  }
  async function create() {
    const words = await generateMnemonic();
    const selected = new Set<number>();
    while (selected.size < 3) selected.add(crypto.getRandomValues(new Uint32Array(1))[0] % 12);
    setPositions([...selected].sort((a, b) => a - b)); setAnswers(['', '', '']); setPhrase(words); setMode('backup');
  }
  async function persist() {
    if (password !== confirmation) throw new Error('Passwords do not match.');
    if (mode === 'confirm' && positions.some((index, i) => answers[i].trim() !== phrase.split(' ')[index])) throw new Error('Recovery words do not match. Check your backup.');
    const encrypted = await encryptMnemonic(phrase, password);
    await saveWallet(encrypted);
    setWallet(encrypted); setPhrase(''); setAnswers(['', '', '']); setMode('choose');
    setMessage('Wallet saved encrypted and locked.');
  }
  async function importBackup() {
    if (!backup) throw new Error('Choose an encrypted wallet JSON file.');
    if (backup.size > MAX_WALLET_BYTES) throw new Error('Wallet backup must be smaller than 64 KB.');
    const encrypted = await importEncryptedWallet(await backup.text(), password);
    if (!alive.current) return;
    await saveWallet(encrypted);
    setWallet(encrypted); setBackup(undefined); setMode('choose');
    setMessage('Wallet imported encrypted and locked.');
  }
  function exportBackup() {
    if (!wallet) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(wallet, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `bitcode-${wallet.address}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Encrypted backup downloaded. Keep its password separately.');
  }
  const inputClass = 'block w-full p-3 rounded border bg-bitcode-elements-background-depth-2';
  return <main className="studio-home wallet-page" style={{ maxWidth: 850 }}>
    <p className="studio-eyebrow">LOCALNET WALLET</p><h1>Your keys. Your browser.</h1>
    <p className="mb-6">Recovery words stay on this device. The encrypted wallet is stored in this browser. Save your recovery phrase before continuing.</p>
    {message && <p role="status" className="p-3 mb-4 border rounded">{message}</p>}
    {!ready && <p>Loading encrypted wallet storage…</p>}
    {ready && !wallet && mode === 'choose' && <div className="flex gap-4"><button disabled={busy} onClick={() => void perform(create)}>Create 12-word wallet</button><button disabled={busy} onClick={() => { setPhrase(''); setMode('import'); }}>Import recovery phrase</button><button disabled={busy} onClick={() => setMode('json')}>Import encrypted JSON</button></div>}
    {!wallet && mode === 'json' && <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void perform(importBackup); }}>
      <label>Encrypted sr25519 JSON backup<input type="file" accept=".json,application/json" disabled={busy} className={inputClass} onChange={(event) => setBackup(event.target.files?.[0])} /></label>
      <label>Backup password<input type="password" autoComplete="current-password" required disabled={busy} className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <button disabled={busy || !backup}>Import and lock wallet</button>
      <button type="button" disabled={busy} onClick={() => { setBackup(undefined); setPassword(''); setMode('choose'); }}>Cancel</button>
    </form>}
    {!wallet && mode === 'backup' && <section><h2>Write down these 12 words in order</h2><p className="p-6 my-4 border rounded select-text">{phrase}</p><button onClick={() => setMode('confirm')}>I saved my recovery phrase</button></section>}
    {!wallet && (mode === 'confirm' || mode === 'import') && <form className="flex flex-col gap-4" autoComplete="off" onSubmit={(event) => { event.preventDefault(); void perform(persist); }}>
      {mode === 'import' ? <label>12-word recovery phrase<textarea spellCheck={false} autoComplete="off" className={inputClass} value={phrase} onChange={(event) => setPhrase(event.target.value)} /></label> : positions.map((position, i) => <label key={position}>Word {position + 1}<input autoComplete="off" spellCheck={false} className={inputClass} value={answers[i]} onChange={(event) => setAnswers((current) => current.map((word, j) => i === j ? event.target.value : word))} /></label>)}
      <label>Password (at least 12 characters)<input type="password" autoComplete="new-password" minLength={12} required className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <label>Confirm password<input type="password" autoComplete="new-password" required className={inputClass} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
      <button disabled={busy}>Encrypt and save wallet</button>
      <button type="button" disabled={busy} onClick={() => { setPhrase(''); setAnswers(['', '', '']); setPassword(''); setConfirmation(''); setMode('choose'); }}>Cancel</button>
    </form>}
    {wallet && <section className="flex flex-col gap-4">
      <h2>{unlocked ? 'Unlocked' : 'Locked'} · sr25519</h2>
      <details className="wallet-receive"><summary>Receive TAO · show address QR</summary><div className="wallet-qr"><QRCodeSVG value={wallet.address} size={192} marginSize={4} level="M" title="Bittensor wallet receive address" /></div><p>Scan this public address to receive local test TAO.</p></details>
      <code className="break-all">{wallet.address}</code>
      <button onClick={() => void navigator.clipboard.writeText(wallet.address).then(() => setMessage('Address copied.')).catch(() => setMessage('Clipboard unavailable. Select the address to copy it.'))}>Copy address</button>
      <button onClick={exportBackup}>Download encrypted backup</button>
      <p>Free balance: {balance}</p>
      {unlocked ? <button onClick={lock}>Lock wallet</button> : <form className="flex gap-3" onSubmit={(event) => { event.preventDefault(); void perform(async () => {
        const next = await MnemonicSigner.unlock(wallet, password);
        if (!alive.current) { next.lock(); return; }
        signer.current = next; setUnlocked(true);
      }); }}><input aria-label="Wallet password" type="password" autoComplete="current-password" required className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} /><button disabled={busy}>Unlock</button></form>}
      <p>Locks after 15 minutes without interaction, or when you leave this page.</p>
      {chainApi && chain.network === 'local' ? <Transfers key={chain.genesis + wallet.address + chain.generation} api={chainApi} wallet={wallet} /> : <p>Public network balances are read-only. Select Localnet to fund a development wallet or send test TAO.</p>}
    </section>}
  </main>;
}
