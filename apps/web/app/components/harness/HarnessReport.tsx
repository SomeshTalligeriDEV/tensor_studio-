import { runnerFetch } from '~/lib/runner/client';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from '@remix-run/react';

const RUNNER = 'http://127.0.0.1:8787';

type Check = {
  id: string;
  label: string;
  status: 'passed' | 'failed' | 'not_applicable';
  explanation: string;
};

type EvaluationReport = {
  id: string;
  created_at: string;
  project: string;
  recipe_sha256: string;
  dataset_sha256: string;
  task: string;
  mode: 'synthetic_offline';
  latency_mode: 'simulated_elapsed_values';
  rounds: number;
  dataset_rows: number;
  distinct_samples_used: number;
  duration_seconds: number;
  timeout_seconds: number;
  weight_block: string;
  isolated_honest_average_score: number;
  passed: boolean;
  miners: {
    id: string;
    description: string;
    average_score: number;
    final_weight: number;
    score_ratio_to_honest: number | null;
    simulated_elapsed_seconds: number;
  }[];
  checks: Check[];
  observations: { round: number; sample_index: number; scores: Record<string, number>; weights: Record<string, number> }[];
  limitations: string[];
};

async function requestReport(path: string, project?: string, rounds?: number, signal?: AbortSignal): Promise<EvaluationReport> {
  const response = await runnerFetch(RUNNER + path, {
    method: project ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Bitcode-Client': 'studio' },
    body: project ? JSON.stringify({ project, rounds }) : undefined,
    signal: signal ?? AbortSignal.timeout(20000),
  });
  const body = await response.json() as EvaluationReport & { detail?: unknown };
  if (!response.ok) {
    throw new Error(typeof body.detail === 'string' ? body.detail : 'The runner could not complete this evaluation. Check the project and round count.');
  }
  return body;
}

function errorMessage(cause: unknown): string {
  if (cause instanceof TypeError) return 'Cannot reach the local runner. Start it on port 8787 and try again.';
  return cause instanceof Error ? cause.message : 'The evaluation request failed. Try again.';
}

