import { encodeAddress } from '@polkadot/util-crypto';
import { describe, expect, it } from 'vitest';
import { assertLocalSubtensor, formatTao, parseTao, recipientAddress } from './transfers';
import type { ApiPromise } from '@polkadot/api';

describe('Bittensor transfers', () => {
  it('converts TAO without floating point loss', () => {
    expect(parseTao('10')).toBe(10000000000n);
    expect(parseTao('0.000000001')).toBe(1n);
    expect(formatTao(parseTao('1234567890.123456789'))).toBe('1234567890.123456789');
    for (const invalid of ['0', '-1', '1e3', 'NaN', '1.0000000001', ' 1', '01', '18446744074']) expect(() => parseTao(invalid)).toThrow();
  });
  it('validates recipient checksums', () => {
    const alice = encodeAddress(new Uint8Array(32).fill(1), 42);
    expect(recipientAddress(alice)).toBe(alice);
    expect(() => recipientAddress(alice.slice(0, -1) + 'a')).toThrow('SS58');
  });
  it('refuses public networks and unrelated runtimes', async () => {
    const api = (type: string, specName: string) => ({ rpc: { system: { chainType: async () => type } }, runtimeVersion: { specName } }) as unknown as ApiPromise;
    await expect(assertLocalSubtensor(api('Live', 'subtensor'))).rejects.toThrow('local');
    await expect(assertLocalSubtensor(api('Development', 'polkadot'))).rejects.toThrow('local');
    await expect(assertLocalSubtensor(api('Development', 'subtensor'))).resolves.toBeUndefined();
  });
});
