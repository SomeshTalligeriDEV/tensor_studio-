import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { selectedModel } from '~/lib/stores/ai';

export function ModelSettings() {
  const model = useStore(selectedModel);
  const [models, setModels] = useState<{ id: string; label: string }[]>([]);
  const [message, setMessage] = useState('Loading models…');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/models', { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error('Could not load AI settings.');
      const data = await response.json() as { models: { id: string; label: string }[]; fallback: boolean };
      const options = [...data.models, ...(data.fallback ? [{ id: 'fallback', label: 'Configured fallback' }] : [])];
      setModels(options);
      setMessage(options.length ? '' : 'Set AI_API_KEY, AI_BASE_URL and AI_MODEL in apps/web/.env.local, then restart the web server.');
    }).catch(() => { if (!controller.signal.aborted) setMessage('Could not load AI settings. Reload to retry.'); });
    return () => controller.abort();
  }, []);
  return <div className="p-3 text-xs">
    <label htmlFor="ai-model">AI model</label>
    <select id="ai-model" className="w-full mt-2 bg-bitcode-elements-background-depth-2" value={model} onChange={(event) => selectedModel.set(event.target.value)}>
      <option value="">Server default</option>
      {models.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
    </select>
    {message && <p className="mt-2" role="status">{message}</p>}
  </div>;
}
