import { expect, it, vi } from 'vitest';
import { ChainSession, TESTNET_GENESIS, type Connection } from '@tensorstudio/chain';

it('unsubscribes a late old-network subscription without attaching finality or publishing stale heads', async () => {
  let resolveOldHead!: (stop: () => void) => void;
  let oldHead!: (height: number, hash: string) => void;
  const oldStop = vi.fn(), nextStop = vi.fn(), nextFinalityStop = vi.fn();
  const oldPending = new Promise<() => void>(resolve => { resolveOldHead = resolve; });
  const ready = async () => ({ genesis: TESTNET_GENESIS, chain: 'Subtensor', runtime: 'subtensor', chainType: 'Development' });
  const old: Connection<string> = {
    api: 'old', ready,
    heads: vi.fn(callback => { oldHead = callback; return oldPending; }),
    finality: vi.fn(async () => vi.fn()), onDisconnect: () => {}, close: vi.fn(async () => {}),
  };
  const next: Connection<string> = {
    api: 'next', ready, heads: async () => nextStop,
    finality: async () => nextFinalityStop, onDisconnect: () => {}, close: vi.fn(async () => {}),
  };
  const factory = vi.fn().mockReturnValueOnce(old).mockReturnValueOnce(next);
  const session = new ChainSession<string>(factory);
  try {
    const firstSelection = session.select('test', 'wss://test');
    await vi.waitFor(() => expect(old.heads).toHaveBeenCalledOnce());
    await session.select('local', 'ws://local');
    expect(session.state.api).toBe('next');
    expect(session.state.subscriptions).toBe(2);
    resolveOldHead(oldStop);
    await firstSelection;
    oldHead(999, 'stale-hash');
    expect(oldStop).toHaveBeenCalledOnce();
    expect(old.finality).not.toHaveBeenCalled();
    expect(session.state.best).toBeNull();
    expect(session.state.api).toBe('next');
    expect(session.state.subscriptions).toBe(2);
    expect(nextStop).not.toHaveBeenCalled();
  } finally { await session.dispose(); }
  expect(nextStop).toHaveBeenCalledOnce();
  expect(nextFinalityStop).toHaveBeenCalledOnce();
});
