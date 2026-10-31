import { expect, it } from 'vitest';
import { activitySamples, feedHealth } from './activity';
import type { ChainBlock } from './explorer';
const block = (number: number, timestamp: number | null, parent = `h${number - 1}`): ChainBlock => ({ number, timestamp, parent, hash: `h${number}`, transactions: [], events: [] });
it('never interpolates missing blocks, missing timestamps or mismatched parents', () => {
  const rows = activitySamples([block(1, 1000), block(2, 13000), block(4, 37000), block(5, null), block(6, 61000), block(7, 73000, 'fork')]);
  expect(rows.map(row => row.interval)).toEqual([null, 12, null, null, null, null]);
  expect(rows.map(row => row.signed)).toEqual([0, 0, 0, 0, 0, 0]);
});
it('uses actual decoded signed calls and events, sorts without mutating input', () => {
  const a = block(1, 1000), b = block(2, 13000);
  b.transactions = [{ index: 0, hash: 'x', call: 'timestamp.set', signer: null, args: {}, result: 'Success', events: [] }, { index: 1, hash: 'y', call: 'balances.transferKeepAlive', signer: 'Alice', args: {}, result: 'Failed', events: [] }];
  b.events = [{ name: 'system.ExtrinsicFailed', data: {}, phase: 'ApplyExtrinsic' }];
  const input = [b, a];
  expect(activitySamples(input, 1)).toEqual([{ height: 2, hash: 'h2', signed: 1, events: 1, interval: 12 }]);
  expect(input[0]).toBe(b);
});
it('does not label a connected but stalled or undecoded feed as live', () => {
  expect(feedHealth('Connected', null, 100000, 10, null)).toBe('Reading first block');
  expect(feedHealth('Connected', 1, 100000, 10, 10)).toBe('Updates delayed');
  expect(feedHealth('Connected', 99999, 100000, 11, 10)).toBe('Catching up');
  expect(feedHealth('Connected', 99999, 100000, 11, 11)).toBe('Live');
  expect(feedHealth('Disconnected', 99999, 100000, 11, 11)).toBe('Disconnected');
});
