import { readContacts, upsertContact, recentRecipients } from '~/lib/chain/contacts';
import { Link } from '@remix-run/react';
import { z } from 'zod';
import { useRef, useState } from 'react';
import type { ApiPromise } from '@polkadot/api';
import { MnemonicSigner, type EncryptedWallet } from '~/lib/chain/wallet';
import { formatTao, previewTransfer, sendTransfer, type TransferPreview } from '~/lib/chain/transfers';

const activitySchema = z.array(z.object({ hash: z.string().regex(/^0x[0-9a-f]{64}$/i), recipient: z.string(), amount: z.string(), time: z.string() })).max(50);
type Activity = { hash: string; recipient: string; amount: string; time: string };
export function Transfers({ api, wallet }: { api?: ApiPromise; wallet: EncryptedWallet }) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('10');
  const [password, setPassword] = useState('');
  const [preview, setPreview] = useState<TransferPreview>();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [message, setMessage] = useState('');
  const storageKey = `bitcode-transfers:${api?.genesisHash.toHex()}:${wallet.address}`;
  const [activity, setActivity] = useState<Activity[]>(() => {
    try { return activitySchema.parse(JSON.parse(localStorage.getItem(storageKey) || '[]')); } catch { return []; }
  });
  const contactsKey = `bitcode-contacts:${api?.genesisHash.toHex()}:${wallet.address}`;
  const [contacts, setContacts] = useState(() => {
    try { return readContacts(localStorage.getItem(contactsKey)); } catch { return []; }
  });
  const [contactName, setContactName] = useState('');
  function chooseRecipient(address: string) { setRecipient(address); setPreview(undefined); setPassword(''); }
  async function perform(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage('');
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Wallet operation failed.'); }
    finally { pending.current = false; setBusy(false); setPassword(''); }
  }
  const input = 'block w-full p-3 rounded border bg-bitcode-elements-background-depth-2';
  return <section className="flex flex-col gap-4 mt-6">
    <h2>Bittensor · Local test TAO</h2>
    <Link to="/playground?network=local">Get local test TAO in the playground →</Link>
    <h2>Send TAO</h2>
    {contacts.length > 0 && <label>Saved contacts<select className={input} disabled={busy} value="" onChange={(event) => chooseRecipient(event.target.value)}><option value="" disabled>Choose a contact</option>{contacts.map((contact) => <option key={contact.address} value={contact.address}>{contact.name} · {contact.address.slice(0, 8)}…{contact.address.slice(-6)}</option>)}</select></label>}
    {activity.length > 0 && <label>Recent recipients<select className={input} disabled={busy} value="" onChange={(event) => chooseRecipient(event.target.value)}><option value="" disabled>Choose a recent recipient</option>{recentRecipients(activity).map((address) => <option key={address} value={address}>{address}</option>)}</select></label>}
    <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void perform(async () => {
      if (!api) throw new Error('Start the local Bittensor chain first.');
      setPreview(undefined); setPreview(await previewTransfer(api, wallet.address, recipient, amount));
    }); }}>
      <label>Recipient SS58 address<input className={input} required disabled={busy} value={recipient} onChange={(event) => { setRecipient(event.target.value); setPreview(undefined); }} /></label>
      <label>Amount in TAO<input className={input} inputMode="decimal" required disabled={busy} value={amount} onChange={(event) => { setAmount(event.target.value); setPreview(undefined); }} /></label>
      <button disabled={busy || !api}>Preview transfer fee</button>
    </form>
    <details><summary>Save this recipient as a contact</summary><form className="flex flex-col gap-3 mt-3" onSubmit={(event) => { event.preventDefault(); void perform(async () => {
      const next = upsertContact(contacts, contactName, recipient);
      try { localStorage.setItem(contactsKey, JSON.stringify(next)); } catch { throw new Error('Contact could not be saved. Browser storage is unavailable.'); }
      setContacts(next); setContactName(''); setMessage('Contact saved in this browser.');
    }); }}><label>Contact name<input className={input} required maxLength={40} disabled={busy} value={contactName} onChange={(event) => setContactName(event.target.value)} /></label><p className="break-all">{recipient || 'Enter a recipient address above first.'}</p><button disabled={busy || !recipient}>Save contact</button></form></details>
    {preview && <form className="flex flex-col gap-3 border rounded p-4" onSubmit={(event) => { event.preventDefault(); void perform(async () => {
      if (!api) throw new Error('Localnet disconnected.');
      const approved = preview; setPreview(undefined);
      const signer = await MnemonicSigner.unlock(wallet, password);
      setPassword('');
      try {
        setMessage('Waiting for local-chain finalization…');
        const hash = await sendTransfer(api, signer, approved);
        const next = [{ hash, recipient: approved.destination, amount: formatTao(approved.rao), time: new Date().toISOString() }, ...activity].slice(0, 50);
        setActivity(next);
        try { localStorage.setItem(storageKey, JSON.stringify(next)); setMessage('Transfer finalized on local Bittensor.'); }
        catch { setMessage('Transfer finalized. Browser activity storage is unavailable.'); }
      } finally { signer.lock(); }
    }); }}>
      <p className="break-all">Send {formatTao(preview.rao)} TAO to {preview.destination}</p>
      <p>Estimated fee: {formatTao(preview.fee)} TAO. Keep-alive enabled. Preview expires after 60 seconds.</p>
      <label>Confirm with wallet password<input type="password" autoComplete="current-password" required disabled={busy} className={input} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <button disabled={busy}>Confirm and send on localnet</button>
    </form>}
    {message && <p role="status" className="break-all">{message}</p>}
    {activity.length > 0 && <><h2>Local transfer activity</h2><ul>{activity.map((entry) => <li className="break-all my-3" key={entry.hash}>{entry.amount} TAO → {entry.recipient}<br /><Link to={`/scan/extrinsic/${entry.hash}?network=local`}><code>{entry.hash}</code></Link><br />{entry.time}</li>)}</ul></>}
    <p>Local test TAO has no monetary value. Mainnet sends are disabled.</p>
  </section>;
}
