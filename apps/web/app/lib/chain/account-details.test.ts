import { expect, it, vi } from 'vitest';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { readAccountDetails } from './account-details';
const address = '5DSL6RqG33yhd8ECwdNwHPb3gvdsqf5SEqYvw9ncc8KvmiFG';
function fixture() {
  const entries = vi.fn(async () => [
    [{ args: [address, 1] }, true],
    [{ args: [address, 2] }, false],
    [{ args: [address, 8] }, true],
  ]);
  const stakes = vi.fn(async () => [{ netuid: 1, hotkey: address, coldkey: address, stake: '9007199254740993' }]);
  const at = vi.fn(async () => ({
    query: {
      system: { account: async () => ({ nonce: 2, data: { free: '9007199254740993', reserved: 1, frozen: 0 } }) },
      subtensorModule: { isNetworkMember: { entries } },
    },
    call: { stakeInfoRuntimeApi: { getStakeInfoForColdkey: stakes } },
  }));
  const api = {
    at,
    rpc: {
      chain: {
        getFinalizedHead: async () => ({ toString: (): string => 'final' }),
        getHeader: async () => ({ number: { toNumber: () => 123 } }),
      },
    },
  } as unknown as ApiPromise;
  return { api, entries, stakes };
}
it('pins balance, memberships and stakes to caller hash without losing precision', async () => {
  const { api, entries, stakes } = fixture();
  const result = await readAccountDetails(api, address, 'chosen');
  expect(api.at).toHaveBeenCalledWith('chosen');
  expect(result.blockHash).toBe('chosen');
  expect(result.free).toBe('9007199254740993');
  expect(result.subnets).toEqual([1, 8]);
  expect(result.stakes[0].alpha).toBe('9007199254740993');
  expect(entries).toHaveBeenCalledWith(address);
  expect(stakes).toHaveBeenCalledWith(address);
});
it('reports unavailable subnet/stake reads instead of claiming empty chain data', async () => {
  const { api, entries, stakes } = fixture();
  entries.mockRejectedValueOnce(new Error('RPC unavailable'));
  stakes.mockRejectedValueOnce(new Error('pruned'));
  const result = await readAccountDetails(api, address);
  expect(result.membershipError).toBeTruthy();
  expect(result.stakesError).toBeTruthy();
  expect(result.blockNumber).toBe(123);
});
it('rejects invalid address before contacting RPC', async () => {
  const { api } = fixture();
  await expect(readAccountDetails(api, 'bad')).rejects.toThrow();
  expect(api.at).not.toHaveBeenCalled();
});

it.skipIf(!process.env.BITCODE_EXPLORER_LIVE)(
  'reads live testnet membership and coldkey stakes',
  async () => {
    const api = new ApiPromise({
      provider: new WsProvider('wss://test.finney.opentensor.ai:443', 1000),
      noInitWarn: true,
    });
    try {
      await api.isReadyOrError;
      const result = await readAccountDetails(api, address);
      expect(result.subnets).toContain(1);
      expect(result.membershipError).toBeNull();
      expect(result.stakesError).toBeNull();
      console.info(
        JSON.stringify({
          address: result.address,
          block: result.blockNumber,
          subnets: result.subnets,
          stakeCount: result.stakes.length,
          firstStake: result.stakes[0],
          free: result.free,
        }),
      );
    } finally {
      await api.disconnect();
    }
  },
  85000,
);