export function HarnessReport({ report }: { report: EvaluationReport }) {
  const failed = report.checks.filter((check) => check.status === 'failed').length;
  return <section aria-label="Offline evaluation report" className="mt-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2>Offline synthetic evaluation</h2>
        <p className="text-sm mt-2">{failed ? `${failed} ${failed === 1 ? 'check needs' : 'checks need'} attention` : 'Applicable fixture checks passed'}</p>
      </div>
      <Link className="text-sm underline underline-offset-4" to={`/harness?id=${encodeURIComponent(report.id)}`}>Open saved report</Link>
    </div>
    <p className="text-sm mt-4">Answers use supplied ground truth and controlled fixtures. Timing values are simulated. No model inference, miner network request or chain execution occurred.</p>
    <dl className="grid gap-3 mt-5 text-sm" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
      <div><dt style={{ color: 'var(--studio-muted)' }}>Rounds</dt><dd>{report.rounds}</dd></div>
      <div><dt style={{ color: 'var(--studio-muted)' }}>Dataset coverage</dt><dd>{report.distinct_samples_used} of {report.dataset_rows} rows</dd></div>
      <div><dt style={{ color: 'var(--studio-muted)' }}>Measured evaluation time</dt><dd>{report.duration_seconds.toFixed(3)} seconds</dd></div>
      <div><dt style={{ color: 'var(--studio-muted)' }}>Scoring timeout</dt><dd>{report.timeout_seconds} seconds</dd></div>
    </dl>
    <div className="overflow-auto mt-6" tabIndex={0} role="region" aria-label="Fixture scoring results">
      <table className="w-full text-sm" style={{ minWidth: 640, borderCollapse: 'collapse' }}>
        <caption className="text-left pb-3">Real scoring results from controlled fixtures. Final weights are calculated locally, not submitted to a chain.</caption>
        <thead><tr style={{ borderBottom: '1px solid var(--studio-line)' }}>
          <th scope="col" className="text-left p-3">Fixture</th>
          <th scope="col" className="text-right p-3">Average score</th>
          <th scope="col" className="text-right p-3">Final weight</th>
          <th scope="col" className="text-right p-3">Score / honest</th>
          <th scope="col" className="text-right p-3">Simulated time</th>
        </tr></thead>
        <tbody>{report.miners.map((miner) => <tr key={miner.id} style={{ borderBottom: '1px solid var(--studio-line)' }}>
          <th scope="row" className="text-left p-3 font-normal"><span className="capitalize">{miner.id}</span><span className="block text-xs mt-1" style={{ color: 'var(--studio-muted)', maxWidth: '30ch' }}>{miner.description}</span></th>
          <td className="text-right p-3 tabular-nums">{miner.average_score.toFixed(3)}</td>
          <td className="text-right p-3 tabular-nums">{(miner.final_weight * 100).toFixed(2)}%</td>
          <td className="text-right p-3 tabular-nums">{miner.score_ratio_to_honest === null ? 'Unavailable' : `${miner.score_ratio_to_honest.toFixed(2)}×`}</td>
          <td className="text-right p-3 tabular-nums">{miner.simulated_elapsed_seconds.toFixed(1)} s</td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="text-sm mt-3" style={{ color: 'var(--studio-muted)' }}>The honest fixture scored {report.isolated_honest_average_score.toFixed(3)} on average when evaluated alone. Duplicate penalties may lower it when copies appear alongside it.</p>
    <h3 className="mt-6">Scoring checks</h3>
    <ul className="mt-2 list-none p-0">
      {report.checks.map((check) => <li key={check.id} className="py-4" style={{ borderBottom: '1px solid var(--studio-line)' }}>
        <div className="flex flex-wrap justify-between gap-3 text-sm"><strong className="font-medium">{check.label}</strong><span>{check.status === 'passed' ? 'Passed' : check.status === 'failed' ? 'Failed' : 'Not applicable'}</span></div>
        <p className="text-sm mt-2" style={{ color: 'var(--studio-muted)' }}>{check.explanation}</p>
      </li>)}
    </ul>
    <h3 className="mt-6">What this means</h3>
    <p className="text-sm mt-2">{failed ? 'Review the failed checks before relying on this scoring design. The results describe this dataset and these fixtures; they are not a deployment readiness verdict.' : 'The applicable checks passed for these fixtures. This does not establish real-world miner quality or security.'}</p>
    <ul className="list-disc pl-5 mt-3 text-sm space-y-2">{report.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
    <details className="mt-5">
      <summary>Report details and round observations</summary>
      <dl className="text-xs space-y-2 break-all mt-3">
        <div><dt>Report</dt><dd>{report.id}</dd></div>
        <div><dt>Project</dt><dd>{report.project}</dd></div>
        <div><dt>Created</dt><dd>{new Date(report.created_at).toLocaleString()}</dd></div>
        <div><dt>Task / weight block</dt><dd>{report.task} / {report.weight_block}</dd></div>
        <div><dt>Recipe SHA-256</dt><dd>{report.recipe_sha256}</dd></div>
        <div><dt>Dataset SHA-256</dt><dd>{report.dataset_sha256}</dd></div>
      </dl>
      <pre tabIndex={0} className="p-4 mt-4 overflow-auto max-h-96 text-xs" aria-label="Per-round scoring observations">{JSON.stringify(report.observations, null, 2)}</pre>
    </details>
    <p className="text-xs mt-4" style={{ color: 'var(--studio-muted)' }}>Saved locally in the runner. The latest 64 reports are retained. This link requires the same runner and is not a public report.</p>
  </section>;
}

export function ProjectHarness({ project }: { project: string }) {
  const [rounds, setRounds] = useState('20');
  const [report, setReport] = useState<EvaluationReport>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true); setError(''); setReport(undefined);
    try {
      setReport(await requestReport('/harness/run', project, Number(rounds)));
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <section className="border rounded p-5 my-6" aria-label="Test generated scoring">
    <h2>Test the scoring design</h2>
    <p className="text-sm mt-2">Compare honest, copied, incorrect, slow and empty answers with controlled offline fixtures. This runs the real scoring blocks without a model or chain.</p>
    <form className="flex flex-wrap items-end gap-3 mt-4" onSubmit={(event) => { event.preventDefault(); void run(); }}>
      <label>Rounds<input className="block mt-1" style={{ width: 110 }} required type="number" min={1} max={100} step={1} value={rounds} disabled={busy} onChange={(event) => setRounds(event.target.value)} /></label>
      <button type="submit" disabled={busy}>{busy ? 'Evaluating fixtures…' : 'Run offline harness'}</button>
    </form>
    {busy && <p role="status" className="text-sm mt-3">Evaluating the supplied dataset and saving the report locally…</p>}
    {error && <p role="alert" className="mt-4">{error}</p>}
    {report && <HarnessReport report={report} />}
  </section>;
}

export function HarnessPage() {
  const [params] = useSearchParams();
  const identifier = params.get('id') || '';
  const [report, setReport] = useState<EvaluationReport>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setReport(undefined); setError(''); setLoading(false);
    if (!identifier) return;
    if (!/^[a-f0-9]{32}$/.test(identifier)) { setError('This report link has an invalid ID. Open a saved report from SubCreate.'); return; }
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    void requestReport(`/harness/${identifier}`, undefined, undefined,
      AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]))
      .then((result) => { if (active) setReport(result); })
      .catch((cause: unknown) => { if (active) setError(errorMessage(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [identifier, retry]);

  return <main className="studio-home">
    <h1>Evaluation report</h1>
    <p>Inspect a saved evaluation from your local runner.</p>
    <Link className="inline-block text-sm underline underline-offset-4 mt-3" to="/subcreate">Back to SubCreate</Link>
    {!identifier && <p className="mt-6 text-sm">Assemble a project in SubCreate, run its offline harness, then open the saved report link.</p>}
    {loading && <p role="status" className="mt-6">Loading saved report…</p>}
    {error && <><p role="alert" className="mt-6">{error}</p><button className="mt-3" onClick={() => setRetry((value) => value + 1)}>Try again</button></>}
    {report && <HarnessReport report={report} />}
  </main>;
}
