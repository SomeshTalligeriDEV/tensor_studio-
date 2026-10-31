import { useState } from 'react';
import { Link } from '@remix-run/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { prepareSnapshot, syncSnapshot } from '~/lib/runner/sync';

export function RunnerSync({ streaming }: { streaming?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [project, setProject] = useState('');
  async function sync() {
    setBusy(true);
    setProject('');
    setMessage('Saving editor changes…');
    try {
      await workbenchStore.saveAllFiles();
      const snapshot = prepareSnapshot(workbenchStore.files.get());
      setMessage(`Syncing ${snapshot.entries.length} text files…`);
      const id = await syncSnapshot(snapshot, `project-${crypto.randomUUID()}`);
      setProject(id);
      setMessage(`Saved ${snapshot.entries.length} files. Skipped ${snapshot.skipped.length} binary, generated, or credential files.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sync project.');
    } finally { setBusy(false); }
  }
  return <div className="px-3 py-2 border-b border-bitcode-elements-borderColor text-xs flex gap-3 items-center flex-wrap">
    <button disabled={busy || streaming} onClick={() => void sync()} className="border rounded px-2 py-1" title="Save text files to a new local runner snapshot">{busy ? 'Syncing…' : 'Save to runner'}</button>
    <span role="status">{message || 'Create a local snapshot to run with Python or btcli.'}</span>
    {project && <Link to={`/runner?project=${encodeURIComponent(project)}`} className="text-accent">Open runner →</Link>}
  </div>;
}
