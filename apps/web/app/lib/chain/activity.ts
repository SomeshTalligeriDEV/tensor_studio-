import type { ChainBlock } from './explorer';

/** Only adjacent canonical observations yield an interval; absent data stays absent. */
export function activitySamples(blocks: ChainBlock[], limit = 60) {
  const ordered = [...blocks].sort((a, b) => a.number - b.number);
  return ordered.map((block, i) => {
    const previous = ordered[i - 1];
    const delta = previous && previous.number + 1 === block.number && previous.hash === block.parent
      && previous.timestamp !== null && block.timestamp !== null ? (block.timestamp - previous.timestamp) / 1000 : null;
    return { height: block.number, hash: block.hash, signed: block.transactions.filter(tx => tx.signer !== null).length,
      events: block.events.length, interval: delta !== null && delta > 0 ? delta : null };
  }).slice(-limit);
}
export function feedHealth(status: string, updated: number | null, now: number, best: number | null, decoded: number | null) {
  if (status !== 'Connected') return status;
  if (updated === null) return 'Reading first block';
  if (now - updated > 45000) return 'Updates delayed';
  if (best !== null && decoded !== null && best > decoded) return 'Catching up';
  return 'Live';
}
