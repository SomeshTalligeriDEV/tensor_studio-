import { useState } from 'react';
import { Link } from '@remix-run/react';
export default function OwnerAccess() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <main className="studio-home" style={{ maxWidth: 580, paddingTop: 64 }}>
    <p className="studio-eyebrow">Execution workspace</p>
    <h1>Owner access</h1>
    <p>The playground, builder and network explorer are public. Connect the private runner here to assemble projects and manage processes.</p>
    <form className="flex flex-col gap-4 mt-6" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError('');
      try {
        const response = await fetch('/api/owner-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
        if (!response.ok) throw new Error('Owner access could not be verified.');
        window.location.assign('/nodes');
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Connection failed.'); }
      finally { setBusy(false); }
    }}>
      <label>Workspace password<input className="block w-full border rounded p-3 mt-2" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <button className="border rounded p-3" disabled={busy}>{busy ? 'Connecting…' : 'Connect owner workspace'}</button>
      {error && <p role="alert">{error}</p>}
    </form>
    <Link to="/playground" className="inline-block mt-6 underline">Return to the public playground</Link>
  </main>;
}
