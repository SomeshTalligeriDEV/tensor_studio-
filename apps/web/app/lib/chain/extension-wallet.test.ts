import { describe, expect, it, vi } from 'vitest';
import type { ApiPromise } from '@polkadot/api';
import type { Signer as ApiSigner } from '@polkadot/api/types';
import { connectTaostats, taostatsProvider } from './extension-wallet';

const alice = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const genesis = `0x${'12'.repeat(32)}`;
function fixture() {
  let changed: (accounts: { address: string }[]) => void = () => {};
  const stop = vi.fn();
  const signPayload = vi.fn().mockResolvedValue({ id: 1, signature: '0x1234' });
  const enable = vi.fn().mockResolvedValue({
    accounts: { get: vi.fn().mockResolvedValue([{ address: alice, name: 'Alice' }]), subscribe: vi.fn(callback => { changed = callback; return stop; }) },
    signer: { signPayload },
  });
  const host = { injectedWeb3: { taostats: { enable } } };
  const api = { genesisHash: { toHex: () => genesis }, runtimeVersion: { specName: { toString: () => 'subtensor' } }, rpc: { system: { chainType: vi.fn().mockResolvedValue({ toString: () => 'Development' }) } } } as unknown as ApiPromise;
  return { host, enable, stop, signPayload, api, change: (accounts: { address: string }[]) => changed(accounts) };
}
const payload = { address: alice, genesisHash: genesis } as Parameters<NonNullable<ApiSigner['signPayload']>>[0];

describe('Taostats extension boundary', () => {
  it('does not request permission during discovery and ignores unrelated providers', () => {
    const f = fixture();
    expect(taostatsProvider(f.host)).toBe(f.host.injectedWeb3.taostats);
    expect(f.enable).not.toHaveBeenCalled();
    expect(taostatsProvider({})).toBeUndefined();
  });
  it('reports an absent extension without inventing accounts', async () => {
    const changed = vi.fn();
    await expect(connectTaostats(changed, {})).rejects.toThrow('not installed');
    expect(changed).not.toHaveBeenCalled();
  });
  it('requests explicit permission, tracks revocation and unsubscribes once', async () => {
    const f = fixture(), changed = vi.fn();
    const session = await connectTaostats(changed, f.host);
    expect(f.enable).toHaveBeenCalledWith('TensorStudio');
    expect(session.accounts[0].address).toBe(alice);
    f.change([]);
    expect(session.accounts).toEqual([]);
    await expect(session.signer(f.api, alice, () => true).signPayload!(payload)).rejects.toThrow('permission changed');
    session.disconnect(); session.disconnect(); f.change([{ address: alice }]);
    expect(f.stop).toHaveBeenCalledTimes(1);
    expect(session.accounts).toEqual([]);
    expect(f.signPayload).not.toHaveBeenCalled();
  });
  it('rejects public-chain signing and mismatched payload before extension approval', async () => {
    const f = fixture();
    const session = await connectTaostats(() => {}, f.host);
    await expect(session.signer(f.api, alice, () => true).signPayload!({ ...payload, genesisHash: `0x${'34'.repeat(32)}` })).rejects.toThrow('does not match');
    vi.mocked(f.api.rpc.system.chainType).mockResolvedValue({ toString: () => 'Live' } as never);
    await expect(session.signer(f.api, alice, () => true).signPayload!(payload)).rejects.toThrow('local Bittensor');
    expect(f.signPayload).not.toHaveBeenCalled();
    session.disconnect();
  });
  it('delegates an exact payload and rejects a network switch while approval is pending', async () => {
    const f = fixture();
    const session = await connectTaostats(() => {}, f.host);
    const signer = session.signer(f.api, alice, () => true);
    await expect(signer.signPayload!(payload)).resolves.toEqual({ id: 1, signature: '0x1234' });
    expect(f.signPayload).toHaveBeenCalledWith(payload);
    let current = true;
    f.signPayload.mockImplementation(async () => { current = false; return { id: 2, signature: '0x1234' }; });
    await expect(session.signer(f.api, alice, () => current).signPayload!(payload)).rejects.toThrow('chain switched');
    session.disconnect();
  });
  it('propagates permission rejection without a connection', async () => {
    const f = fixture(); f.enable.mockRejectedValue(new Error('User rejected permission'));
    await expect(connectTaostats(() => {}, f.host)).rejects.toThrow('User rejected');
    expect(f.stop).not.toHaveBeenCalled();
  });
});
