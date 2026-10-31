import { useMemo, useState } from 'react';
import type { ChainBlock } from '~/lib/chain/explorer';
import { activitySamples } from '~/lib/chain/activity';
import { ScanLink } from './ScanLink';

type Metric = 'signed' | 'events' | 'interval';
const metrics: { key: Metric; label: string; unit: string }[] = [
  { key: 'signed', label: 'Signed calls', unit: 'calls / block' },
  { key: 'events', label: 'Chain events', unit: 'events / block' },
  { key: 'interval', label: 'Block time', unit: 'seconds' },
];
export function ActivityCharts({ blocks, network, initialMetric='signed' }: { blocks: ChainBlock[]; network: string; initialMetric?: Metric }) {
  const [metric, setMetric] = useState<Metric>(initialMetric);
  const samples = useMemo(() => activitySamples(blocks), [blocks]);
  const [selected, setSelected] = useState<number | null>(null);
  const active = samples.find(s => s.height === selected) || samples.at(-1);
  const values = samples.flatMap(row => row[metric] === null ? [] : [row[metric] as number]);
  const peak = values.length ? Math.max(...values) : null;
  const first = samples[0]?.height, last = samples.at(-1)?.height;
  const span = first !== undefined && last !== undefined ? Math.max(1, last - first) : 1;
  const x = (height: number) => 36 + ((height - (first || 0)) / span) * 704;
  const y = (value: number) => 148 - value / Math.max(peak || 0, 1) * 120;
  const width = Math.min(20, 480 / (span + 1));
  const choice = metrics.find(m => m.key === metric)!;
  return <section className="scan-activity" aria-label="Observed block activity">
    <div className="scan-activity-heading"><div><span className="scan-eyebrow">NETWORK ACTIVITY · {network}</span><h2>Every block tells a story.</h2><p>Last {samples.length} observed blocks. Missing observations stay empty.</p></div>
      <div className="scan-chart-tabs" role="group" aria-label="Chart metric">{metrics.map(m => <button key={m.key} aria-pressed={metric === m.key} onClick={() => setMetric(m.key)}>{m.label}</button>)}</div>
    </div>
    {!samples.length ? <div className="scan-chart-empty">No decoded blocks yet. Charts appear when this network returns real data.</div> : <>
      <div className="scan-chart-summary"><strong>{peak === null ? 'Unavailable' : peak.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong><span>Peak {choice.unit}</span><span>{first?.toLocaleString()} — {last?.toLocaleString()}</span></div>
      <svg className="scan-activity-plot" viewBox="0 0 780 180" role="group" aria-label={`${choice.label} across ${samples.length} observed blocks`}>
        {[0, .5, 1].map(ratio => <g key={ratio}><line x1="36" y1={148 - ratio * 120} x2="754" y2={148 - ratio * 120} className="scan-chart-rule" /><text x="4" y={152 - ratio * 120}>{((peak || 0) * ratio).toLocaleString(undefined, { maximumFractionDigits: 1 })}</text></g>)}
        {samples.map(row => row[metric] === null ? null : <ScanLink key={row.hash} kind="block" value={String(row.height)}><rect x={x(row.height) - width / 2} y={y(row[metric]!)} width={width} height={Math.max(1, 148 - y(row[metric]!))} rx="2" className={active?.height === row.height ? 'scan-chart-bar is-selected' : 'scan-chart-bar'} onMouseEnter={() => setSelected(row.height)}><title>Block {row.height}: {row[metric]} {choice.unit}</title></rect></ScanLink>)}
        <text x="36" y="174">#{first}</text><text x="740" y="174" textAnchor="end">#{last}</text>
      </svg>
      <div className="scan-chart-inspect"><label>Inspect block <select aria-label="Inspect chart block" value={active?.height} onChange={e => setSelected(Number(e.target.value))}>{samples.map(row => <option key={row.hash} value={row.height}>{row.height.toLocaleString()}</option>)}</select></label>{active && <p><ScanLink kind="block" value={String(active.height)}>#{active.height.toLocaleString()}</ScanLink><span>{active.signed} signed calls</span><span>{active.events} events</span><span>{active.interval === null ? 'Interval unavailable' : `${active.interval.toLocaleString(undefined, { maximumFractionDigits: 2 })}s interval`}</span></p>}</div>
      <details className="scan-chart-data"><summary>View source values</summary><div className="scan-table-wrap"><table><thead><tr><th>Block</th><th>Signed calls</th><th>Events</th><th>Interval</th></tr></thead><tbody>{[...samples].reverse().map(row => <tr key={row.hash}><td><ScanLink kind="block" value={String(row.height)}>{row.height.toLocaleString()}</ScanLink></td><td>{row.signed}</td><td>{row.events}</td><td>{row.interval === null ? 'Unavailable' : `${row.interval}s`}</td></tr>)}</tbody></table></div></details>
    </>}
  </section>;
}
