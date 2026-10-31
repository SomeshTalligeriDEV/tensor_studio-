import { describe, expect, it } from 'vitest';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { parseExplorerSearch, taoFromRao, readExplorerBlock, explorerNetworks } from './explorer';

describe('Explorer input and precision', () => {
  it('distinguishes block IDs, transaction locations and SS58 accounts', () => {
    expect(parseExplorerSearch(' 123-2 ')).toEqual({ kind: 'transaction', value: '123', index: 2 });
    expect(parseExplorerSearch('000123')).toEqual({ kind: 'block', value: '123' });
    expect(parseExplorerSearch('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY').kind).toBe('address');
    for (const value of ['', '-1', '1.5', '1e6', 'https://example.com', '0x123', '123-9999999']) expect(() => parseExplorerSearch(value)).toThrow();
  });
  it('preserves every rao for large balances and hex RPC quantities', () => {
    expect(taoFromRao('18446744073709551615')).toBe('18446744073.709551615');
    expect(taoFromRao('0x3b9aca01')).toBe('1.000000001');
  });
});

// Opt-in integration checks query actual chain state and never submit extrinsics.
describe.skipIf(!process.env.BITCODE_EXPLORER_LIVE)('Live Bittensor explorer', () => {
  for (const [network, { endpoint }] of Object.entries(explorerNetworks)) {
    if (process.env.BITCODE_EXPLORER_NETWORK && process.env.BITCODE_EXPLORER_NETWORK !== network) continue;
    it(`decodes finalized blocks and receives another finalized head on ${network}`, async () => {
      const api = new ApiPromise({ provider: new WsProvider(endpoint, 1000), noInitWarn: true });
      let stop: (() => void) | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([api.isReadyOrError, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Connection timed out')), 25000); })]);
        clearTimeout(timer);
        expect(api.runtimeVersion.specName.toString().toLowerCase()).toContain('subtensor');
        const hash = await api.rpc.chain.getFinalizedHead();
        const block = await readExplorerBlock(api, hash.toHex());
        expect(block.hash).toBe(hash.toHex());
        expect(block.number).toBeGreaterThan(0);
        expect(block.transactions.length).toBeGreaterThan(0);
        expect(block.timestamp).toBeGreaterThan(0);
        expect(block.transactions.every((tx) => tx.result !== 'Unknown')).toBe(true);
        const at = await api.at(hash);
        const account = (await at.query.system.account('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY')).toJSON() as { data: { free: string } };
        expect(() => taoFromRao(String(account.data.free))).not.toThrow();
        await new Promise<void>((resolve, reject) => {
          timer = setTimeout(() => reject(new Error('No new finalized block within 45 seconds')), 45000);
          void api.rpc.chain.subscribeFinalizedHeads((head) => { if (head.number.toNumber() > block.number) resolve(); }).then((unsubscribe) => { stop = unsubscribe; }).catch(reject);
        });
        console.info(JSON.stringify({ network, block: block.number, extrinsics: block.transactions.length, events: block.events.length, streamed: true }));
      } finally { clearTimeout(timer); stop?.(); await api.disconnect(); }
    }, 85000);
  }
});
