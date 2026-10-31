import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from '@remix-run/react';
import { useStore } from '@nanostores/react';
import { selectedModel } from '~/lib/stores/ai';
import { answerSchema } from '~/lib/ask/response';
import { CONVERSATION_KEY, requestMessages, restoreConversation, type ConversationTurn } from '~/lib/ask/conversation';

type Model = { id: string; label: string };
const starters = [
  { icon: 'i-ph:lightbulb', title: 'Shape an idea', detail: 'Find a useful problem to solve', prompt: 'Help me find a useful Bittensor app idea. Ask me about my interests first.' },
  { icon: 'i-ph:graph', title: 'Design a subnet', detail: 'Turn a task into a network', prompt: 'Help me design a subnet with measurable quality. What should I decide first?' },
  { icon: 'i-ph:code', title: 'Build something', detail: 'Make a practical app plan', prompt: 'I want to build an app on Bittensor. Help me choose a realistic first project.' },
];
export function IdeaComposer() {
  const navigate = useNavigate();
  const location = useLocation();
  const model = useStore(selectedModel);
  const [mode, setMode] = useState<'ask' | 'build'>('ask');
  const [path, setPath] = useState<'app' | 'subnet'>('app');
  const [prompt, setPrompt] = useState('');
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [models, setModels] = useState<Model[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const controller = useRef<AbortController>();
  const pendingRef = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try { setTurns(restoreConversation(sessionStorage.getItem(CONVERSATION_KEY))); } catch { /* Storage may be disabled */ }
    const draft = (location.state as { draft?: unknown } | null)?.draft;
    if (typeof draft === 'string') setPrompt(draft.slice(0, 2000));
    setReady(true);
    const metadata = new AbortController();
    fetch('/api/models', { signal: metadata.signal }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { models: Model[]; provider: string | null; fallback: boolean };
      setModels([...data.models, ...(data.fallback ? [{ id: 'fallback', label: 'Configured fallback' }] : [])]);
      setProvider(data.provider);
    }).catch(() => {});
    return () => { metadata.abort(); controller.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { sessionStorage.setItem(CONVERSATION_KEY, JSON.stringify(turns.slice(-5))); } catch { /* Conversation still works without persistence */ }
  }, [turns, ready]);
  useEffect(() => { if (pending) end.current?.scrollIntoView({ block: 'nearest' }); }, [pending, turns]);
  useEffect(() => { if (ready && !busy) input.current?.focus(); }, [busy, ready]);
  function openBuilder(target: 'app' | 'subnet', draft: string) {
    navigate(target === 'app' ? '/editor' : '/subcreate', { state: { draft: draft.slice(0, 2000), askConversation: requestMessages(turns, draft).slice(0, -1) } });
  }
  async function ask(text: string) {
    const question = text.trim();
    if (!question || pendingRef.current || !ready) return;
    if (mode === 'build') { openBuilder(path, question); return; }
    pendingRef.current = true;
    setBusy(true); setError(''); setPending(question); setPrompt(question);
    const request = new AbortController(); controller.current = request;
    try {
      const response = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: requestMessages(turns, question), model: model || undefined }), signal: request.signal });
      if (!response.ok) throw new Error(await response.text());
      const result = answerSchema.parse(await response.json());
      if (request.signal.aborted || controller.current !== request) return;
      setTurns((previous) => [...previous, { prompt: question, response: result }].slice(-5)); setPrompt('');
    } catch (cause) {
      if (controller.current !== request) return;
      setError(request.signal.aborted ? 'Stopped. Your question is ready to send again.' : cause instanceof Error ? cause.message : 'Unable to reach the AI provider. Try again.');
    } finally { if (controller.current === request) { pendingRef.current = false; setBusy(false); setPending(''); } }
  }
  function stop() {
    const active = controller.current; controller.current = undefined; active?.abort();
    pendingRef.current = false; setBusy(false); setPending(''); setError('Stopped. Your question is ready to send again.');
  }
  function choose(text: string) { setMode('ask'); setPrompt(text); input.current?.focus(); }
  return <div className="idea-flow guided-flow">
    <div className="guided-toolbar">
      <span><span className="i-ph:sparkle" aria-hidden="true" /> Your building partner</span>
      <button type="button" disabled={busy || !turns.length} onClick={() => { setTurns([]); setPrompt(''); setError(''); input.current?.focus(); }}><span className="i-ph:plus" aria-hidden="true" /> New conversation</button>
    </div>
    {!turns.length && !pending && <div className="guided-starters">{starters.map((item) => <button key={item.title} disabled={busy || !ready} onClick={() => choose(item.prompt)}><span className={item.icon} aria-hidden="true" /><strong>{item.title}</strong><small>{item.detail}</small><span className="guided-starter-arrow" aria-hidden="true">↗</span></button>)}</div>}
    <div className="guided-conversation" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions">
      {turns.map((turn, index) => <div className="guided-turn" key={index}>
        <div className="guided-user"><span>You</span><p>{turn.prompt}</p></div>
        <section className="idea-answer" aria-label="Assistant response">
          <div className="guided-assistant-label"><span className="i-ph:sparkle" aria-hidden="true" /> TensorStudio</div>
          <p className="idea-answer-text">{turn.response.answer}</p>
          <div className="idea-suggestions">{turn.response.suggestions.map((item) => <article key={item.title}>
            <span className="idea-path">{item.path === 'app' ? 'App' : 'Subnet'} · {['', 'Getting started', 'Intermediate', 'Advanced'][item.difficulty]}</span>
            <h2>{item.title}</h2><p>{item.pitch}</p>
            {item.uses.length > 0 && <p className="guided-uses">{item.uses.join(' / ')}</p>}
            <ol>{item.first_steps.map((step) => <li key={step}>{step}</li>)}</ol>
            <div className="idea-card-actions"><button disabled={busy} onClick={() => openBuilder(item.path, `${item.title}\n${item.pitch}\n\nPlan:\n${item.first_steps.join('\n')}\n\nContext:\n${turns.map((t) => t.prompt).join('\n')}`)}>Start building <span aria-hidden="true">↗</span></button>
              <button disabled={busy} onClick={() => choose(`Tell me more about ${item.title}`)}>Explore this idea</button></div>
          </article>)}</div>
        </section>
      </div>)}
      {pending && <div className="guided-pending"><div className="guided-user"><span>You</span><p>{pending}</p></div><p role="status"><span className="i-ph:sparkle" aria-hidden="true" /> Thinking through your next step…</p></div>}
      <div ref={end} />
    </div>
    <div className="guided-input-area">
      {error && <div className="idea-error" role="alert"><p>{error}</p>{!busy && <button type="button" onClick={() => void ask(prompt)}>Try again</button>}</div>}
      <form className="studio-composer" onSubmit={(event) => { event.preventDefault(); void ask(prompt); }}>
        <label className="sr-only" htmlFor="studio-idea">Describe your idea</label>
        <textarea ref={input} id="studio-idea" rows={3} maxLength={2000} value={prompt} disabled={busy} onChange={(event) => setPrompt(event.target.value)}
          placeholder={turns.length ? 'Ask a follow-up. Let’s work out the next step…' : 'What do you want to create? Start with an idea, or a question…'}
          onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void ask(prompt); } }} />
        <div className="studio-composer-footer">
          <div className="idea-modes" role="group" aria-label="Conversation mode">
            <button type="button" disabled={busy} aria-pressed={mode === 'ask'} onClick={() => setMode('ask')}><span className="i-ph:chat-circle" aria-hidden="true" /> Ask</button>
            <button type="button" disabled={busy} aria-pressed={mode === 'build'} onClick={() => setMode('build')}><span className="i-ph:code" aria-hidden="true" /> Build</button>
          </div>
          {mode === 'build' ? <select aria-label="Build destination" value={path} onChange={(event) => setPath(event.target.value as 'app' | 'subnet')}><option value="app">App</option><option value="subnet">Subnet</option></select> : <select aria-label="Assistant model" disabled={busy || !models.length} value={model} onChange={(event) => selectedModel.set(event.target.value)}><option value="">{provider ? `${provider} · default` : 'Model settings'}</option>{models.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>}
          {busy ? <button key="stop" type="button" aria-label="Stop response" onClick={(event) => { event.preventDefault(); stop(); }}>■</button> : <button key="send" type="submit" disabled={!ready || !prompt.trim()} aria-label={mode === 'ask' ? 'Send message' : 'Open builder'}>↑</button>}
        </div>
      </form>
      <div className="guided-composer-note"><span>{mode === 'ask' ? 'Think it through. Then build it.' : 'Review your idea in the builder before generating code.'}</span><span>{model === 'fallback' ? 'Configured fallback' : provider === 'Groq' ? 'Powered by Groq' : provider || 'Configure a model in settings'}</span></div>
    </div>
  </div>;
}
