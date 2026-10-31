import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ChainBlock } from './explorer';

const transport = vi.hoisted(() => ({ create: vi.fn(), read: vi.fn() }));
vi.mock('@polkadot/api', () => ({
  WsProvider: class { connect = async () => {}; on = () => {}; },
  ApiPromise: class { constructor() { return transport.create(); } },
}));
vi.mock('./explorer', () => ({ readExplorerBlock: transport.read }));
import { createLiveSession } from './session-runtime';

const hex = (value: string) => ({ toHex: () => value });
const header = (number: number, hash = `a${number}`) => ({ number: { toNumber: () => number }, hash: hex(hash) });
const block = (number: number, hash = `a${number}`, parent = `a${number - 1}`): ChainBlock => ({ number, hash, parent, timestamp: null, transactions: [], events: [] });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function fakeApi() {
  let head: (value: ReturnType<typeof header>) => void = () => {};
  const stopHeads = vi.fn(), stopFinality = vi.fn();
  const api = {
    isReadyOrError: Promise.resolve(), genesisHash: hex('local-genesis'), runtimeVersion: { specName: 'subtensor' }, disconnect: vi.fn(async () => {}),
    rpc: {
      system: { chain: async () => 'Local', chainType: async () => 'Development' },
      chain: {
        getFinalizedHead: vi.fn(async () => hex('a0')),
        getHeader: vi.fn(async (hash?: unknown) => header(hash ? 0 : 2)),
        getBlockHash: vi.fn(async (height: number) => hex(`a${height}`)),
        subscribeNewHeads: vi.fn(async (callback: typeof head) => { head = callback; return stopHeads; }),
        subscribeFinalizedHeads: vi.fn(async () => stopFinality),
      },
    },
  };
  return { api, stopHeads, stopFinality, head: (number: number, hash?: string) => head(header(number, hash)) };
}
let runtime: ReturnType<typeof createLiveSession> | undefined;
beforeEach(() => { transport.create.mockReset(); transport.read.mockReset(); });
afterEach(async () => { await runtime?.dispose(); runtime = undefined; });

it('recovers automatically when initial finalized-head setup fails once', async () => {
  const first = fakeApi(), second = fakeApi();
  first.api.rpc.chain.getFinalizedHead.mockRejectedValueOnce(new Error('temporary RPC failure'));
  transport.create.mockReturnValueOnce(first.api).mockReturnValue(second.api);
  transport.read.mockImplementation(async (_api, hash: string) => block(Number(hash.slice(1)), hash));
  runtime = createLiveSession(() => {});
  await runtime.select('local', 'ws://local');
  await vi.waitFor(() => expect(transport.create).toHaveBeenCalledTimes(2), { timeout: 3000 });
  await vi.waitFor(() => expect(runtime!.snapshot().progress.done).toBe(3));
  second.head(3);
  await vi.waitFor(() => expect(runtime!.snapshot().headHash).toBe('a3'));
  expect(runtime.snapshot().status).toBe('Connected');
  expect(first.stopHeads).toHaveBeenCalledOnce();
  expect(first.api.disconnect).toHaveBeenCalledOnce();
  expect(runtime.snapshot().subscriptions).toBe(2);
});

it('does not let an old backfill result replace a newer canonical fork at the same height', async () => {
  const connection = fakeApi();
  const oldHeightTwo = deferred<ChainBlock>();
  transport.create.mockReturnValue(connection.api);
  transport.read.mockImplementation(async (_api, hash: string) => hash === 'a2'
    ? oldHeightTwo.promise
    : block(Number(hash.slice(1)), hash, hash.startsWith('b') ? `b${Number(hash.slice(1)) - 1}` : undefined));
  runtime = createLiveSession(() => {});
  await runtime.select('local', 'ws://local');
  await vi.waitFor(() => expect(transport.read).toHaveBeenCalledWith(connection.api, 'a2'));
  // The read of a2 is still in flight when another canonical block arrives at height 2.
  connection.api.rpc.chain.getBlockHash.mockImplementation(async height => hex(height === 0 ? 'a0' : `b${height}`));
  connection.head(2, 'b2');
  await vi.waitFor(() => expect(runtime!.snapshot().headHash).toBe('b2'));
  oldHeightTwo.resolve(block(2));
  await vi.waitFor(() => expect(runtime!.snapshot().progress.done).toBe(3));
  expect(runtime.snapshot().blocks.find(value => value.number === 2)?.hash).toBe('b2');
  expect(runtime.snapshot().index?.getBlocks().find(value => value.number === 2)?.hash).toBe('b2');
});

it('makes backfill progress while a live head read is still in flight', async () => {
  const connection=fakeApi(),liveRead=deferred<ChainBlock>();
  transport.create.mockReturnValue(connection.api);
  connection.api.rpc.chain.getHeader.mockImplementation(async hash=>{
    if(!hash)connection.head(3);
    return header(hash?0:2);
  });
  transport.read.mockImplementation(async (_api,hash:string)=>hash==='a3'?liveRead.promise:block(Number(hash.slice(1)),hash));
  runtime=createLiveSession(()=>{});
  await runtime.select('local','ws://local');
  await vi.waitFor(()=>expect(transport.read).toHaveBeenCalledWith(connection.api,'a3'));
  try { await vi.waitFor(()=>expect(runtime!.snapshot().progress.done).toBe(3),{timeout:500}); }
  finally { liveRead.resolve(block(3)); }
  await vi.waitFor(()=>expect(runtime!.snapshot().headHash).toBe('a3'));
});
