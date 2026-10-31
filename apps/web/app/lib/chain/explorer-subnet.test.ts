import { expect, it, vi } from 'vitest';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { readSubnet } from './explorer-subnet';
function fixture(count = 256) {
  const graph: Record<string, unknown> = {
    netuid: 1,
    ownerColdkey: 'Owner',
    ownerHotkey: 'OwnerHot',
    numUids: count,
    block: 123,
    tempo: 99,
    lastStep: 100,
    name: [97, 112, 101, 120],
    symbol: [206, 177],
    hotkeys: Array.from({ length: count }, (_, i) => `Hot${i}`),
    coldkeys: ['Cold'],
    alphaStake: ['9007199254740993'],
    taoStake: ['22'],
    incentives: [65535],
    emission: [123],
    dividends: [2],
    lastUpdate: [120],
    validatorPermit: [true],
    active: [true],
    taoIn: '2000000000',
    alphaIn: '4000000000',
    subnetEmission: '99',
    alphaOutEmission: '1000000000',
  };
  const call = vi.fn(async () => ({ isNone: false, unwrap: () => graph }));
  const at = vi.fn(async () => ({
    call: {
      subnetInfoRuntimeApi: { getMetagraph: call },
      swapRuntimeApi: { currentAlphaPrice: async () => 500000000 },
    },
  }));
  const api = {
    rpc: {
      chain: {
        getFinalizedHead: vi.fn(async () => ({ toString: (): string => 'final' })),
        getHeader: vi.fn(async () => ({ number: { toNumber: () => 123 } })),
      },
    },
    at,
  } as unknown as ApiPromise;
  return { api, at, call, graph };
}
it('reads all neurons from one runtime call and preserves units and large precision', async () => {
  const { api, call } = fixture();
  const result = await readSubnet(api, 1, 'pinned');
  expect(result.neurons).toHaveLength(256);
  expect(result.blockHash).toBe('pinned');
  expect(call).toHaveBeenCalledTimes(1);
  expect(result.neurons[0]).toMatchObject({
    uid: 0,
    hotkey: 'Hot0',
    stake: '9007199254740993',
    taoStake: '22',
    incentive: '65535',
    lastUpdate: 120,
    validatorPermit: true,
    emission: '123',
  });
  expect(result.alphaPrice).toBe('0.500000000');
  expect(result.name).toBe('apex');
  expect(result.symbol).toBe('α');
  expect(result.neurons[1].emission).toBeNull();
  expect(result.ownerEarnings).toBeNull();
  expect(api.rpc.chain.getFinalizedHead).not.toHaveBeenCalled();
});
it('deduplicates concurrent requests at the same hash without mixing blocks', async () => {
  const { api, call } = fixture();
  await Promise.all([readSubnet(api, 1, 'a'), readSubnet(api, 1, 'a')]);
  expect(call).toHaveBeenCalledTimes(1);
  await readSubnet(api, 1, 'b');
  expect(call).toHaveBeenCalledTimes(2);
});
it('rejects invalid subnet IDs, unsupported runtime and absent subnets', async () => {
  const { api, call, at } = fixture();
  await expect(readSubnet(api, -1)).rejects.toThrow('netuid');
  call.mockResolvedValueOnce({ isNone: true, unwrap: () => ({}) });
  await expect(readSubnet(api, 1, 'absent')).rejects.toThrow('does not exist');
  at.mockResolvedValueOnce({
    call: {
      subnetInfoRuntimeApi: { getMetagraph: undefined as never },
      swapRuntimeApi: { currentAlphaPrice: async () => 500000000 },
    },
  });
  await expect(readSubnet(api, 1, 'old')).rejects.toThrow('getMetagraph');
});
it('uses finalized snapshot by default and never invents missing metrics', async () => {
  const { api, graph } = fixture();
  delete graph.taoIn;
  delete graph.alphaIn;
  delete graph.validatorPermit;
  const result = await readSubnet(api, 1);
  expect(result.blockHash).toBe('final');
  expect(result.alphaPrice).toBe('0.500000000');
  expect(result.neurons[0].validatorPermit).toBeNull();
});
it.skipIf(!process.env.BITCODE_EXPLORER_LIVE)(
  'reads full live testnet metagraph',
  async () => {
    const api = new ApiPromise({
      provider: new WsProvider('wss://test.finney.opentensor.ai:443', 1000),
      noInitWarn: true,
    });
    try {
      await api.isReadyOrError;
      const result = await readSubnet(api, 1);
      expect(result.neurons.length).toBe(result.neuronCount);
      expect(result.neurons[0].hotkey).toMatch(/^5/);
      console.info(
        JSON.stringify({
          genesis: api.genesisHash.toHex(),
          spec: api.runtimeVersion.specVersion.toString(),
          block: result.blockNumber,
          netuid: result.netuid,
          count: result.neuronCount,
          first: result.neurons[0],
          price: result.alphaPrice,
        }),
      );
    } finally {
      await api.disconnect();
    }
  },
  85000,
);
